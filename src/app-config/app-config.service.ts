import { Injectable } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as envalid from 'envalid';
import { AppConfig } from './types';

@Injectable()
export class AppConfigService {
  private env: AppConfig;

  constructor() {
    dotenv.config();

    const env: AppConfig = envalid.cleanEnv(process.env, {
      POSTGRES_DB_URL: envalid.url(),
      PORT: envalid.num(),
      NODE_ENV: envalid.str(),
      SYSTEM_USER_ID: envalid.num(),
      BULLMQ_REDIS_HOST: envalid.str(),
      BULLMQ_REDIS_PORT: envalid.num(),
      QUEUE_NAME: envalid.str(),
      BINANCE_BASE_URL: envalid.str(),
      OKX_API_KEY: envalid.str(),
      OKX_API_SECRET: envalid.str(),
      OKX_PASSPHRASE: envalid.str(),
      OKX_BASE_URL: envalid.str(),
      BYBIT_API_KEY: envalid.str(),
      BYBIT_API_SECRET: envalid.str(),
      BYBIT_BASE_URL: envalid.str(),
      BYBIT_WS_URL: envalid.str(),
      FUNDING_FEE_ARBITRAGE_PARALLEL_JOBS_COUNT: envalid.num(),
    });

    this.env = env;
  }

  get<Property extends keyof AppConfig>(
    configProperty: Property,
  ): AppConfig[Property] {
    return this.env[configProperty];
  }
}
