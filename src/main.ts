import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfigService } from './app-config/app-config.service';

async function bootstrap() {
  // Apply BigInt toJSON modification
  BigInt.prototype['toJSON'] = function () {
    return Number(this);
  };

  const app = await NestFactory.create(AppModule);
  // get app config service
  const appConfig = app.get(AppConfigService);

  // listen to port
  await app.listen(appConfig.get('PORT'));
}
bootstrap();
