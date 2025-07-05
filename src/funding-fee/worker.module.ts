import { Module } from '@nestjs/common';
import { FundingFeeWorkerService } from './worker.service';
import { AppConfigModule } from 'src/app-config/app-config.module';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [AppConfigModule, DatabaseModule],
  providers: [FundingFeeWorkerService],
  exports: [],
})
export class FundingFeeModule {}
