import { GachaConfig } from './card.service';

/**
 * 抽卡配置示例（无保底版本）
 * 纯概率抽卡，可以根据不同的卡池创建不同的配置
 */

// 示例1: 标准卡池配置 (常驻卡池)
export const standardPoolConfig: GachaConfig = {
    poolId: 1,  // 指定卡池ID (卡池类型: 0 常驻卡池)
    rarityProbabilities: {
        'N': 0.50,    // 50%
        'R': 0.30,    // 30%
        'SR': 0.15,   // 15%
        'SSR': 0.045, // 4.5%
        'UR': 0.005,  // 0.5%
    },
};

// 示例2: 限定卡池配置 (UP池)
export const limitedPoolConfig: GachaConfig = {
    poolId: 2,  // 指定卡池ID (卡池类型: 2 限定卡池)
    rarityProbabilities: {
        'N': 0.45,    // 45%
        'R': 0.30,    // 30%
        'SR': 0.18,   // 18%
        'SSR': 0.06,  // 6%
        'UR': 0.01,   // 1%
    },
    upCards: {
        enabled: true,
        cardIds: [101, 102, 103],  // UP卡片ID列表
        upRate: 0.5,               // 50%概率获得UP卡
    },
};

// 示例3: 新手卡池配置 (高概率)
export const beginnerPoolConfig: GachaConfig = {
    poolId: 3,  // 指定卡池ID
    rarityProbabilities: {
        'N': 0.30,    // 30%
        'R': 0.35,    // 35%
        'SR': 0.25,   // 25%
        'SSR': 0.08,  // 8%
        'UR': 0.02,   // 2%
    },
};

// 示例4: 活动卡池配置
export const eventPoolConfig: GachaConfig = {
    poolId: 4,  // 指定卡池ID (卡池类型: 1 活动卡池)
    rarityProbabilities: {
        'N': 0.40,
        'R': 0.35,
        'SR': 0.20,
        'SSR': 0.045,
        'UR': 0.005,
    },
    upCards: {
        enabled: true,
        cardIds: [201, 202, 203, 204], // 活动UP卡
        upRate: 0.75,                  // 75%概率获得活动UP卡
    },
};

// 示例5: 不指定卡池 (从所有卡片中抽取)
export const allCardsPoolConfig: GachaConfig = {
    // poolId 不指定，将从所有卡片中抽取
    rarityProbabilities: {
        'N': 0.50,
        'R': 0.30,
        'SR': 0.15,
        'SSR': 0.045,
        'UR': 0.005,
    },
};

// 示例6: 使用默认概率配置
export const defaultConfig: GachaConfig = {
    poolId: 1,
    // 不指定 rarityProbabilities，使用默认概率
};
