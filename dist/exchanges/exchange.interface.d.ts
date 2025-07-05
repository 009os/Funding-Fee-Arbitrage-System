export interface Exchange {
    placeOrder(symbol: string, side: string, quantity: number, precision?: number, contractValue?: number): Promise<string | null>;
    getOrderStatus(ordId: string, symbol: string): Promise<string | null>;
    cancelOrder(ordId: string, symbol: string): Promise<any>;
    isOrderCanceled(response: any): Promise<boolean>;
}
