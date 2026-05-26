import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import { GetUser } from "src/auth/get-user.decorator";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { ResponseDto } from "src/common/dto/response.dto";
import { HttpExceptionFilter } from "src/common/filters/http-exception.filter";
import { TransformInterceptor } from "src/common/interceptors/transform.interceptor";
import {
  ACHIEVEMENT_TARGET_TYPES,
  AchievementService,
} from "src/achievement/achievement.service";
import type { AchievementTargetType } from "src/entity/achievementConfig.entity";
import { AdminGuard } from "./admin.guard";
import { AdminService } from "./admin.service";

class PageDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @IsOptional()
  @IsString()
  keyword?: string;
}

class CardQueryDto extends PageDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  poolId?: number;

  @IsOptional()
  @IsString()
  rarity?: string;
}

class HistoryQueryDto extends PageDto {
  @IsOptional()
  @IsString()
  uid?: string;

  @IsOptional()
  @IsString()
  rarity?: string;

  @IsOptional()
  @IsString()
  start?: string;

  @IsOptional()
  @IsString()
  end?: string;
}

class InventoryQueryDto extends PageDto {
  @IsOptional()
  @IsString()
  uid?: string;
}

class PityQueryDto extends PageDto {
  @IsOptional()
  @IsString()
  uid?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  poolId?: number;
}

class RedeemUsageQueryDto extends PageDto {
  @IsOptional()
  @IsString()
  uid?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  codeId?: number;
}

class ExchangeUsageQueryDto extends PageDto {
  @IsOptional()
  @IsString()
  uid?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  itemId?: number;
}

class TradeListingQueryDto extends PageDto {
  @IsOptional()
  @IsIn(["active", "sold", "cancelled"])
  status?: string;

  @IsOptional()
  @IsString()
  sellerUid?: string;

  @IsOptional()
  @IsString()
  buyerUid?: string;

  @IsOptional()
  @IsString()
  rarity?: string;
}

class TradeRecordQueryDto extends PageDto {
  @IsOptional()
  @IsString()
  uid?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  listingId?: number;
}

class TradeConfigPatchDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  fee_rate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  min_price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  max_price?: number;
}

class RechargeRecordQueryDto extends PageDto {
  @IsOptional()
  @IsString()
  uid?: string;

  @IsOptional()
  @IsString()
  userName?: string;

  @IsOptional()
  @IsIn(["pending", "success", "failed", "local_failed"])
  status?: string;

  @IsOptional()
  @IsString()
  start?: string;

  @IsOptional()
  @IsString()
  end?: string;
}

class RechargeConfigPatchDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  gold_finger_key?: string;

  @IsOptional()
  @IsString()
  fishpi_api_key?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  min_amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  max_amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  recharge_ratio?: number;

  @IsOptional()
  @IsString()
  memo_template?: string;
}

class LaunchActivityClaimQueryDto extends PageDto {
  @IsOptional()
  @IsString()
  uid?: string;

  @IsOptional()
  @IsString()
  activityKey?: string;
}

class LaunchActivityConfigPatchDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  activity_key?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  starts_at?: string;

  @IsOptional()
  @IsDateString()
  ends_at?: string;

  @IsOptional()
  @IsObject()
  rewards?: {
    points: number;
    items: Array<{ itemId: number; num: number }>;
  };
}

class SiteConfigPatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  websiteTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  adminTitle?: string;
}

class AchievementQueryDto extends PageDto {
  @IsOptional()
  @IsString()
  targetType?: string;
}

class UserAchievementQueryDto extends PageDto {
  @IsOptional()
  @IsString()
  uid?: string;

  @IsOptional()
  @IsString()
  achieved?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  achievementId?: number;
}

class AchievementConfigDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsIn(ACHIEVEMENT_TARGET_TYPES)
  target_type?: AchievementTargetType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  target_value?: number;

  @IsOptional()
  @IsObject()
  target_scope?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  rewards?: {
    points: number;
    items: Array<{ itemId: number; num: number }>;
  };

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsDateString()
  starts_at?: string;

  @IsOptional()
  @IsDateString()
  ends_at?: string;
}

class PoolDto {
  @IsOptional()
  @IsString()
  pool_name?: string;

