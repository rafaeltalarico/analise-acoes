export interface StockItem {
  id: number;
  productId: number;
  productName: string;
  sku: string; // Representa o id_produto nas tabelas do banco de dados
  quantity: number;
  value: number; // Valor em R$
  date: string; // Data no formato ISO
}

export interface StockHistoryItem {
  date: string; // Data no formato ISO
  quantity: number;
  value: number; // Valor em R$
}

export interface StockHistoryResponse {
    productId: number;
    productName: string;
    sku: string;
    startDate?: string;
    endDate?: string;
    initialStock: number;
    history: {
      date: string;
      quantity: number;
      entries: number;
      outputs: number;
      value?: number; // Opcional se não for usado
    }[];
}

export interface StockFilterParams {
    query: string;
    searchType: "product" | "sku";
    startDate: string;
    endDate: string;
    displayType: "quantity" | "value";
    chartType: "line" | "bar";
}

export interface StockClassificationData {
    stockOver: number;
    criticalAge: number;
    expired: number;
    ok: number;
    total: number;
}

export interface StockTotal {
    value: number;
    quantity: number;
}

export interface StockItem {
    id: number;
    productId: number;
    productName: string;
    sku: string;
    quantity: number;
    value: number;
    unitPrice: number;
}