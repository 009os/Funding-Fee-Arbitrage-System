import { Injectable, Logger } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { AppConfigService } from 'src/app-config/app-config.service';
import { QueueNames } from 'src/constants/constants';
import { DatabaseService } from 'src/database/database.service';
import { Redis as RedisClient } from 'ioredis';
import { getBullMqRedisClient } from 'src/utils/getRedisClient';
import { JobDataDto } from './dto/jobData.dto';
import { validateInput } from 'src/utils/validate-input';
import { ExchangeCredentials } from './dto/types';
import { CryptoExchangeType, JobStatus } from '@prisma/client';
import { Binance } from 'src/exchanges/binance';
import { Bybit } from 'src/exchanges/bybit';
import { Okx } from 'src/exchanges/okx';
import { OrderExecutor } from './TradingLogic';
import { UdpateJobInDb } from './dto/worker-service.dto';

@Injectable()
export class FundingFeeWorkerService {
  private readonly redisServiceBmq: RedisClient;
  private readonly exchangeCredentials: Record<string, ExchangeCredentials>;

  async onModuleInit() {
    new Worker(
      QueueNames.FUNDING_FEE_ARBITRAGE,
      async (job: Job) => {
        const jobData = job.data;
        const jobId = job.id;
        return await this.processJob(jobId, jobData);
      },
      {
        connection: this.redisServiceBmq,
        concurrency: this.appConfig.get(
          'FUNDING_FEE_ARBITRAGE_PARALLEL_JOBS_COUNT',
        ),
      },
    );

    Logger.debug('Funding fee arbitrage worker initialized');
  }

  constructor(
    private readonly appConfig: AppConfigService,
    private readonly db: DatabaseService,
  ) {
    this.redisServiceBmq = getBullMqRedisClient();

    // Default credentials for Bybit and OKX
    this.exchangeCredentials = {
      OKX: {
        apiKey: this.appConfig.get('OKX_API_KEY'),
        apiSecret: this.appConfig.get('OKX_API_SECRET'),
        passphrase: this.appConfig.get('OKX_PASSPHRASE'),
        baseUrl: this.appConfig.get('OKX_BASE_URL'),
      },
      BYBIT: {
        apiKey: this.appConfig.get('BYBIT_API_KEY'),
        apiSecret: this.appConfig.get('BYBIT_API_SECRET'),
        baseUrl: this.appConfig.get('BYBIT_BASE_URL'),
        wsUrl: this.appConfig.get('BYBIT_WS_URL'),
      },
    };
  }

  private async getBinanceCredentials(subAccount: string, entity: string) {
    try {
      const binanceCreds = await this.db.subAccountsDetails.findFirst({
        where: {
          exchange: CryptoExchangeType.BINANCE,
          subAccount: subAccount,
          entity: entity || 'ZN', // Use ZN as default
        },
        select: {
          apiKey: true,
          apiSecret: true,
        },
      });

      if (!binanceCreds) {
        throw new Error(
          `No credentials found for Binance subAccount ${subAccount}`,
        );
      }
      console.log(
        `Fetched Binance credentials for subAccount ${subAccount} and entity ${entity}`,
      );

      return binanceCreds;
    } catch (error) {
      Logger.error(
        `Failed to fetch Binance credentials for subAccount ${subAccount} and entity ${entity}`,
        error,
      );
      throw new Error('An error occurred while fetching Binance credentials');
    }
  }

  private async getExchangeInstance(
    exchange: CryptoExchangeType,
    subAccount: string,
    entity?: string,
  ) {
    let exchangeInstance = undefined;

    switch (exchange) {
      case CryptoExchangeType.BINANCE:
        // Fetch Binance credentials from DB
        const binanceCreds = await this.getBinanceCredentials(
          subAccount,
          entity,
        );
        const binanceBaseUrl = this.appConfig.get('BINANCE_BASE_URL');

        exchangeInstance = new Binance(
          binanceCreds.apiKey,
          binanceCreds.apiSecret,
          binanceBaseUrl,
        );
        break;

      case CryptoExchangeType.BYBIT:
        const bybitCreds = this.exchangeCredentials.BYBIT;
        exchangeInstance = new Bybit(
          bybitCreds.apiKey,
          bybitCreds.apiSecret,
          bybitCreds.baseUrl,
          bybitCreds.wsUrl,
        );
        break;

      case CryptoExchangeType.OKX:
        const okxCreds = this.exchangeCredentials.OKX;
        exchangeInstance = new Okx(
          okxCreds.apiKey,
          okxCreds.apiSecret,
          okxCreds.passphrase || '',
          okxCreds.baseUrl,
        );
        break;

      default:
        throw new Error('Unsupported exchange and subaccount combination');
    }

    return exchangeInstance;
  }

  // Function to process the job(funding fee) on active state
  private async processJob(jobId: string, data: JobDataDto) {
    let longExchangeInstance: any;
    let shortExchangeInstance: any;
    try {
      await validateInput(JobDataDto, data);

      longExchangeInstance = await this.getExchangeInstance(
        data.longExchange,
        data.longSubAccount,
        data.longEntity,
      );
      shortExchangeInstance = await this.getExchangeInstance(
        data.shortExchange,
        data.shortSubAccount,
        data.shortEntity,
      );

      const orderExecutor = new OrderExecutor(
        data,
        longExchangeInstance,
        shortExchangeInstance,
        jobId,
      );

      const response = await orderExecutor.execute();
      Logger.log(`Job with id ${jobId} completed`);
      await this.udpateJobInDb({
        jobId,
        jobStatus: response.jobStatus,
        processedQuantity: response.processedQuantity,
      });

      if (longExchangeInstance instanceof Bybit) {
        longExchangeInstance.closeWebSocket();
      }
      if (shortExchangeInstance instanceof Bybit) {
        shortExchangeInstance.closeWebSocket();
      }
    } catch (error) {
      Logger.error(
        `Error in processing job with id ${jobId}, data: ${JSON.stringify(data)}`,
        error,
      );
      await this.udpateJobInDb({
        jobId,
        jobStatus: JobStatus.FAILED,
        processedQuantity: undefined,
      });
      if (longExchangeInstance instanceof Bybit) {
        longExchangeInstance.closeWebSocket();
      }
      if (shortExchangeInstance instanceof Bybit) {
        shortExchangeInstance.closeWebSocket();
      }
      throw error;
    }
  }

  private async udpateJobInDb(data: UdpateJobInDb) {
    try {
      await this.db.fundingFeeArbitrageJobs.updateMany({
        where: {
          jobId: data.jobId,
        },
        data: {
          status: data.jobStatus,
          processedQuantity: data.processedQuantity,
        },
      });

      Logger.debug(`Updated job in db ${JSON.stringify(data)}`);
    } catch (error) {
      Logger.error(
        `Failed to update job in database: ${JSON.stringify(data)}`,
        error,
      );
    }
  }
}
