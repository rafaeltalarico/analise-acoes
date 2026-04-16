
export interface Product {
  id_produto: number;
  nome_produto: string;
  preco: number;
}

export interface Purchase {
  id_compra: number;
  data_compra: string;
  cpf: string;
}

export interface PurchaseItem {
  id: number;
  id_compra: number;
  id_produto: number;
  valor_unitario: number;
  encarte: string | null;
}

export interface RelatedProductData {
  productName: string;
  occurrences: number;
  percentage: number;
}

export interface SalesAnalysis {
  productId: number;
  productName: string;
  startDateSales: number;
  endDateSales: number;
  salesDifference: {
    percentage: number;
    absoluteValue: number;
    isIncrease: boolean;
  };
  relatedProducts: RelatedProductData[];
  showComparison: boolean;
}

export interface ProductSearchResult {
  id: number;
  productName: string;
  productId: number;
  mainProductName: string;
  totalSales: number;
  salesDifference: {
    percentage: number;
    absoluteValue: number;
    isIncrease: boolean;
  };
  relatedProducts: {
    name: string;
    percentage: number;
    absoluteValue: number;
  }[];
  showComparison: boolean;
  comparisonType: "compare" | "until";
  firstStartDate: string;
  firstEndDate: string;
  secondStartDate?: string;
  secondEndDate?: string;
  firstDateRangeChecked?: boolean;
  secondDateRangeChecked?: boolean;
  currentFirstStartDate: string;
  currentFirstEndDate: string;
  currentSecondStartDate?: string;
  currentSecondEndDate?: string;
  currentFirstDateRangeChecked: boolean;
  currentSecondDateRangeChecked: boolean;
}

export type ProductInsightType = "positive" | "negative" | "neutral" | "suggestion";

export interface ProductInsight {
  title: string;
  description: string;
  type: ProductInsightType;
  metric?: {
    value: number;
    unit: string;
    change?: number;
  };
}

export interface AIInsightsResponse {
  summary: string;
  insights: ProductInsight[];
}

