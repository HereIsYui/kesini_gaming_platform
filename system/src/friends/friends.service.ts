import { Injectable, Optional } from "@nestjs/common";
import { DataSource, EntityManager, In } from "typeorm";
import { User } from "src/entity/user.entity";
import { UserFriend, UserFriendStatus } from "src/entity/userFriend.entity";
import { SocialActivityService } from "src/social/social-activity.service";
import {
  ensureUsersPublicIds,
  getUserPublicId,
} from "src/utils/user-public-id";

@Injectable()
export class FriendsService {
  constructor(
    private readonly dataSource: DataSource,
    @Optional()
    private readonly socialActivityService?: SocialActivityService,
  ) {}

  async getOverview(uid: string) {
    const normalizedUid = this.normalizeUid(uid);
    await this.findUser(this.dataSource, normalizedUid);

    const repository = this.dataSource.getRepository(UserFriend);
    const [friends, incoming, outgoing] = await Promise.all([
      repository.find({
        where: [
          { requester_uid: normalizedUid, status: "accepted" },
          { receiver_uid: normalizedUid, status: "accepted" },
        ],
        order: { updatedAt: "DESC" },
      }),
      repository.find({
        where: { receiver_uid: normalizedUid, status: "pending" },
        order: { createdAt: "DESC" },
      }),
      repository.find({
        where: { requester_uid: normalizedUid, status: "pending" },
        order: { createdAt: "DESC" },
      }),
    ]);

    const userMap = await this.getRelatedUsers(normalizedUid, [
      ...friends,
      ...incoming,
      ...outgoing,
    ]);
    const friendRows = this.toRelationRows(friends, normalizedUid, userMap);
    const incomingRows = this.toRelationRows(incoming, normalizedUid, userMap);
    const outgoingRows = this.toRelationRows(outgoing, normalizedUid, userMap);

    return {
      friends: friendRows,
      incoming: incomingRows,
      outgoing: outgoingRows,
      counts: {
        friends: friendRows.length,
        incoming: incomingRows.length,
        outgoing: outgoingRows.length,
      },
    };
  }

  async sendRequest(uid: string, targetUid: string) {
    const requesterUid = this.normalizeUid(uid);
    const targetValue = this.normalizeUid(targetUid);

    return this.dataSource.transaction(async (manager) => {
      await this.findUser(manager, requesterUid);
      const receiver = await this.findUserByUidOrName(manager, targetValue);
      const receiverUid = receiver.uid;
      if (requesterUid === receiverUid) {
        throw new Error("不能添加自己");
      }

      const repository = manager.getRepository(UserFriend);
      const relationKey = this.getRelationKey(requesterUid, receiverUid);
      let relation = await repository.findOne({
        where: { relation_key: relationKey },
        lock: { mode: "pessimistic_write" },
      });

      if (relation?.status === "accepted") {
        throw new Error("已是好友");
      }
      if (relation?.status === "pending") {
        if (relation.requester_uid === requesterUid) {
          throw new Error("已申请");
        }
        throw new Error("对方已申请");
      }

      if (relation) {
        relation.requester_uid = requesterUid;
        relation.receiver_uid = receiverUid;
        relation.status = "pending";
        relation.responded_at = null;
      } else {
        relation = repository.create({
          requester_uid: requesterUid,
          receiver_uid: receiverUid,
          relation_key: relationKey,
          status: "pending",
          responded_at: null,
        });
      }
      const saved = await repository.save(relation);
      return this.toRelationRow(
        saved,
        requesterUid,
        await this.getRelatedUsers(requesterUid, [saved], manager),
      );
    });
  }

  async acceptRequest(uid: string, requestId: number) {
    return this.handleIncomingRequest(uid, requestId, "accepted");
  }

  async rejectRequest(uid: string, requestId: number) {
    return this.handleIncomingRequest(uid, requestId, "rejected");
  }

