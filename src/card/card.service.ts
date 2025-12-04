import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CardItem } from 'src/entity/card.entity';
import { PoolInfo } from 'src/entity/pool.entity';
import { User } from 'src/entity/user.entity';
import { UserCard } from 'src/entity/userCard.entity';
import { UserHistory } from 'src/entity/history.entity';
import { DropItem } from 'src/entity/drop.entity';
import { UserInventory } from 'src/entity/inventory.entity';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

// 抽卡配置接口
export interface GachaConfig {
    // 卡池ID (如果指定，则从该卡池抽取)
    poolId?: number;

    // 稀有度概率配置 (总和应为1)
    rarityProbabilities?: {
        [rarity: string]: number; // 如 { 'N': 0.5, 'R': 0.3, 'SR': 0.15, 'SSR': 0.045, 'UR': 0.005 }
    };

    // UP卡配置 (指定UP的卡片ID和UP倍率)
    upCards?: {
        enabled: boolean;
        cardIds: number[]; // UP卡片ID列表
        upRate: number;    // UP倍率 (0-1之间，表示抽到该稀有度时获得UP卡的概率)
    };
}

// 抽卡结果
export interface GachaResult {
    cardId: number;
    cardName: string;
    cardDesc: string;
    rarity: string;
    cardType: number;     // 卡片类型
    poolId: number;       // 所属卡池
    isUp: boolean;        // 是否UP卡
    userCardUuid: string; // 用户卡片唯一ID
}

// 用户抽卡统计
export interface UserGachaStats {
    uid: string;
    totalDraws: number;           // 总抽数
    cardCounts: {
        N: number;
        R: number;
        SR: number;
        SSR: number;
        UR: number;
    };
}

@Injectable()
export class CardService {
    // 默认稀有度概率配置
    private defaultRarityProbabilities = {
        'N': 0.50,    // 50%
        'R': 0.30,    // 30%
        'SR': 0.15,   // 15%
        'SSR': 0.045, // 4.5%
        'UR': 0.005,  // 0.5%
    };

    constructor(
        @InjectRepository(CardItem) private readonly cardRepository: Repository<CardItem>,
        @InjectRepository(PoolInfo) private readonly poolRepository: Repository<PoolInfo>,
        @InjectRepository(User) private readonly userRepository: Repository<User>,
        @InjectRepository(UserCard) private readonly userCardRepository: Repository<UserCard>,
        @InjectRepository(UserHistory) private readonly userCardHistoryRepository: Repository<UserHistory>,
        @InjectRepository(DropItem) private readonly dropRepository: Repository<DropItem>,
        @InjectRepository(UserInventory) private readonly inventoryRepository: Repository<UserInventory>,
    ) { }

    /**
     * 单抽
     * @param uid 用户ID
     * @param config 自定义配置 (可选)
     */
    async drawOnce(uid: string, config?: GachaConfig): Promise<GachaResult> {
        const results = await this.drawMultiple(uid, 1, config);
        return results[0];
    }

    /**
     * 十连抽
     * @param uid 用户ID
     * @param config 自定义配置 (可选)
     */
    async drawTen(uid: string, config?: GachaConfig): Promise<GachaResult[]> {
        return this.drawMultiple(uid, 10, config);
    }

