import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { DailySignInRecord } from "src/entity/dailySignInRecord.entity";
import { User } from "src/entity/user.entity";
import { PointLedgerService } from "src/point-ledger/point-ledger.service";

const NORMAL_REWARD = 10;
const CYCLE_REWARD = 100;
const CYCLE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const SIGN_IN_OFFSET_MS = 8 * 60 * 60 * 1000;

export interface DailySignInStatus {
  signedToday: boolean;
  signDate: string;
  currentStreak: number;
  cycleDay: number;
  rewardPoints: number;
  nextRewardPoints: number;
  week: Array<{
    day: number;
    rewardPoints: number;
    signed: boolean;
    current: boolean;
  }>;
}

@Injectable()
export class DailySignInService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly pointLedgerService: PointLedgerService,
  ) {}

  async getStatus(uid: string): Promise<DailySignInStatus> {
    const today = this.getDateKey();
    const latest = await this.findLatestRecord(uid);
    return this.buildStatus(today, latest);
  }

  async claim(uid: string) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const userRepository = manager.getRepository(User);
        const recordRepository = manager.getRepository(DailySignInRecord);
        const today = this.getDateKey();

        const existing = await recordRepository.findOne({
          where: { uid, sign_date: today },
        });
        if (existing) {
          throw new Error("今日已签到");
        }

        const latest = await this.findLatestRecord(uid, manager);
        const streak = this.isYesterday(latest?.sign_date, today)
          ? Number(latest?.streak_count || 0) + 1
          : 1;
        const cycleDay = this.toCycleDay(streak);
        const rewardPoints = this.getRewardPoints(cycleDay);

        const user = await userRepository.findOne({
          where: { uid },
          lock: { mode: "pessimistic_write" },
        });
        if (!user) {
          throw new Error("用户不存在");
        }

        const ledger = await this.pointLedgerService.applyChange(
          manager,
          user,
          rewardPoints,
          {
            sourceType: "daily_sign_in",
            sourceId: today,
            title: cycleDay === CYCLE_DAYS ? "七日签到" : "每日签到",
            metadata: {
              signDate: today,
              streakCount: streak,
              cycleDay,
              rewardPoints,
            },
          },
        );

        const record = recordRepository.create({
          uid,
          sign_date: today,
          streak_count: streak,
          cycle_day: cycleDay,
          reward_points: rewardPoints,
        });
        await recordRepository.save(record);

        return {
          ...this.buildStatus(today, record),
          rewardPoints,
          pointBefore: ledger.point_before,
          pointAfter: ledger.point_after,
        };
      });
    } catch (error) {
      if (this.isDuplicateSignInError(error)) {
        throw new Error("今日已签到");
      }
      throw error;
    }
  }

  private async findLatestRecord(
    uid: string,
    manager: DataSource | EntityManager = this.dataSource,
  ) {
    const repository = manager.getRepository(DailySignInRecord);
    const [latest] = await repository.find({
      where: { uid },
      order: { sign_date: "DESC", id: "DESC" },
      take: 1,
    });
    return latest || null;
  }

  private buildStatus(
    today: string,
    latest: DailySignInRecord | null,
  ): DailySignInStatus {
    const signedToday = latest?.sign_date === today;
    const continuous = signedToday || this.isYesterday(latest?.sign_date, today);
    const currentStreak = continuous ? Number(latest?.streak_count || 0) : 0;
    const cycleDay = signedToday
      ? Number(latest?.cycle_day || 1)
      : this.toCycleDay(currentStreak + 1);
    const rewardPoints = signedToday
      ? Number(latest?.reward_points || this.getRewardPoints(cycleDay))
      : this.getRewardPoints(cycleDay);

    return {
      signedToday,
      signDate: today,
      currentStreak,
      cycleDay,
      rewardPoints,
      nextRewardPoints: signedToday
        ? this.getRewardPoints(this.toCycleDay(currentStreak + 1))
        : rewardPoints,
      week: this.buildWeek(cycleDay, signedToday),
    };
  }

  private buildWeek(cycleDay: number, signedToday: boolean) {
    return Array.from({ length: CYCLE_DAYS }, (_, index) => {
      const day = index + 1;
      return {
        day,
        rewardPoints: this.getRewardPoints(day),
        signed: signedToday ? day <= cycleDay : day < cycleDay,
        current: day === cycleDay,
      };
    });
  }

  private toCycleDay(streak: number) {
    return ((Math.max(1, streak) - 1) % CYCLE_DAYS) + 1;
  }

  private getRewardPoints(cycleDay: number) {
    return cycleDay === CYCLE_DAYS ? CYCLE_REWARD : NORMAL_REWARD;
  }

  private isDuplicateSignInError(error: unknown) {
    const value = error as { code?: string; errno?: number };
    return value?.code === "ER_DUP_ENTRY" || value?.errno === 1062;
  }

  private isYesterday(dateKey: string | undefined, todayKey: string) {
    if (!dateKey) {
      return false;
    }
    return dateKey === this.shiftDateKey(todayKey, -1);
  }

  private getDateKey(date = new Date()) {
    return new Date(date.getTime() + SIGN_IN_OFFSET_MS)
      .toISOString()
      .slice(0, 10);
  }

  private shiftDateKey(dateKey: string, deltaDays: number) {
    return new Date(
      new Date(`${dateKey}T00:00:00.000Z`).getTime() + deltaDays * DAY_MS,
    )
      .toISOString()
      .slice(0, 10);
  }
}
