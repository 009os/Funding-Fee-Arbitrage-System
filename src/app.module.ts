import { Module } from '@nestjs/common';
import { AppConfigModule } from './app-config/app-config.module';
import { DatabaseModule } from './database/database.module';
import { FundingFeeModule } from './funding-fee/worker.module';
import { AppConfigService } from './app-config/app-config.service';
import { QueueNames } from './constants/constants';

const appConfig = new AppConfigService();
let modulesToInitialize: any[];
const queue = appConfig.get('QUEUE_NAME');

switch (queue) {
  case QueueNames.FUNDING_FEE_ARBITRAGE:
    modulesToInitialize = [FundingFeeModule];
    break;
  default:
    modulesToInitialize = [];
}

if (modulesToInitialize.length === 0) {
  throw new Error('Unsupported queue name');
}
@Module({
  imports: [AppConfigModule, DatabaseModule, ...modulesToInitialize],
})
export class AppModule {}
