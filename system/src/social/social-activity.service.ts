import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager, In } from "typeorm";
import { User } from "src/entity/user.entity";
import { UserFriend } from "src/entity/userFriend.entity";
import {
  ensureUsersPublicIds,
  getUserPublicId,
} from "src/utils/user-public-id";
import {
  UserSocialActivity,
  UserSocialActivityType,
} from "src/entity/userSocialActivity.entity";

export interface SocialActivityInput {
  actorUid: string;
  type: UserSocialActivityType;
  title: string;
  summary?: string;
  metadata?: Record<string, unknown> | null;
}

const DEFAULT_FEED_LIMIT = 20;

@Injectable()
export class SocialActivityService {
  constructor(private readonly dataSource: DataSource) {}

  async recordActivity(
    input: SocialActivityInput,
    manager: DataSource | EntityManager = this.dataSource,
  ) {
    const actorUid = this.normalizeText(input.actorUid, 255);
    const title = this.normalizeText(input.title, 80);
    if (!actorUid || !title) {
      return null;
    }

    const repository = manager.getRepository(UserSocialActivity);
    try {
      return await repository.save(
        repository.create({
          actor_uid: actorUid,
          activity_type: input.type,
          title,
          summary: this.normalizeText(input.summary || "", 160),
          metadata: this.sanitizeMetadata(input.metadata),
        }),
      );
    } catch {
      return null;
    }
  }

  async listFriendFeed(uid: string, rawLimit = DEFAULT_FEED_LIMIT) {
    const normalizedUid = this.normalizeUid(uid);
    const friendUids = await this.getAcceptedFriendUids(normalizedUid);
    if (friendUids.length === 0) {
      return { list: [] };
    }

    const activities = await this.dataSource
      .getRepository(UserSocialActivity)
      .find({
        where: { actor_uid: In(friendUids) },
        order: { createdAt: "DESC", id: "DESC" } as any,
        take: this.normalizeLimit(rawLimit),
      });
    if (activities.length === 0) {
      return { list: [] };
    }

    const userRepository = this.dataSource.getRepository(User);
    const users = await userRepository.find({
      where: { uid: In([...new Set(activities.map((item) => item.actor_uid))]) },
    });
    await ensureUsersPublicIds(userRepository, users);
    const userMap = new Map(users.map((user) => [user.uid, user]));

    return {
      list: activities.map((activity) =>
        this.toActivityView(activity, userMap.get(activity.actor_uid)),
      ),
    };
  }

  private async getAcceptedFriendUids(uid: string) {
    const relations = await this.dataSource.getRepository(UserFriend).find({
      where: [
        { requester_uid: uid, status: "accepted" },
        { receiver_uid: uid, status: "accepted" },
      ],
    });
    return [
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
  }

  private toActivityView(activity: UserSocialActivity, user?: User) {
    return {
      id: activity.id,
      type: activity.activity_type,
      title: activity.title,
      summary: activity.summary || "",
      createdAt: activity.createdAt,
      user: {
        uid: activity.actor_uid,
        publicId: user ? getUserPublicId(user) : activity.actor_uid,
        nickname: this.publicName(user, activity.actor_uid),
        avatar: user?.avatar || "",
      },
    };
  }

  private normalizeUid(uid: string) {
    const value = this.normalizeText(uid, 255);
    if (!value) {
      throw new Error("玩家不存在");
    }
    return value;
  }

  private normalizeLimit(value: number) {
    const limit = Number(value || DEFAULT_FEED_LIMIT);
    if (!Number.isInteger(limit) || limit <= 0) {
      return DEFAULT_FEED_LIMIT;
    }
    return Math.min(50, limit);
  }

  private normalizeText(value: string, maxLength: number) {
    return String(value || "")
      .trim()
      .slice(0, maxLength);
  }

  private sanitizeMetadata(value?: Record<string, unknown> | null) {
    if (!value) {
      return null;
    }
    try {
      return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private publicName(user: User | undefined, uid: string) {
    const nickname = String(user?.nickname || "").trim();
    const name = String(user?.name || "").trim();
    if (nickname && nickname !== uid) {
      return nickname;
    }
    if (name && name !== uid) {
      return name;
    }
    return "玩家";
  }
}
