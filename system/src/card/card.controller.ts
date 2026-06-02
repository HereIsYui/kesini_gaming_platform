import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseInterceptors,
  UseFilters,
  UseGuards,
  ParseIntPipe,
} from "@nestjs/common";
import { Type } from "class-transformer";
import { CardService } from "./card.service";
import { ResponseDto } from "src/common/dto/response.dto";
import { TransformInterceptor } from "src/common/interceptors/transform.interceptor";
import { HttpExceptionFilter } from "src/common/filters/http-exception.filter";
import type { GachaResult, LeaderboardResponse } from "src/types/api";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { GetUser } from "src/auth/get-user.decorator";
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

// 抽卡请求DTO
export class DrawCardDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  poolId?: number; // 指定卡池ID
}

export class DrawMultipleDto extends DrawCardDto {
  @Type(() => Number)
  @IsInt()
  @IsIn([1, 10])
  count: number;
}

export class SynthesizeCardDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  card_id: number;

  @IsOptional()
  @IsIn(["N", "R", "SR", "SSR", "UR"])
  rarity?: string;
}

export class DecomposeCardDto {
  @IsString()
  @IsNotEmpty()
  card_uuid: string;
}

export class BulkDecomposeDto {
  @IsArray()
  @IsIn(["N", "R", "SR", "SSR"], { each: true })
  rarities: string[];
}

export class LockUserCardDto {
  @IsBoolean()
  locked: boolean;
}

// 用户信息接口
interface UserInfo {
  uid: string;
}

@Controller("card")
@UseInterceptors(TransformInterceptor)
@UseFilters(HttpExceptionFilter)
export class CardController {
  constructor(private readonly cardService: CardService) {}

  private parseOptionalInt(
    value: string | undefined,
    fieldName: string,
    min: number,
    max?: number,
  ): number | undefined {
    if (value === undefined) {
      return undefined;
    }

    const parsed = Number(value);
    if (
      !Number.isInteger(parsed) ||
      parsed < min ||
      (max !== undefined && parsed > max)
    ) {
      throw new Error(`${fieldName}参数无效`);
    }
    return parsed;
  }