  @IsOptional()
  @IsString()
  card_desc?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  card_type?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

class CardDto {
  @IsOptional()
  @IsString()
  card_name?: string;

  @IsOptional()
  @IsString()
  card_level?: string;

  @IsOptional()
  @IsString()
  drop_item?: string;

  @IsOptional()
  @IsString()
  card_desc?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  card_type?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pool?: number;
}

class DropItemDto {
  @IsOptional()
  @IsString()
  drop_name?: string;

  @IsOptional()
  @IsString()
  drop_desc?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  drop_type?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  drop_item_type?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  drop_item_value?: number;

  @IsOptional()
  @IsBoolean()
  disabled?: boolean;

  @IsOptional()
  @IsBoolean()
  default_fragment?: boolean;
}

class UserPatchDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  point?: number;

  @IsOptional()
  @IsBoolean()
  is_admin?: boolean;
}

class InventoryPatchDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  num: number;
}

class PityPatchDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  draws_since_sr?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  draws_since_ssr?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  draws_since_ur?: number;
}

class GachaConfigPatchDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  poolId?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsObject()
  rarityProbabilities?: Record<string, number>;

  @IsOptional()
  @IsObject()
  upCards?: {
    enabled: boolean;
    cardIds: number[];
    upRate: number;
  } | null;

  @IsOptional()
  @IsObject()
  pitySystem?: {
    enabled: boolean;
    softPity?: { count: number; guaranteedRarity: string };
    hardPity?: { count: number; guaranteedRarity: string };
  } | null;

  @IsOptional()
  @IsObject()
  drawCosts?: {
    once: number;
    ten: number;
  };
}

class GachaConfigCopyDto {
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  targetPoolIds: number[];
}

class RedeemCodeDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  total_limit?: number;

  @IsOptional()
  @IsDateString()
  starts_at?: string;

  @IsOptional()
  @IsDateString()
  ends_at?: string;

  @IsOptional()
  @IsObject()
  rewards?: {
    points: number;
    items: Array<{ itemId: number; num: number }>;
  };
}

class ExchangeShopItemDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  costs?: Array<{ itemId: number; num: number }>;

  @IsOptional()
  @IsObject()
  rewards?: {
    points: number;
    items: Array<{ itemId: number; num: number }>;
    cards?: Array<{ cardId: number; rarity: string; num: number }>;
  };

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  total_limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  user_limit?: number;

  @IsOptional()
  @IsDateString()
  starts_at?: string;

  @IsOptional()
  @IsDateString()
  ends_at?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort_order?: number;
}

interface UserInfo {
  uid: string;
}

