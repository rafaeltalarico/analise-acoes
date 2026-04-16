import { Product, RelatedProductData, SalesAnalysis } from "@/models/types";

const API_URL = import.meta.env.VITE_API_URL;

// Função para buscar um produto pelo nome ou ID
export const getProductByNameOrId = async (
  query: string,
  searchType: "product" | "sku"
): Promise<Product | null> => {
  try {
    // Garantir que a query não esteja vazia
    if (!query.trim()) {
      return null;
    }
    
    // Se for busca por SKU, garantir que seja um número válido
    if (searchType === "sku") {
      if (isNaN(Number(query))) {
        console.error("ID do produto deve ser um número");
        return null;
      }
    }
    
    const response = await fetch(
      `${API_URL}/products/search/${encodeURIComponent(query)}?search_type=${searchType}`
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Erro ao buscar produto: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Erro ao buscar produto:", error);
    return null;
  }
};

// Função para analisar vendas de um produto entre duas datas
export const analyzeSales = async (
  productId: number,
  startDate: Date,
  endDate: Date,
  comparisonType: "compare" | "until" = "compare",
  isSecondProduct: boolean = false,
  firstProductId?: number,
  selectedDateRange?: number | null,
  comparePeriods: boolean = false,
  secondStartDate?: Date,
  secondEndDate?: Date
): Promise<SalesAnalysis> => {
  // Formatação de datas para comparação com o formato do banco de dados
  const formatDate = (date: Date) => {
    return date.toISOString().split("T")[0];
  };
  
  const formattedStartDate = formatDate(startDate);
  const formattedEndDate = formatDate(endDate);
  
  try {
    // Construir a URL com os parâmetros de consulta
    let url = `${API_URL}/analysis/sales?product_id=${productId}&start_date=${formattedStartDate}&end_date=${formattedEndDate}&comparison_type=${comparisonType}`;
    
    if (isSecondProduct && firstProductId) {
      url += `&is_second_product=true&first_product_id=${firstProductId}`;
    }
    
    // Adicionar o período selecionado, se houver
    if (selectedDateRange !== undefined && selectedDateRange !== null) {
      url += `&selected_date_range=${selectedDateRange}`;
    }
    
    // Adicionar parâmetros para comparação de dois períodos
    if (comparePeriods && secondStartDate && secondEndDate) {
      url += `&compare_periods=true&second_start_date=${formatDate(secondStartDate)}&second_end_date=${formatDate(secondEndDate)}`;
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Erro na análise de vendas: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Erro na análise de vendas:", error);
    throw error;
  }
};