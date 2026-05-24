import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe, Logger } from "@nestjs/common";
import servestatic from "serve-static";
import { existsSync } from "fs";
import { isAbsolute, join, resolve } from "path";
import * as dotenv from "dotenv";

// 加载 system 目录下的环境变量，避免 workspace 启动时读取错文件。
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

dotenv.config(envFile ? { path: envFile } : undefined);
const logger = new Logger("Server");
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  // 启用全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.use("/file", servestatic(join(__dirname, "/public")));

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
