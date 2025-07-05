import { CryptoExchangeType } from '@prisma/client';
import { IsEnum, IsNumber, IsPositive, IsString } from 'class-validator';

export class JobDataDto {
  @IsString()
  symbol: string;

  @IsEnum(CryptoExchangeType)
  longExchange: CryptoExchangeType;

  @IsEnum(CryptoExchangeType)
  shortExchange: CryptoExchangeType;

  @IsNumber()
  @IsPositive()
  tickQuantity: number;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsString()
  marketAssetLong: string;

  @IsString()
  marketAssetShort: string;

  @IsString()
  longSubAccount: string;

  @IsString()
  shortSubAccount: string;

  @IsString()
  longEntity?: string;

  @IsString()
  shortEntity?: string;
}
