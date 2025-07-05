export declare class Binance {
    private readonly apiKey;
    private readonly apiSecret;
    private readonly baseUrl;
    constructor(apiKey: string, apiSecret: string, baseUrl: string);
    private createSignature;
    fetchOrderStatusBinance(clientOrderId: string, symbol: string): Promise<any | null>;
    getOpenPositionsBinance(symbol?: string): Promise<number | null>;
    cancelOrderBinance(clientOrderId: string, symbol: string): Promise<any | null>;
    placeOrderBinance(symbol: string, side: 'BUY' | 'SELL', quantity: number): Promise<any | null>;
}
