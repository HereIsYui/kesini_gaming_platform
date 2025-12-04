import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe,Logger } from "@nestjs/common";
import servestatic from "serve-static";
import { join } from "path";
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: '.env.dev' });
const logger = new Logger("Server");
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  
  // 启用全局验证管道
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  app.use("/file", servestatic(join(__dirname, "/public")));

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