  private parseRarityQuery(value?: string): string[] {
    return String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  /**
   * 单抽
   * POST /card/draw/once
   */
  @Post("draw/once")
  @UseGuards(JwtAuthGuard)
  async drawOnce(
    @Body() dto: DrawCardDto,
    @GetUser() user: UserInfo,
  ): Promise<ResponseDto<GachaResult | null>> {
    if (!user || !user.uid) {
      return ResponseDto.error("用户身份验证失败");
    }

    try {
      const result = await this.cardService.drawOnce(user.uid, dto.poolId);
      return ResponseDto.success(result, "抽卡成功");
    } catch (error) {
      return ResponseDto.error(error.message || "抽卡失败");
    }
  }

  /**
   * 十连抽
   * POST /card/draw/ten
   */
  @Post("draw/ten")
  @UseGuards(JwtAuthGuard)
  async drawTen(
    @Body() dto: DrawCardDto,
    @GetUser() user: UserInfo,
  ): Promise<ResponseDto<GachaResult[] | null>> {
    if (!user || !user.uid) {
      return ResponseDto.error("用户身份验证失败");
    }

    try {
      const results = await this.cardService.drawTen(user.uid, dto.poolId);
      return ResponseDto.success(results, "十连抽成功");
    } catch (error) {
      return ResponseDto.error(error.message || "十连抽失败");
    }
  }

  /**
   * 自定义多次抽卡
   * POST /card/draw/multiple
   */
  @Post("draw/multiple")
  @UseGuards(JwtAuthGuard)
  async drawMultiple(
    @Body() dto: DrawMultipleDto,
    @GetUser() user: UserInfo,
  ): Promise<ResponseDto<GachaResult[] | null>> {
    if (!user || !user.uid) {
      return ResponseDto.error("用户身份验证失败");
    }

    try {
      const results = await this.cardService.drawMultiple(
        user.uid,
        dto.count,
        dto.poolId,
      );
      return ResponseDto.success(results, `${dto.count}连抽成功`);
    } catch (error) {
      return ResponseDto.error(error.message || "抽卡失败");
    }
  }

  /**
   * 获取用户抽卡统计
   * GET /card/stats
   */
  @Get("stats")
  @UseGuards(JwtAuthGuard)
  async getUserStats(@GetUser() user: UserInfo): Promise<ResponseDto<any>> {
    if (!user || !user.uid) {
      return ResponseDto.error("用户身份验证失败");
    }

    try {
      const stats = await this.cardService.getUserGachaStats(user.uid);
      return ResponseDto.success(stats, "获取统计成功");
    } catch (error) {
      return ResponseDto.error(error.message || "获取统计失败");
    }
  }

  /**
   * 获取用户抽卡历史详情
   * GET /card/history?page=1&pageSize=10
   */
  @Get("history")
  @UseGuards(JwtAuthGuard)
  async getUserDrawHistory(
    @GetUser() user: UserInfo,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ): Promise<ResponseDto<any>> {
    if (!user || !user.uid) {
      return ResponseDto.error("用户身份验证失败");
    }

    try {
      const result = await this.cardService.getUserDrawHistory(
        user.uid,
        this.parseOptionalInt(page, "page", 1) || 1,
        this.parseOptionalInt(pageSize, "pageSize", 1, 50) || 10,
      );
      return ResponseDto.success(result, "获取抽卡历史成功");
    } catch (error) {
      return ResponseDto.error(error.message || "获取抽卡历史失败");
    }
  }

  /**
   * 获取玩家排行榜
   * GET /card/leaderboard?limit=50
   */
  @Get("leaderboard")
  @UseGuards(JwtAuthGuard)
  async getLeaderboard(
    @GetUser() user: UserInfo,
    @Query("limit") limit?: string,
  ): Promise<ResponseDto<LeaderboardResponse | null>> {
    if (!user || !user.uid) {
      return ResponseDto.error("用户身份验证失败");
    }

    try {
      const leaderboard = await this.cardService.getLeaderboard(
        user.uid,
        this.parseOptionalInt(limit, "limit", 1) || 50,
      );
      return ResponseDto.success(leaderboard, "获取排行榜成功");
    } catch (error) {
      return ResponseDto.error(error.message || "获取排行榜失败");
    }
  }

  /**
   * 重置用户抽卡历史
   * POST /card/reset
   */
  @Post("reset")
  @UseGuards(JwtAuthGuard)
  async resetUserHistory(
    @GetUser() user: UserInfo,
  ): Promise<ResponseDto<null>> {
    if (!user || !user.uid) {
      return ResponseDto.error("用户身份验证失败");
    }

    try {
      await this.cardService.resetUserHistory(user.uid);
      return ResponseDto.success(null, "抽卡历史已重置");
    } catch (error) {
      return ResponseDto.error(error.message || "重置失败");
    }
  }

  /**
   * 获取所有卡池列表
   * GET /card/pools
   */
  @Get("pools")
  async getAllPools(): Promise<ResponseDto<any>> {
    try {
      const pools = await this.cardService.getAllPools();
      return ResponseDto.success(pools, "获取卡池列表成功");
    } catch (error) {
      return ResponseDto.error(error.message || "获取卡池列表失败");
    }
  }

  /**
   * 根据卡池ID获取卡池信息
   * GET /card/pool/:poolId
   */
  @Get("pool/:poolId")
  async getPoolById(
    @Param("poolId", ParseIntPipe) poolId: number,
  ): Promise<ResponseDto<any>> {
    try {
      const pool = await this.cardService.getPoolById(poolId);
      if (!pool) {
        return ResponseDto.error("卡池不存在");
      }
      return ResponseDto.success(pool, "获取卡池信息成功");
    } catch (error) {
      return ResponseDto.error(error.message || "获取卡池信息失败");
    }
  }

  /**
   * 根据卡池类型获取卡池列表
   * GET /card/pools/type/:type
   * @param type 0 常驻卡池 1 活动卡池 2 限定卡池 3 轮转卡池
   */
  @Get("pools/type/:type")
  async getPoolsByType(
    @Param("type", ParseIntPipe) type: number,
  ): Promise<ResponseDto<any>> {
    try {
      const pools = await this.cardService.getPoolsByType(type);
      return ResponseDto.success(pools, "获取卡池列表成功");
    } catch (error) {
      return ResponseDto.error(error.message || "获取卡池列表失败");
    }
  }

  /**
   * 根据卡池ID获取该卡池的所有卡片
   * GET /card/pool/:poolId/cards
   */
  @Get("pool/:poolId/cards")
  async getCardsByPool(
    @Param("poolId", ParseIntPipe) poolId: number,
  ): Promise<ResponseDto<any>> {
    try {
      const cards = await this.cardService.getCardsByPool(poolId);
      return ResponseDto.success(cards, "获取卡片列表成功");
    } catch (error) {
      return ResponseDto.error(error.message || "获取卡片列表失败");
    }
  }

  /**
   * 获取当前用户卡池图鉴状态
   * GET /card/user/catalog?poolId=1
   */
  @Get("user/catalog")
  @UseGuards(JwtAuthGuard)
  async getUserCatalog(
    @GetUser() user: UserInfo,
    @Query("poolId") poolId?: string,
  ): Promise<ResponseDto<any>> {
    if (!user || !user.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      const parsedPoolId = this.parseOptionalInt(poolId, "poolId", 1);
      if (!parsedPoolId) {
        return ResponseDto.error("请选择卡池");
      }
      const result = await this.cardService.getUserCatalog(
        user.uid,
        parsedPoolId,
      );
      return ResponseDto.success(result, "获取图鉴成功");
    } catch (error) {
      return ResponseDto.error(error.message || "获取图鉴失败");
    }
  }

  /**
   * 获取用户卡片列表（支持分页）
   * GET /card/user/cards?rarity=SSR&poolId=1&page=1&pageSize=10
   * @param rarity 卡片等级筛选 (可选，支持: N, R, SR, SSR, UR)
   * @param poolId 卡池ID筛选 (可选)
   * @param page 页码 (从1开始，默认1)
   * @param pageSize 每页数量 (默认10，最大100)
   * @param newOnly 仅返回最近获得的卡片
   */
  @Get("user/cards")
  @UseGuards(JwtAuthGuard)
  async getUserCards(
    @GetUser() user: UserInfo,
    @Query("rarity") rarity?: string,
    @Query("poolId") poolId?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("grouped") grouped?: string,
    @Query("newOnly") newOnly?: string,
  ): Promise<ResponseDto<any>> {
    if (!user || !user.uid) {
      return ResponseDto.error("用户身份验证失败");
    }

    try {
      const result = await this.cardService.getUserCards(
        user.uid,
        rarity,
        this.parseOptionalInt(poolId, "poolId", 0),
        this.parseOptionalInt(page, "page", 1) || 1,
        this.parseOptionalInt(pageSize, "pageSize", 1, 100) || 10,
        grouped === "true",
        newOnly === "true",
      );
      return ResponseDto.success(result, "获取用户卡片列表成功");
    } catch (error) {
      return ResponseDto.error(error.message || "获取用户卡片列表失败");
    }
  }

  /**
   * 切换用户卡片锁定状态
   * PATCH /card/user/cards/:uuid/lock
   */
  @Patch("user/cards/:uuid/lock")
  @UseGuards(JwtAuthGuard)
  async updateUserCardLock(
    @Param("uuid") uuid: string,
    @Body() body: LockUserCardDto,
    @GetUser() user: UserInfo,
  ): Promise<ResponseDto<any>> {
    if (!user || !user.uid) {
      return ResponseDto.error("用户身份验证失败");
    }

    try {
      const result = await this.cardService.updateUserCardLock(
        user.uid,
        uuid,
        body.locked,
      );
      return ResponseDto.success(
        result,
        body.locked ? "卡片已锁定" : "卡片已解锁",
      );
    } catch (error) {
      return ResponseDto.error(error.message || "切换锁定状态失败");
    }
  }

  /**
   * 获取卡片养成升级预览
   * GET /card/user/cards/:uuid/upgrade-preview
   */
  @Get("user/cards/:uuid/upgrade-preview")
  @UseGuards(JwtAuthGuard)
  async getUserCardUpgradePreview(
    @Param("uuid") uuid: string,
    @GetUser() user: UserInfo,
  ): Promise<ResponseDto<any>> {
    if (!user || !user.uid) {
      return ResponseDto.error("用户身份验证失败");
    }

    try {
      const result = await this.cardService.getUserCardUpgradePreview(
        user.uid,
        uuid,
      );
      return ResponseDto.success(result, "获取养成预览成功");
    } catch (error) {
      return ResponseDto.error(error.message || "获取养成预览失败");
    }
  }

  /**
   * 升级玩家卡片养成等级
   * POST /card/user/cards/:uuid/upgrade
   */
  @Post("user/cards/:uuid/upgrade")
  @UseGuards(JwtAuthGuard)
  async upgradeUserCard(
    @Param("uuid") uuid: string,
    @GetUser() user: UserInfo,
  ): Promise<ResponseDto<any>> {
    if (!user || !user.uid) {
      return ResponseDto.error("用户身份验证失败");
    }

    try {
      const result = await this.cardService.upgradeUserCard(user.uid, uuid);
      return ResponseDto.success(result, "养成成功");
    } catch (error) {
      return ResponseDto.error(error.message || "养成失败");
    }
  }

  /**
   * 合成卡片
   * POST /card/synthesize
   */
  @Post("synthesize")
  @UseGuards(JwtAuthGuard)
  async synthesizeCard(
    @Body() body: SynthesizeCardDto,
    @GetUser() user: UserInfo,
  ): Promise<ResponseDto<any>> {
    if (!user || !user.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      const result = await this.cardService.synthesizeCard(
        user.uid,
        body.card_id,
        body.rarity,
      );
      return ResponseDto.success(result.data, result.msg || "合成成功");
    } catch (error) {
      return ResponseDto.error(error.message || "合成失败");
    }
  }

  /**
   * 分解卡片
   * POST /card/decompose
   */
  @Post("decompose")
  @UseGuards(JwtAuthGuard)
  async decomposeCard(
    @Body() body: DecomposeCardDto,
    @GetUser() user: UserInfo,
  ): Promise<ResponseDto<any>> {
    if (!user || !user.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      const result = await this.cardService.decomposeCard(
        user.uid,
        body.card_uuid,
      );
      return ResponseDto.success(result.data, result.msg || "分解成功");
    } catch (error) {
      return ResponseDto.error(error.message || "分解失败");
    }
  }

  /**
   * 一键分解预览
   * GET /card/decompose/bulk-preview?rarities=N,R
   */
  @Get("decompose/bulk-preview")
  @UseGuards(JwtAuthGuard)
  async previewBulkDecompose(
    @Query("rarities") rarities: string | undefined,
    @GetUser() user: UserInfo,
  ): Promise<ResponseDto<any>> {
    if (!user || !user.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      const result = await this.cardService.previewBulkDecompose(
        user.uid,
        this.parseRarityQuery(rarities),
      );
      return ResponseDto.success(result, "获取一键分解预览成功");
    } catch (error) {
      return ResponseDto.error(error.message || "获取一键分解预览失败");
    }
  }

  /**
   * 一键分解卡片
   * POST /card/decompose/bulk
   */
  @Post("decompose/bulk")
  @UseGuards(JwtAuthGuard)
  async bulkDecomposeCards(
    @Body() body: BulkDecomposeDto,
    @GetUser() user: UserInfo,
  ): Promise<ResponseDto<any>> {
    if (!user || !user.uid) {
      return ResponseDto.error("用户身份验证失败");
    }
    try {
      const result = await this.cardService.bulkDecomposeCards(
        user.uid,
        body.rarities,
      );
      return ResponseDto.success(result, "一键分解成功");
    } catch (error) {
      return ResponseDto.error(error.message || "一键分解失败");
    }
  }
}
