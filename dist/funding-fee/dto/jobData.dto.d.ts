import { CryptoExchangeType } from '@prisma/client';
export declare class JobDataDto {
    symbol: string;
    longExchange: CryptoExchangeType;
    shortExchange: CryptoExchangeType;
    tickQuantity: number;
    quantity: number;
    marketAssetLong: string;
    marketAssetShort: string;
    longSubAccount: string;
    shortSubAccount: string;
    longEntity?: string;
    shortEntity?: string;
}