    /**
     * 多次抽卡
     * @param uid 用户ID
     * @param count 抽卡次数
     * @param config 自定义配置 (可选)
     */
    async drawMultiple(uid: string, count: number, config?: GachaConfig): Promise<GachaResult[]> {
        const results: GachaResult[] = [];

        // 如果指定了卡池ID，验证卡池是否存在
        if (config?.poolId) {
            const pool = await this.poolRepository.findOne({ where: { id: config.poolId } });
            if (!pool) {
                throw new Error(`卡池ID ${config.poolId} 不存在`);
            }
        }

        // 确保用户存在
        let user = await this.userRepository.findOne({ where: { uid } });
        if (!user) {
            // 如果用户不存在，创建新用户
            user = new User();
            user.uid = uid;
            user.name = uid;
            user.nickname = uid;
            user.avatar = '';
            user.point = 0;
            user.card_count_n = 0;
            user.card_count_r = 0;
            user.card_count_sr = 0;
            user.card_count_ssr = 0;
            user.card_count_ur = 0;
            await this.userRepository.save(user);
        }

        // 获取概率配置
        const probabilities = config?.rarityProbabilities || this.defaultRarityProbabilities;

        // 用于记录本次抽卡的所有卡片信息
        const cardIds: number[] = [];
        const cardLevels: string[] = [];
        const cardUuids: string[] = [];

        for (let i = 0; i < count; i++) {
            // 根据概率随机抽取稀有度
            const rarity = this.rollRarity(probabilities);

            // 根据稀有度抽取卡片
            const { card, isUp } = await this.getRandomCard(rarity, config);

            if (!card) {
                throw new Error(`没有找到稀有度为 ${rarity} 的卡片`);
            }

            // 创建用户卡片记录
            const userCard = new UserCard();
            userCard.uid = uid;
            userCard.card_id = card.id.toString();
            userCard.can_sell = true;
            userCard.can_lottery = true;
            userCard.card_uuid = uuidv4();

            await this.userCardRepository.save(userCard);

            // 更新用户卡片统计
            await this.updateUserCardCount(uid, rarity);

            // 记录卡片信息
            cardIds.push(card.id);
            cardLevels.push(rarity);
            cardUuids.push(userCard.card_uuid);

            results.push({
                cardId: card.id,
                cardName: card.card_name,
                cardDesc: card.card_desc,
                rarity: rarity,
                cardType: card.card_type,
                poolId: card.pool,
                isUp: isUp,
                userCardUuid: userCard.card_uuid,
            });
        }

        // 保存用户抽卡历史到数据库
        await this.saveUserHistoryToDB(uid, count, cardIds, cardLevels, cardUuids);

        return results;
    }

    /**
     * 根据概率随机抽取稀有度
     */
    private rollRarity(probabilities: { [rarity: string]: number }): string {
        const random = Math.random();
        let cumulative = 0;

        const rarities = Object.keys(probabilities).sort((a, b) => {
            // 按稀有度从低到高排序
            const order = ['N', 'R', 'SR', 'SSR', 'UR'];
            return order.indexOf(a) - order.indexOf(b);
        });

        for (const rarity of rarities) {
            cumulative += probabilities[rarity];
            if (random <= cumulative) {
                return rarity;
            }
        }

        // 兜底返回最低稀有度
        return rarities[0];
    }

    /**
     * 根据稀有度获取随机卡片
     */
    private async getRandomCard(rarity: string, config?: GachaConfig): Promise<{ card: CardItem; isUp: boolean }> {
        // 构建查询条件
        const queryBuilder = this.cardRepository
            .createQueryBuilder('card')
            .where('card.card_level LIKE :rarity', { rarity: `%${rarity}%` });

        // 如果指定了卡池ID，只从该卡池抽取
        if (config?.poolId) {
            queryBuilder.andWhere('card.pool = :poolId', { poolId: config.poolId });
        }

        const cards = await queryBuilder.getMany();

        if (cards.length === 0) {
            throw new Error(`在卡池${config?.poolId || '默认'}中没有找到稀有度为 ${rarity} 的卡片`);
        }

        let isUp = false;

        // 如果有UP卡配置
        if (config?.upCards?.enabled && config.upCards.cardIds.length > 0) {
            const upCards = cards.filter(card =>
                config.upCards!.cardIds.includes(card.id)
            );

            // UP倍率机制：有一定概率抽到UP卡
            if (upCards.length > 0 && Math.random() < config.upCards.upRate) {
                isUp = true;
                const selectedCard = upCards[Math.floor(Math.random() * upCards.length)];
                return { card: selectedCard, isUp };
            }
        }

        // 随机选择一张卡片
        const selectedCard = cards[Math.floor(Math.random() * cards.length)];
        return { card: selectedCard, isUp };
    }

