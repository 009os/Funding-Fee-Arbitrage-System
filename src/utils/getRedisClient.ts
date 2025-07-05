import Redis, { Redis as RedisClient } from 'ioredis';
import { AppConfigService } from 'src/app-config/app-config.service';

let bullMqRedisClient: RedisClient = undefined;
export const getBullMqRedisClient = (): RedisClient => {
  const appConfigService = new AppConfigService();

  if (!bullMqRedisClient) {
    bullMqRedisClient = new Redis({
      host: appConfigService.get('BULLMQ_REDIS_HOST'),
      port: appConfigService.get('BULLMQ_REDIS_PORT'),
      maxRetriesPerRequest: null, // needed by bullmq worker instance
    });
  }

  return bullMqRedisClient;
};
