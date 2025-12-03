/**
 * 抽卡系统使用示例
 * 展示如何在实际项目中使用抽卡服务
 */

import { CardService } from './card.service';
import { 
    standardPoolConfig, 
    limitedPoolConfig, 
    beginnerPoolConfig,
    eventPoolConfig 
} from './gacha.config.example';

/**
 * 示例1: 基础抽卡 - 使用默认配置
 */
export async function basicDrawExample(cardService: CardService) {
    const uid = 'user123';
    
    // 单抽
    const singleResult = await cardService.drawOnce(uid);
    console.log('单抽结果:', singleResult);
    
    // 十连抽
    const tenResults = await cardService.drawTen(uid);
    console.log('十连抽结果:', tenResults);
}

/**
 * 示例2: 从指定卡池抽取
 */
export async function poolDrawExample(cardService: CardService) {
    const uid = 'user456';
    
    // 从卡池1（常驻卡池）抽取
    const result1 = await cardService.drawOnce(uid, { 
        ...standardPoolConfig,
        poolId: 1 
    });
    
    // 从卡池2（限定卡池）十连抽
    const results2 = await cardService.drawTen(uid, {
        ...limitedPoolConfig,
        poolId: 2
    });
    
    console.log('常驻卡池结果:', result1);
    console.log('限定卡池结果:', results2);
}

/**
 * 示例3: 使用UP卡配置
 */
