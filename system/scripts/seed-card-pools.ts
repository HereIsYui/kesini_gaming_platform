import { existsSync } from "fs";
import { isAbsolute, resolve } from "path";
import * as dotenv from "dotenv";
import { DataSource } from "typeorm";
import { CardItem } from "src/entity/card.entity";
import { PoolInfo } from "src/entity/pool.entity";
import { ConfigurationService } from "src/config/configuration.service";
import { importCardPools } from "src/seeds/card-pool-import";

function loadSystemEnv() {
  const systemRoot = resolve(__dirname, "..");
  const resolveEnvFile = (filePath: string) =>
    isAbsolute(filePath) ? filePath : resolve(systemRoot, filePath);
  const envFileCandidates = [
    process.env.ENV_FILE && resolveEnvFile(process.env.ENV_FILE),
    process.env.NODE_ENV && resolveEnvFile(`.env.${process.env.NODE_ENV}`),
    process.env.NODE_ENV === "production" && resolveEnvFile(".env.prod"),
    process.env.NODE_ENV === "development" && resolveEnvFile(".env.dev"),
    resolveEnvFile(".env"),
  ].filter((filePath): filePath is string => typeof filePath === "string");
  const envFile = envFileCandidates.find((filePath) => existsSync(filePath));

  dotenv.config(envFile ? { path: envFile, quiet: true } : { quiet: true });
}

function createDataSource() {
  const configurationService = new ConfigurationService();
  const {
    autoLoadEntities: _autoLoadEntities,
    retryAttempts: _retryAttempts,
    retryDelay: _retryDelay,
    ...databaseConfig
  } = configurationService.databaseConfig;

  return new DataSource({
    ...databaseConfig,
    entities: [PoolInfo, CardItem],
  });
}

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    apply: args.has("--apply"),
    dryRun: args.has("--dry-run") || !args.has("--apply"),
  };
}

function printResult(result: Awaited<ReturnType<typeof importCardPools>>) {
  const modeText = result.mode === "apply" ? "正式写入" : "预览";
  console.log(`卡池导入${modeText}完成`);
  console.log(`卡池总数: ${result.totalPools}`);
  console.log(`卡片总数: ${result.totalCards}`);
  console.log(
    `卡池: 新增 ${result.pools.created}，更新 ${result.pools.updated}，无变化 ${result.pools.unchanged}`,
  );
  console.log(
    `卡片: 新增 ${result.cards.created}，更新 ${result.cards.updated}，无变化 ${result.cards.unchanged}`,
  );

  if (result.missingDescriptions.length > 0) {
    console.log(`无介绍卡片: ${result.missingDescriptions.length}`);
    console.log(result.missingDescriptions.join("、"));
  }

  if (result.specialRules.length > 0) {
    console.log("特殊规则命中:");
    for (const rule of result.specialRules) {
      console.log(`- ${rule}`);
    }
  }
}

async function main() {
  loadSystemEnv();
  const args = parseArgs();
  const dataSource = createDataSource();
  await dataSource.initialize();

  try {
    const result = args.dryRun
      ? await importCardPools(dataSource.manager, { dryRun: true })
      : await dataSource.transaction((manager) =>
          importCardPools(manager, { dryRun: false }),
        );
    printResult(result);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error("卡池导入失败");
  console.error(error);
  process.exitCode = 1;
});
