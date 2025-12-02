import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import servestatic from "serve-static";
import { join } from "path";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  const config = new DocumentBuilder()
    .setTitle("抽卡对接文档")
    .setDescription("kejini game")
    .setVersion("1.0")
    .addTag("users", "用户相关接口")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, document);

  app.use("/file", servestatic(join(__dirname, "/public")));

  await app.listen(3000);
}
bootstrap();
