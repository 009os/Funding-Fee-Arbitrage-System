export declare class Bybit {
    private apiKey;
    private apiSecret;
    private baseUrl;
    constructor(bybitApiKey: string, bybitApiSecret: string, bybitBaseUrl: string);
    private createSignature;
    getOrderBook(symbol: string): Promise<[number, number] | null>;
    getPricePrecision(symbol: string): Promise<number | null>;
    placeLimitOrder(symbol: string, side: 'Buy' | 'Sell', qty: number, pricePrecision: number): Promise<any | null>;
    fetchOrderStatus(orderId: string, symbol: string): Promise<any | null>;
    cancelOrder(orderId: string, symbol: string): Promise<any | null>;
    getOpenPositions(category?: string, symbol?: string): Promise<number | null>;
}
