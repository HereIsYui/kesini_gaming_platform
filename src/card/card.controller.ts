import { Controller, Post, Get, Body, Param, Query, UseInterceptors, UseFilters } from '@nestjs/common';
import { CardService, GachaConfig, GachaResult } from './card.service';
import { ResponseDto } from 'src/common/dto/response.dto';
import { TransformInterceptor } from 'src/common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from 'src/common/filters/http-exception.filter';

// 抽卡请求DTO
export class DrawCardDto {
    uid: string;
    poolId?: number;      // 指定卡池ID
    config?: GachaConfig; // 可选的自定义配置
}

@Controller('card')
@UseInterceptors(TransformInterceptor)
@UseFilters(HttpExceptionFilter)
export class CardController {
    constructor(private readonly cardService: CardService) {}

    /**
     * 单抽
     * POST /card/draw/once
     */
    @Post('draw/once')
    async drawOnce(@Body() dto: DrawCardDto): Promise<ResponseDto<GachaResult | null>> {
        if (!dto.uid) {
            return ResponseDto.error('缺少必要参数: uid');
        }

        try {
            // 如果指定了卡池ID，合并到配置中
            let config = dto.config;
            if (dto.poolId && config) {
                config.poolId = dto.poolId;
            }
            const result = await this.cardService.drawOnce(dto.uid, config);
            return ResponseDto.success(result, '抽卡成功');
        } catch (error) {
            return ResponseDto.error(error.message || '抽卡失败');
        }
    }

    /**
     * 十连抽
     * POST /card/draw/ten
     */
    @Post('draw/ten')
    async drawTen(@Body() dto: DrawCardDto): Promise<ResponseDto<GachaResult[] | null>> {
        if (!dto.uid) {
            return ResponseDto.error('缺少必要参数: uid');
        }

        try {
            let config = dto.config;
            if (dto.poolId && config) {
                config.poolId = dto.poolId;
            }
            const results = await this.cardService.drawTen(dto.uid, config);
            return ResponseDto.success(results, '十连抽成功');
        } catch (error) {
            return ResponseDto.error(error.message || '十连抽失败');
        }
    }

    /**
     * 自定义多次抽卡
     * POST /card/draw/multiple
     */
    @Post('draw/multiple')
    async drawMultiple(
        @Body() dto: DrawCardDto & { count: number }
    ): Promise<ResponseDto<GachaResult[] | null>> {
        if (!dto.uid) {
            return ResponseDto.error('缺少必要参数: uid');
        }
        if (!dto.count || dto.count <= 0) {
            return ResponseDto.error('缺少必要参数: count，且必须大于0');
        }

        try {
            let config = dto.config;
            if (dto.poolId && config) {
                config.poolId = dto.poolId;
            }
            const results = await this.cardService.drawMultiple(dto.uid, dto.count, config);
            return ResponseDto.success(results, `${dto.count}连抽成功`);
        } catch (error) {
            return ResponseDto.error(error.message || '抽卡失败');
        }
    }

    /**
     * 获取用户抽卡统计
     * GET /card/stats/:uid
     */
    @Get('stats/:uid')
    async getUserStats(@Param('uid') uid: string): Promise<ResponseDto<any>> {
        if (!uid) {
            return ResponseDto.error('缺少必要参数: uid');
        }

        try {
            const stats = await this.cardService.getUserGachaStats(uid);
            return ResponseDto.success(stats, '获取统计成功');
        } catch (error) {
            return ResponseDto.error(error.message || '获取统计失败');
        }
    }

    /**
     * 重置用户抽卡历史
     * POST /card/reset/:uid
     */
    @Post('reset/:uid')
    async resetUserHistory(@Param('uid') uid: string): Promise<ResponseDto<null>> {
        if (!uid) {
            return ResponseDto.error('缺少必要参数: uid');
        }

        try {
            await this.cardService.resetUserHistory(uid);
            return ResponseDto.success(null, '抽卡历史已重置');
        } catch (error) {
            return ResponseDto.error(error.message || '重置失败');
        }
    }

    /**
     * 获取所有卡池列表
     * GET /card/pools
     */
    @Get('pools')
    async getAllPools(): Promise<ResponseDto<any>> {
        try {
            const pools = await this.cardService.getAllPools();
            return ResponseDto.success(pools, '获取卡池列表成功');
        } catch (error) {
            return ResponseDto.error(error.message || '获取卡池列表失败');
        }
    }

    /**
     * 根据卡池ID获取卡池信息
     * GET /card/pool/:poolId
     */
    @Get('pool/:poolId')
    async getPoolById(@Param('poolId') poolId: number): Promise<ResponseDto<any>> {
        if (!poolId) {
            return ResponseDto.error('缺少必要参数: poolId');
        }

        try {
            const pool = await this.cardService.getPoolById(poolId);
            if (!pool) {
                return ResponseDto.error('卡池不存在');
            }
            return ResponseDto.success(pool, '获取卡池信息成功');
        } catch (error) {
            return ResponseDto.error(error.message || '获取卡池信息失败');
        }
    }

    /**
     * 根据卡池类型获取卡池列表
     * GET /card/pools/type/:type
     * @param type 0 常驻卡池 1 活动卡池 2 限定卡池
     */
    @Get('pools/type/:type')
    async getPoolsByType(@Param('type') type: number): Promise<ResponseDto<any>> {
        if (type === undefined || type === null) {
            return ResponseDto.error('缺少必要参数: type');
        }

        try {
            const pools = await this.cardService.getPoolsByType(type);
            return ResponseDto.success(pools, '获取卡池列表成功');
        } catch (error) {
            return ResponseDto.error(error.message || '获取卡池列表失败');
        }
    }

    /**
     * 根据卡池ID获取该卡池的所有卡片
     * GET /card/pool/:poolId/cards
     */
    @Get('pool/:poolId/cards')
    async getCardsByPool(@Param('poolId') poolId: number): Promise<ResponseDto<any>> {
        if (!poolId) {
            return ResponseDto.error('缺少必要参数: poolId');
        }

        try {
            const cards = await this.cardService.getCardsByPool(poolId);
            return ResponseDto.success(cards, '获取卡片列表成功');
        } catch (error) {
            return ResponseDto.error(error.message || '获取卡片列表失败');
        }
    }

    /**
     * 获取用户卡片列表（支持分页）
     * GET /card/:uid/cards?rarity=SSR&poolId=1&page=1&pageSize=10
     * @param uid 用户ID
     * @param rarity 卡片等级筛选 (可选，支持: N, R, SR, SSR, UR)
     * @param poolId 卡池ID筛选 (可选)
     * @param page 页码 (从1开始，默认1)
     * @param pageSize 每页数量 (默认10，最大100)
     */
    @Get('user/:uid/cards')
    async getUserCards(
        @Param('uid') uid: string,
        @Query('rarity') rarity?: string,
        @Query('poolId') poolId?: number,
        @Query('page') page?: number,
        @Query('pageSize') pageSize?: number
    ): Promise<ResponseDto<any>> {
        if (!uid) {
            return ResponseDto.error('缺少必要参数: uid');
        }

        try {
            const result = await this.cardService.getUserCards(
                uid,
                rarity,
                poolId,
                page ? parseInt(page.toString()) : 1,
                pageSize ? parseInt(pageSize.toString()) : 10
            );
            return ResponseDto.success(result, '获取用户卡片列表成功');
        } catch (error) {
            return ResponseDto.error(error.message || '获取用户卡片列表失败');
        }
    }
}