export async function upCardDrawExample(cardService: CardService) {
    const uid = 'user789';
    
    // 配置UP卡池
    const upConfig = {
        poolId: 2,
        rarityProbabilities: {
            'N': 0.45,
            'R': 0.30,
            'SR': 0.18,
            'SSR': 0.06,
            'UR': 0.01,
        },
        pitySystem: {
            enabled: true,
            softPity: {
                count: 10,
                guaranteedRarity: 'SR',
            },
            hardPity: {
                count: 80,
                guaranteedRarity: 'SSR',
            },
        },
        upCards: {
            enabled: true,
            cardIds: [101, 102, 103], // UP卡片ID
            upRate: 0.5, // 50%概率获得UP卡
        },
    };
    
    const results = await cardService.drawTen(uid, upConfig);
    
    // 统计UP卡数量
    const upCardCount = results.filter(r => r.isUp).length;
    console.log(`抽到 ${upCardCount} 张UP卡`);
    
    // 统计各稀有度数量
    const rarityCount = results.reduce((acc, r) => {
        acc[r.rarity] = (acc[r.rarity] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    console.log('稀有度分布:', rarityCount);
}

/**
 * 示例4: 新手卡池 - 高概率
 */
export async function beginnerDrawExample(cardService: CardService) {
    const uid = 'newbie001';
    
    // 新手十连抽（高概率）
    const results = await cardService.drawTen(uid, beginnerPoolConfig);
    
    // 统计稀有度
    const ssrCount = results.filter(r => r.rarity === 'SSR' || r.rarity === 'UR').length;
    console.log('高稀有度卡片数量:', ssrCount);
    
    return results;
}

/**
 * 示例5: 活动卡池
 */
export async function eventDrawExample(cardService: CardService) {
    const uid = 'event_user';
    
    // 活动池配置
    const eventConfig = {
        poolId: 4, // 活动卡池ID
        ...eventPoolConfig,
        upCards: {
            enabled: true,
            cardIds: [201, 202, 203], // 活动UP卡
            upRate: 0.75, // 75%概率
        },
    };
    
    // 五十连抽
    const results = await cardService.drawMultiple(uid, 50, eventConfig);
    
    // 统计结果
    const stats = {
        total: results.length,
        upCards: results.filter(r => r.isUp).length,
        ssr: results.filter(r => r.rarity === 'SSR').length,
        ur: results.filter(r => r.rarity === 'UR').length,
    };
    
    console.log('活动池统计:', stats);
    return results;
}

/**
 * 示例6: 查询用户抽卡统计
 */
export async function checkUserStatsExample(cardService: CardService) {
    const uid = 'user123';
    
    // 获取用户抽卡统计
    const stats = await cardService.getUserGachaStats(uid);
    
    console.log('用户抽卡统计:', {
        总抽数: stats.totalDraws,
        距离SR: stats.drawsSinceLastSR,
        距离SSR: stats.drawsSinceLastSSR,
        距离UR: stats.drawsSinceLastUR,
    });
    
    // 判断是否即将触发保底
    if (stats.drawsSinceLastSR >= 8) {
        console.log('提示: 即将触发SR保底！');
    }
    
    if (stats.drawsSinceLastSSR >= 85) {
        console.log('提示: 即将触发SSR保底！');
    }
    
    return stats;
}

/**
 * 示例7: 获取卡池信息
 */
export async function getPoolInfoExample(cardService: CardService) {
    // 获取所有卡池
    const allPools = await cardService.getAllPools();
    console.log('所有卡池:', allPools);
    
    // 获取常驻卡池
    const standardPools = await cardService.getPoolsByType(0);
    console.log('常驻卡池:', standardPools);
    
    // 获取限定卡池
    const limitedPools = await cardService.getPoolsByType(2);
    console.log('限定卡池:', limitedPools);
    
    // 获取指定卡池的卡片
    const poolCards = await cardService.getCardsByPool(1);
    console.log('卡池1的所有卡片:', poolCards);
}

/**
 * 示例8: 自定义概率配置
 */
export async function customProbabilityExample(cardService: CardService) {
    const uid = 'custom_user';
    
    // 完全自定义配置
    const customConfig = {
        poolId: 1,
        rarityProbabilities: {
            'N': 0.40,    // 40% N卡
            'R': 0.35,    // 35% R卡
            'SR': 0.20,   // 20% SR卡
            'SSR': 0.04,  // 4% SSR卡
            'UR': 0.01,   // 1% UR卡
        },
        pitySystem: {
            enabled: true,
            softPity: {
                count: 15,  // 15抽保底SR
                guaranteedRarity: 'SR',
            },
            hardPity: {
                count: 100, // 100抽保底SSR
                guaranteedRarity: 'SSR',
            },
        },
    };
    
    const results = await cardService.drawTen(uid, customConfig);
    console.log('自定义配置抽卡结果:', results);
}

/**
 * 示例9: 批量抽卡并分析
 */
export async function batchDrawAnalysis(cardService: CardService) {
    const uid = 'analyst_user';
    
    // 抽100次
    const results = await cardService.drawMultiple(uid, 100, standardPoolConfig);
    
    // 详细统计分析
    const analysis = {
        总抽数: results.length,
        稀有度分布: {} as Record<string, number>,
        卡片类型分布: {} as Record<number, number>,
        UP卡次数: 0,
    };
    
    results.forEach(result => {
        // 统计稀有度
        analysis.稀有度分布[result.rarity] = 
            (analysis.稀有度分布[result.rarity] || 0) + 1;
        
        // 统计卡片类型
        analysis.卡片类型分布[result.cardType] = 
            (analysis.卡片类型分布[result.cardType] || 0) + 1;
        
        // 统计UP卡
        if (result.isUp) analysis.UP卡次数++;
    });
    
    console.log('100抽分析结果:', analysis);
    
    // 计算实际概率
    const actualProbability = {
        N: (analysis.稀有度分布['N'] || 0) / results.length,
        R: (analysis.稀有度分布['R'] || 0) / results.length,
        SR: (analysis.稀有度分布['SR'] || 0) / results.length,
        SSR: (analysis.稀有度分布['SSR'] || 0) / results.length,
        UR: (analysis.稀有度分布['UR'] || 0) / results.length,
    };
    
    console.log('实际概率:', actualProbability);
    
    return analysis;
}

/**
 * 示例10: 重置用户抽卡历史
 */
export async function resetHistoryExample(cardService: CardService) {
    const uid = 'test_user';
    
    // 查看当前统计
    const beforeStats = await cardService.getUserGachaStats(uid);
    console.log('重置前:', beforeStats);
    
    // 重置历史
    await cardService.resetUserHistory(uid);
    
    // 查看重置后统计
    const afterStats = await cardService.getUserGachaStats(uid);
    console.log('重置后:', afterStats);
}

/**
 * 完整的抽卡流程示例
 */
export async function completeGachaFlow(cardService: CardService) {
    const uid = 'complete_user';
    
    try {
        // 1. 查看可用卡池
        const pools = await cardService.getAllPools();
        console.log('步骤1: 可用卡池', pools);
        
        // 2. 选择卡池并查看卡片
        const poolId = pools[0]?.id;
        if (!poolId) {
            console.log('没有可用卡池');
            return;
        }
        
        const poolCards = await cardService.getCardsByPool(poolId);
        console.log('步骤2: 卡池卡片', poolCards.length, '张');
        
        // 3. 查看当前抽卡统计
        const statsBefore = await cardService.getUserGachaStats(uid);
        console.log('步骤3: 抽卡前统计', statsBefore);
        
        // 4. 执行十连抽
        const drawConfig = {
            poolId: poolId,
            ...standardPoolConfig,
        };
        const results = await cardService.drawTen(uid, drawConfig);
        console.log('步骤4: 十连抽结果', results);
        
        // 5. 查看抽卡后统计
        const statsAfter = await cardService.getUserGachaStats(uid);
        console.log('步骤5: 抽卡后统计', statsAfter);
        
        // 6. 分析本次抽卡
        const summary = {
            获得卡片: results.length,
            SSR及以上: results.filter(r => ['SSR', 'UR'].includes(r.rarity)).length,
            UP卡: results.filter(r => r.isUp).length,
        };
        console.log('步骤6: 本次总结', summary);
        
        return {
            results,
            statsBefore,
            statsAfter,
            summary,
        };
        
    } catch (error) {
        console.error('抽卡流程出错:', error);
        throw error;
    }
}
