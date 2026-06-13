// 跨模块共享的 Redis 缓存键，集中定义避免读写两端写串。

// DropItem 全表 id→name 映射缓存：recharge 读取，admin 改物品时失效。
export const DROP_ITEM_NAME_MAP_CACHE_KEY = "dropitem:namemap";
export const DROP_ITEM_NAME_MAP_CACHE_TTL_SECONDS = 24 * 3600;