    /**
     * 保存用户抽卡历史到数据库
     */
    private async saveUserHistoryToDB(
        uid: string,
        count: number,
        cardIds: number[],
        cardLevels: string[],
        cardUuids: string[]
    ): Promise<void> {
        const userCardHistory = new UserHistory();
        userCardHistory.uid = uid;
        userCardHistory.count = count;
        userCardHistory.card_ids = cardIds.join(',');
        userCardHistory.card_levels = cardLevels.join(',');
        userCardHistory.card_uuids = cardUuids.join(',');

        await this.userCardHistoryRepository.save(userCardHistory);
    }

    /**
     * 更新用户卡片统计
     */
    private async updateUserCardCount(uid: string, rarity: string): Promise<void> {
        const user = await this.userRepository.findOne({ where: { uid } });
        if (!user) {
            return;
        }

        switch (rarity) {
            case 'N':
                user.card_count_n += 1;
                break;
            case 'R':
                user.card_count_r += 1;
                break;
            case 'SR':
                user.card_count_sr += 1;
                break;
            case 'SSR':
                user.card_count_ssr += 1;
                break;
            case 'UR':
                user.card_count_ur += 1;
                break;
        }

        await this.userRepository.save(user);
    }

    /**
     * 重置用户抽卡历史 (用于测试或特殊情况)
     */
    async resetUserHistory(uid: string): Promise<void> {
        // 删除数据库中的抽卡历史
        await this.userCardHistoryRepository.delete({ uid });

        // 重置用户卡片统计
        const user = await this.userRepository.findOne({ where: { uid } });
        if (user) {
            user.card_count_n = 0;
            user.card_count_r = 0;
            user.card_count_sr = 0;
            user.card_count_ssr = 0;
            user.card_count_ur = 0;
            await this.userRepository.save(user);
        }
    }

    /**
     * 获取用户抽卡统计
     */
    async getUserGachaStats(uid: string): Promise<any> {
        // 获取用户卡片统计
        const user = await this.userRepository.findOne({ where: { uid } });

        // 统计总抽卡次数
        const totalHistory = await this.userCardHistoryRepository
            .createQueryBuilder('history')
            .select('SUM(history.count)', 'total')
            .where('history.uid = :uid', { uid })
            .getRawOne();

        const totalDraws = parseInt(totalHistory?.total || '0');

        // 获取最近的抽卡记录
        const recentHistory = await this.userCardHistoryRepository.find({
            where: { uid },
            order: { createdAt: 'DESC' },
            take: 5
        });

        return {
            uid,
            totalDraws,
            cardCounts: {
                N: user?.card_count_n || 0,
                R: user?.card_count_r || 0,
                SR: user?.card_count_sr || 0,
                SSR: user?.card_count_ssr || 0,
                UR: user?.card_count_ur || 0,
            },
            recentDraws: recentHistory.map(h => ({
                count: h.count,
                cardIds: h.card_ids.split(','),
                cardLevels: h.card_levels.split(','),
                cardUuids: h.card_uuids.split(','),
                createdAt: h.createdAt,
            }))
        };
    }

    /**
     * 获取所有卡池列表
     */
    async getAllPools(): Promise<PoolInfo[]> {
        return this.poolRepository.find();
    }

    /**
     * 根据卡池ID获取卡池信息
     */
    async getPoolById(poolId: number): Promise<PoolInfo | null> {
        return this.poolRepository.findOne({ where: { id: poolId } });
    }

    /**
     * 根据卡池ID获取该卡池的所有卡片
     */
    async getCardsByPool(poolId: number): Promise<CardItem[]> {
        return this.cardRepository.find({ where: { pool: poolId } });
    }

    /**
     * 根据卡池类型获取卡池列表
     * @param cardType 0 常驻卡池 1 活动卡池 2 限定卡池
     */
    async getPoolsByType(cardType: number): Promise<PoolInfo[]> {
        return this.poolRepository.find({ where: { card_type: cardType } });
    }