@Controller("admin")
@UseGuards(JwtAuthGuard, AdminGuard)
@UseInterceptors(TransformInterceptor)
@UseFilters(HttpExceptionFilter)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly achievementService: AchievementService,
  ) {}

  @Get("me")
  async me(@GetUser() user: UserInfo): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.getMe(user.uid),
      "获取管理员信息成功",
    );
  }

  @Get("dashboard")
  async dashboard(): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.getDashboard(),
      "获取总览成功",
    );
  }

  @Get("options")
  async options(): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.getOptions(),
      "获取后台选项成功",
    );
  }

  @Get("achievements")
  async listAchievements(
    @Query() query: AchievementQueryDto,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.achievementService.listAdminAchievements(query),
      "获取成就配置成功",
    );
  }

  @Post("achievements")
  async createAchievement(
    @Body() body: AchievementConfigDto,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.achievementService.createAchievement(body as any),
      "创建成就成功",
    );
  }

  @Patch("achievements/:id")
  async updateAchievement(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: AchievementConfigDto,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.achievementService.updateAchievement(id, body as any),
      "更新成就成功",
    );
  }

  @Delete("achievements/:id")
  async deleteAchievement(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.achievementService.deleteAchievement(id),
      "删除成就成功",
    );
  }

  @Get("user-achievements")
  async listUserAchievements(
    @Query() query: UserAchievementQueryDto,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.achievementService.listUserAchievements(query),
      "获取玩家成就记录成功",
    );
  }

  @Get("pools")
  async listPools(@Query() query: PageDto): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.listPools(query),
      "获取卡池列表成功",
    );
  }

  @Get("pools/:id")
  async getPool(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.getPool(id),
      "获取卡池详情成功",
    );
  }

  @Post("pools")
  async createPool(@Body() body: PoolDto): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.createPool(body),
      "创建卡池成功",
    );
  }

  @Patch("pools/:id")
  async updatePool(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: PoolDto,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.updatePool(id, body),
      "更新卡池成功",
    );
  }

  @Delete("pools/:id")
  async deletePool(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.deletePool(id),
      "删除卡池成功",
    );
  }

  @Get("cards")
  async listCards(@Query() query: CardQueryDto): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.listCards(query),
      "获取卡片列表成功",
    );
  }

  @Get("cards/:id")
  async getCard(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.getCard(id),
      "获取卡片详情成功",
    );
  }

  @Post("cards")
  async createCard(@Body() body: CardDto): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.createCard(body),
      "创建卡片成功",
    );
  }

  @Patch("cards/:id")
  async updateCard(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: CardDto,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.updateCard(id, body),
      "更新卡片成功",
    );
  }

  @Delete("cards/:id")
  async deleteCard(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.deleteCard(id),
      "删除卡片成功",
    );
  }

  @Get("drop-items")
  async listDropItems(@Query() query: PageDto): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.listDropItems(query),
      "获取物品列表成功",
    );
  }

  @Get("drop-items/:id")
  async getDropItem(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.getDropItem(id),
      "获取物品详情成功",
    );
  }

  @Post("drop-items")
  async createDropItem(@Body() body: DropItemDto): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.createDropItem(body),
      "创建物品成功",
    );
  }

  @Patch("drop-items/:id")
  async updateDropItem(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: DropItemDto,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.updateDropItem(id, body),
      "更新物品成功",
    );
  }

  @Delete("drop-items/:id")
  async deleteDropItem(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.deleteDropItem(id),
      "删除物品成功",
    );
  }

  @Get("users")
  async listUsers(@Query() query: PageDto): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.listUsers(query),
      "获取用户列表成功",
    );
  }

  @Get("users/:id")
  async getUser(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.getUser(id),
      "获取用户详情成功",
    );
  }

  @Patch("users/:id")
  async updateUser(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: UserPatchDto,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.updateUser(id, body),
      "更新用户成功",
    );
  }

  @Get("histories")
  async listHistories(
    @Query() query: HistoryQueryDto,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.listHistories(query),
      "获取抽卡历史成功",
    );
  }

  @Get("inventories")
  async listInventories(
    @Query() query: InventoryQueryDto,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.listInventories(query),
      "获取背包列表成功",
    );
  }

  @Patch("inventories/:id")
  async updateInventory(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: InventoryPatchDto,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.updateInventory(id, body),
      "更新背包成功",
    );
  }

  @Get("pity")
  async listPity(@Query() query: PityQueryDto): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.listPity(query),
      "获取保底状态成功",
    );
  }

  @Patch("pity/:id")
  async updatePity(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: PityPatchDto,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.updatePity(id, body),
      "更新保底状态成功",
    );
  }

  @Get("redeem-codes")
  async listRedeemCodes(@Query() query: PageDto): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.listRedeemCodes(query),
      "获取兑换码列表成功",
    );
  }

  @Get("redeem-codes/:id")
  async getRedeemCode(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.getRedeemCode(id),
      "获取兑换码详情成功",
    );
  }

  @Post("redeem-codes")
  async createRedeemCode(
    @Body() body: RedeemCodeDto,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.createRedeemCode(body as any),
      "创建兑换码成功",
    );
  }

  @Patch("redeem-codes/:id")
  async updateRedeemCode(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: RedeemCodeDto,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.updateRedeemCode(id, body as any),
      "更新兑换码成功",
    );
  }

  @Delete("redeem-codes/:id")
  async deleteRedeemCode(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.deleteRedeemCode(id),
      "删除兑换码成功",
    );
  }

  @Get("redeem-usages")
  async listRedeemUsages(
    @Query() query: RedeemUsageQueryDto,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.listRedeemUsages(query),
      "获取兑换记录成功",
    );
  }

  @Get("exchange-items")
  async listExchangeItems(@Query() query: PageDto): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.listExchangeItems(query),
      "获取兑换商店列表成功",
    );
  }

  @Get("exchange-items/:id")
  async getExchangeItem(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.getExchangeItem(id),
      "获取兑换项详情成功",
    );
  }

  @Post("exchange-items")
  async createExchangeItem(
    @Body() body: ExchangeShopItemDto,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.createExchangeItem(body as any),
      "创建兑换项成功",
    );
  }

  @Patch("exchange-items/:id")
  async updateExchangeItem(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: ExchangeShopItemDto,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.updateExchangeItem(id, body as any),
      "更新兑换项成功",
    );
  }

  @Delete("exchange-items/:id")
  async deleteExchangeItem(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.deleteExchangeItem(id),
      "删除兑换项成功",
    );
  }

  @Get("exchange-usages")
  async listExchangeUsages(
    @Query() query: ExchangeUsageQueryDto,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.listExchangeUsages(query),
      "获取兑换商店记录成功",
    );
  }

  @Get("trade-listings")
  async listTradeListings(
    @Query() query: TradeListingQueryDto,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.listTradeListings(query),
      "获取交易挂单成功",
    );
  }

  @Get("trade-listings/:id")
  async getTradeListing(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.getTradeListing(id),
      "获取交易挂单详情成功",
    );
  }

  @Delete("trade-listings/:id")
  async cancelTradeListing(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.cancelTradeListing(id),
      "取消交易挂单成功",
    );
  }

  @Get("trade-records")
  async listTradeRecords(
    @Query() query: TradeRecordQueryDto,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.listTradeRecords(query),
      "获取交易记录成功",
    );
  }

  @Get("trade-records/:id")
  async getTradeRecord(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.getTradeRecord(id),
      "获取交易记录详情成功",
    );
  }

  @Get("config/trade")
  async getTradeConfig(): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.getTradeConfig(),
      "获取交易配置成功",
    );
  }

  @Patch("config/trade")
  async updateTradeConfig(
    @Body() body: TradeConfigPatchDto,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.updateTradeConfig(body as any),
      "更新交易配置成功",
    );
  }

  @Get("config/recharge")
  async getRechargeConfig(): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.getRechargeConfig(),
      "获取充值配置成功",
    );
  }

  @Patch("config/recharge")
  async updateRechargeConfig(
    @Body() body: RechargeConfigPatchDto,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.updateRechargeConfig(body as any),
      "更新充值配置成功",
    );
  }

  @Get("config/launch-activity")
  async getLaunchActivityConfig(): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.getLaunchActivityConfig(),
      "获取开服活动配置成功",
    );
  }

  @Patch("config/launch-activity")
  async updateLaunchActivityConfig(
    @Body() body: LaunchActivityConfigPatchDto,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.updateLaunchActivityConfig(body as any),
      "更新开服活动配置成功",
    );
  }

  @Get("config/site")
  async getSiteConfig(): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.getSiteConfig(),
      "获取站点配置成功",
    );
  }

  @Patch("config/site")
  async updateSiteConfig(
    @Body() body: SiteConfigPatchDto,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.updateSiteConfig(body),
      "更新站点配置成功",
    );
  }

  @Get("launch-activity-claims")
  async listLaunchActivityClaims(
    @Query() query: LaunchActivityClaimQueryDto,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.listLaunchActivityClaims(query),
      "获取开服活动领取记录成功",
    );
  }

  @Get("recharge-records")
  async listRechargeRecords(
    @Query() query: RechargeRecordQueryDto,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.listRechargeRecords(query),
      "获取充值记录成功",
    );
  }

  @Get("config/gacha")
  async getGachaConfig(): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.getGachaConfig(),
      "获取抽卡配置成功",
    );
  }

  @Patch("config/gacha/:poolId")
  async updateGachaConfig(
    @Param("poolId", ParseIntPipe) poolId: number,
    @Body() body: GachaConfigPatchDto,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.updateGachaConfig(poolId, body as any),
      "更新抽卡配置成功",
    );
  }

  @Post("config/gacha/:poolId/copy")
  async copyGachaConfig(
    @Param("poolId", ParseIntPipe) poolId: number,
    @Body() body: GachaConfigCopyDto,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.copyGachaConfig(poolId, body.targetPoolIds),
      "复制抽卡配置成功",
    );
  }
}