  async cancelRequest(uid: string, requestId: number) {
    const normalizedUid = this.normalizeUid(uid);
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(UserFriend);
      const relation = await repository.findOne({
        where: { id: requestId },
        lock: { mode: "pessimistic_write" },
      });
      if (
        !relation ||
        relation.requester_uid !== normalizedUid ||
        relation.status !== "pending"
      ) {
        throw new Error("申请不存在");
      }
      relation.status = "cancelled";
      relation.responded_at = new Date();
      const saved = await repository.save(relation);
      return this.toRelationRow(
        saved,
        normalizedUid,
        await this.getRelatedUsers(normalizedUid, [saved], manager),
      );
    });
  }

  async removeFriend(uid: string, targetUid: string) {
    const normalizedUid = this.normalizeUid(uid);
    const normalizedTargetUid = this.normalizeUid(targetUid);
    if (normalizedUid === normalizedTargetUid) {
      throw new Error("好友不存在");
    }

    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(UserFriend);
      const relation = await repository.findOne({
        where: {
          relation_key: this.getRelationKey(normalizedUid, normalizedTargetUid),
        },
        lock: { mode: "pessimistic_write" },
      });
      if (!relation || relation.status !== "accepted") {
        throw new Error("好友不存在");
      }
      relation.requester_uid = normalizedUid;
      relation.receiver_uid = normalizedTargetUid;
      relation.status = "cancelled";
      relation.responded_at = new Date();
      await repository.save(relation);
      return { uid: normalizedTargetUid };
    });
  }

  private async handleIncomingRequest(
    uid: string,
    requestId: number,
    status: Extract<UserFriendStatus, "accepted" | "rejected">,
  ) {
    const normalizedUid = this.normalizeUid(uid);
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(UserFriend);
      const relation = await repository.findOne({
        where: { id: requestId },
        lock: { mode: "pessimistic_write" },
      });
      if (
        !relation ||
        relation.receiver_uid !== normalizedUid ||
        relation.status !== "pending"
      ) {
        throw new Error("申请不存在");
      }
      relation.status = status;
      relation.responded_at = new Date();
      const saved = await repository.save(relation);
      if (status === "accepted") {
        await Promise.all([
          this.socialActivityService?.recordActivity(
            {
              actorUid: relation.requester_uid,
              type: "friend_added",
              title: "添加好友",
              summary: "结交新好友",
              metadata: { friendUid: relation.receiver_uid },
            },
            manager,
          ),
          this.socialActivityService?.recordActivity(
            {
              actorUid: relation.receiver_uid,
              type: "friend_added",
              title: "添加好友",
              summary: "结交新好友",
              metadata: { friendUid: relation.requester_uid },
            },
            manager,
          ),
        ]);
      }
      return this.toRelationRow(
        saved,
        normalizedUid,
        await this.getRelatedUsers(normalizedUid, [saved], manager),
      );
    });
  }

  private normalizeUid(uid: string) {
    const value = String(uid || "").trim();
    if (!value) {
      throw new Error("玩家不存在");
    }
    return value;
  }

  private getRelationKey(uid: string, targetUid: string) {
    return [uid, targetUid].sort().join("::");
  }

  private async findUser(manager: DataSource | EntityManager, uid: string) {
    const user = await manager.getRepository(User).findOne({ where: { uid } });
    if (!user) {
      throw new Error("玩家不存在");
    }
    return user;
  }

  private async findUserByUidOrName(
    manager: DataSource | EntityManager,
    value: string,
  ) {
    const user = await manager.getRepository(User).findOne({
      where: [{ uid: value }, { name: value }],
    });
    if (!user) {
      throw new Error("玩家不存在");
    }
    return user;
  }

  private async getRelatedUsers(
    uid: string,
    relations: UserFriend[],
    manager: DataSource | EntityManager = this.dataSource,
  ) {
    const relatedUids = [
      ...new Set(
        relations
          .map((relation) =>
            relation.requester_uid === uid
              ? relation.receiver_uid
              : relation.requester_uid,
          )
          .filter(Boolean),
      ),
    ];
    if (relatedUids.length === 0) {
      return new Map<string, User>();
    }
    const userRepository = manager.getRepository(User);
    const users = await userRepository.find({
      where: { uid: In(relatedUids) },
    });
    await ensureUsersPublicIds(userRepository, users);
    return new Map(users.map((user) => [user.uid, user]));
  }

  private toRelationRows(
    relations: UserFriend[],
    uid: string,
    userMap: Map<string, User>,
  ) {
    return relations
      .map((relation) => this.toRelationRow(relation, uid, userMap))
      .filter((item) => item !== null);
  }

  private toRelationRow(
    relation: UserFriend,
    uid: string,
    userMap: Map<string, User>,
  ) {
    const relatedUid =
      relation.requester_uid === uid
        ? relation.receiver_uid
        : relation.requester_uid;
    const user = userMap.get(relatedUid);
    if (!user) {
      return null;
    }
    return {
      id: relation.id,
      status: relation.status,
      user: this.toPublicUser(user),
      createdAt: relation.createdAt,
      updatedAt: relation.updatedAt,
      respondedAt: relation.responded_at || null,
    };
  }

  private toPublicUser(user: User) {
    return {
      uid: user.uid,
      publicId: getUserPublicId(user),
      nickname: user.nickname || user.name || "玩家",
      avatar: user.avatar || "",
      createdAt: user.createdAt || null,
    };
  }
}
