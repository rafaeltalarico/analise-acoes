import axios, { AxiosResponse } from 'axios';
import { StockHistoryResponse, StockFilterParams, StockClassificationData, 
  StockTotal, StockItem } from "@/models/stockTypes";

const API_URL = import.meta.env.VITE_API_URL;;

export const getStockHistory = async (
  query: string,
  searchType: "product" | "sku",
  startDate: Date,
  endDate: Date
) => {
  try {
    const response = await axios.get(`${API_URL}/stock/history`, {  
      params: {
        query,
        search_type: searchType,
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
      }
    });

    return response.data;
  } catch (error) {
    console.error("Erro ao buscar histórico de estoque:", error);
    return null;
  }
};

// Função para buscar dados de estoque usando StockFilterParams
export const getStockData = async (
  params: StockFilterParams
): Promise<StockHistoryResponse | null> => {
  try {
    // Chamar a API para buscar dados reais do banco
    const result = await getStockHistory(
      params.query,
      params.searchType,
      new Date(params.startDate),
      new Date(params.endDate)
    );
    
    // Se não encontrou dados no banco, retornar null
    if (!result) {
      console.log("Nenhum dado de estoque encontrado para os parâmetros fornecidos");
      return null;
    }
    
    // Processar e retornar os dados obtidos
    console.log(`Dados de estoque obtidos para ${result.productName} (${result.sku})`);
    return result;
  } catch (error) {
    console.error("Erro ao processar dados de estoque:", error);
    return null;
  }
};

// Versão alternativa usando fetch diretamente (se necessário)
export const getStockHistoryWithFetch = async (params: StockFilterParams): Promise<StockHistoryResponse | null> => {
  try {
    // Construir a URL com os parâmetros de consulta
    const url = `${API_URL}/stock/history?query=${encodeURIComponent(params.query)}&search_type=${params.searchType}&start_date=${params.startDate}&end_date=${params.endDate}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Erro ao buscar histórico de estoque: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Erro ao buscar histórico de estoque:", error);
    return null;
  }
};

// Função para buscar a classificação do estoque atual de um produto
export const getStockClassification = async (
  query: string,
  searchType: "product" | "sku"
): Promise<StockClassificationData | null> => {
  try {
    const response = await axios.get(`${API_URL}/stock/classification`, {
      params: {
        query,
        search_type: searchType
      }
    });

    return response.data;
  } catch (error) {
    console.error("Erro ao buscar classificação de estoque:", error);
    return null;
  }
};

export const getStockTotal = async (): Promise<StockTotal | null> => {
  try {
    const response = await axios.get(`${API_URL}/stock/total`);
    if (response.data && ('quantity' in response.data || 'value' in response.data)) {
      return {
        quantity: response.data.quantity || 0, value: response.data.value || 0
      } as StockTotal;
    } else {
      console.warn("Resposta da API não contém os campos esperados:", response.data);
      return {
        quantity: 0,
        value: 0
      };
    }    
  } catch (error) {
    console.error("Erro ao buscar o total de estoque:", error);
    return null;
  }
};

export const getStockItems = async (): Promise<StockItem[] | null> => {
  try {
    const response = await axios.get(`${API_URL}/stock/items`);
    return response.data;
  } catch (error) {
    console.error("Erro ao buscar lista de estoque:", error);
    return null;
  }
};