    /**
     * 获取用户卡片列表（支持分页）
     * @param uid 用户ID
     * @param rarity 卡片等级筛选 (可选，支持: N, R, SR, SSR, UR)
     * @param poolId 卡池ID筛选 (可选)
     * @param page 页码 (从1开始，默认1)
     * @param pageSize 每页数量 (默认10)
     */
    async getUserCards(
        uid: string,
        rarity?: string,
        poolId?: number,
        page: number = 1,
        pageSize: number = 10
    ): Promise<{
        list: any[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    }> {
        // 确保页码和每页数量有效
        page = Math.max(1, page);
        pageSize = Math.min(100, Math.max(1, pageSize)); // 限制最大每页100条

        // 构建用户卡片查询
        const queryBuilder = this.userCardRepository
            .createQueryBuilder('userCard')
            .where('userCard.uid = :uid', { uid });

        // 如果指定了稀有度筛选，使用子查询
        if (rarity) {
            queryBuilder.andWhere(
                'EXISTS (SELECT 1 FROM card_item ci WHERE ci.id = CAST(userCard.card_id AS UNSIGNED) AND ci.card_level LIKE :rarity)',
                { rarity: `%${rarity}%` }
            );
        }

        // 如果指定了卡池ID筛选，使用子查询
        if (poolId) {
            queryBuilder.andWhere(
                'EXISTS (SELECT 1 FROM card_item ci WHERE ci.id = CAST(userCard.card_id AS UNSIGNED) AND ci.pool = :poolId)',
                { poolId }
            );
        }

        // 按ID降序排序，最新的卡片在前
        queryBuilder.orderBy('userCard.id', 'DESC');

        // 先获取总数（应用筛选条件后）
        const total = await queryBuilder.getCount();

        if (total === 0) {
            return {
                list: [],
                total: 0,
                page,
                pageSize,
                totalPages: 0,
            };
        }

        // 分页查询
        const skip = (page - 1) * pageSize;
        const userCards = await queryBuilder
            .skip(skip)
            .take(pageSize)
            .getMany();

        // 获取所有卡片ID（去重）
        const cardIds = [...new Set(userCards.map(uc => parseInt(uc.card_id)))];

        // 批量查询卡片信息
        const cards = await this.cardRepository
            .createQueryBuilder('card')
            .where('card.id IN (:...cardIds)', { cardIds })
            .getMany();

        // 构建返回结果：每个用户卡片UUID对应一条记录
        const list = userCards.map(userCard => {
            const card = cards.find(c => c.id === parseInt(userCard.card_id));
            if (!card) {
                return null;
            }

            return {
                id: userCard.id,
                uuid: userCard.card_uuid, // 每个UUID都是独立的一张卡
                cardName: card.card_name,
                cardDesc: card.card_desc,
                cardLevel: card.card_level,
                cardType: card.card_type,
                poolId: card.pool,
                canSell: userCard.can_sell,
                canLottery: userCard.can_lottery,
                obtainedAt: userCard.createdAt,
            };
        }).filter(item => item !== null);

        const totalPages = Math.ceil(total / pageSize);

        return {
            list,
            total,
            page,
            pageSize,
            totalPages,
        };
    }

    /**
     * 合成卡片
     */
    async synthesizeCard(uid: string, cardId: number) {
        // 检查卡片是否存在
        const card = await this.cardRepository.findOne({ where: { id: cardId } });
        if (!card) {
            throw new Error("卡片不存在");
        }

        // 检查是否为UR卡片
        if (card.card_level.includes('UR')) {
            throw new Error("不能合成UR卡片");
        }

        // 获取合成所需碎片数量
        const requiredFragments = this.getRequiredFragments(card.card_level);
        
        // 查找卡片碎片物品 (drop_type为0的DropItem)
        const fragmentItem = await this.dropRepository.findOne({ 
            where: { drop_type: 0 } 
        });
        
        if (!fragmentItem) {
            throw new Error("卡片碎片物品不存在");
        }

        // 检查用户背包中的碎片数量
        const userInventory = await this.inventoryRepository.findOne({
            where: { user_id: parseInt(uid), item_id: fragmentItem.id }
        });

        const currentFragments = userInventory?.quantity || 0;
        
        if (currentFragments < requiredFragments) {
            throw new Error(`碎片不足，需要${requiredFragments}个碎片，当前拥有${currentFragments}个`);
        }

        // 扣除碎片
        if (userInventory) {
            userInventory.quantity -= requiredFragments;
            // 即使数量为0也不删除记录，只更新数量
            await this.inventoryRepository.save(userInventory);
        }

        // 添加卡片到用户背包
        const userCard = new UserCard();
        userCard.uid = uid;
        userCard.card_id = cardId.toString();
        userCard.card_uuid = uuidv4();
        userCard.can_sell = true;
        userCard.can_lottery = true;
        await this.userCardRepository.save(userCard);

        return {
            data: {
                card_id: cardId,
                card_name: card.card_name,
                fragments_used: requiredFragments,
                user_card_uuid: userCard.card_uuid
            },
            msg: "合成成功"
        };
    }

    /**
     * 分解卡片
     */
    async decomposeCard(uid: string, cardId: number) {
        // 检查卡片是否存在
        const card = await this.cardRepository.findOne({ where: { id: cardId } });
        if (!card) {
            throw new Error("卡片不存在");
        }

        // 检查是否为UR卡片
        if (card.card_level.includes('UR')) {
            throw new Error("UR卡片不可以分解");
        }

        // 获取分解可获得的碎片数量范围
        const fragmentRange = this.getDecomposeFragmentRange(card.card_level);
        
        // 随机生成碎片数量
        const fragmentCount = Math.floor(Math.random() * (fragmentRange.max - fragmentRange.min + 1)) + fragmentRange.min;

        // 查找卡片碎片物品
        const fragmentItem = await this.dropRepository.findOne({ 
            where: { drop_type: 0 } 
        });
        
        if (!fragmentItem) {
            throw new Error("卡片碎片物品不存在");
        }

        // 检查用户是否拥有这张卡片
        const userCard = await this.userCardRepository.findOne({
            where: { uid: uid, card_id: cardId.toString() }
        });

        if (!userCard) {
            throw new Error("用户没有这张卡片");
        }

        // 删除用户卡片
        await this.userCardRepository.remove(userCard);

        // 添加碎片到用户背包
        let userInventory = await this.inventoryRepository.findOne({
            where: { user_id: parseInt(uid), item_id: fragmentItem.id }
        });

        if (!userInventory) {
            userInventory = new UserInventory();
            userInventory.user_id = parseInt(uid);
            userInventory.item_id = fragmentItem.id;
            userInventory.quantity = fragmentCount;
            await this.inventoryRepository.save(userInventory);
        } else {
            userInventory.quantity += fragmentCount;
            await this.inventoryRepository.save(userInventory);
        }

        return {
            data: {
                card_id: cardId,
                card_name: card.card_name,
                fragments_gained: fragmentCount
            },
            msg: "分解成功"
        };
    }

    /**
     * 根据卡片等级获取合成所需碎片数量
     */
    private getRequiredFragments(cardLevel: string): number {
        if (cardLevel.includes('N')) return 80;
        if (cardLevel.includes('R')) return 160;
        if (cardLevel.includes('SR')) return 320;
        if (cardLevel.includes('SSR')) return 1000;
        throw new Error("未知的卡片等级");
    }

    /**
     * 根据卡片等级获取分解碎片数量范围
     */
    private getDecomposeFragmentRange(cardLevel: string): { min: number; max: number } {
        if (cardLevel.includes('N')) return { min: 1, max: 10 };
        if (cardLevel.includes('R')) return { min: 10, max: 20 };
        if (cardLevel.includes('SR')) return { min: 20, max: 40 };
        if (cardLevel.includes('SSR')) return { min: 40, max: 80 };
        throw new Error("未知的卡片等级");
    }
}
