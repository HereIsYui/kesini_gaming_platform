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
  IsDateString,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { GetUser } from "src/auth/get-user.decorator";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { ResponseDto } from "src/common/dto/response.dto";
import { HttpExceptionFilter } from "src/common/filters/http-exception.filter";
import { TransformInterceptor } from "src/common/interceptors/transform.interceptor";
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

interface UserInfo {
  uid: string;
}

@Controller("admin")
@UseGuards(JwtAuthGuard, AdminGuard)
@UseInterceptors(TransformInterceptor)
@UseFilters(HttpExceptionFilter)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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
      "获取掉落物列表成功",
    );
  }

  @Get("drop-items/:id")
  async getDropItem(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.getDropItem(id),
      "获取掉落物详情成功",
    );
  }

  @Post("drop-items")
  async createDropItem(@Body() body: DropItemDto): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.createDropItem(body),
      "创建掉落物成功",
    );
  }

  @Patch("drop-items/:id")
  async updateDropItem(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: DropItemDto,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.updateDropItem(id, body),
      "更新掉落物成功",
    );
  }

  @Delete("drop-items/:id")
  async deleteDropItem(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ResponseDto<any>> {
    return ResponseDto.success(
      await this.adminService.deleteDropItem(id),
      "删除掉落物成功",
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
}
