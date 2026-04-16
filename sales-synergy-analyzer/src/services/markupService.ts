// Serviço para buscar dados de mark-up e margem bruta
import axios, { AxiosResponse } from 'axios';

const API_URL = "http://localhost:8000";

const api = axios.create({
    baseURL: API_URL,
    headers: {
      'Content-Type': 'application/json'
    }
  });
// Interface para os dados de mark-up
export interface MarkupData {
  productId?: number;
  markupValue: number;
  marginValue: number;
  markupChange: number;
  marginChange: number;
}

// Buscar mark-up geral (média de todos os produtos)
export const getGeneralMarkup = async (): Promise<MarkupData> => {
  try {
    // Chamar o endpoint existente no seu backend
    const response = await api.get('/api/markup/general');
    const data = response.data;
    
    const marginValue = (data.markupValue / (100 + data.markupValue)) * 100;
    

    return {
        markupValue: data.markupValue,
        marginValue: parseFloat(marginValue.toFixed(2)),
        markupChange: 0,
        marginChange: 0
    };
  } catch (error) {
    console.error("Erro ao buscar mark-up geral:", error);
       
    return {
      markupValue: 0,
      marginValue: 0,
      markupChange: 0,
      marginChange: 0
    };
  }
};

// Buscar mark-up de um produto específico
export const getProductMarkup = async (productId: number): Promise<MarkupData> => {
  try {
    // Chamar o endpoint existente no seu backend
    const response = await api.get(`/api/markup/product/${productId}`);
    const data = response.data;
    
    // Calculando a margem bruta a partir do mark-up
    const marginValue = (data.markupValue / (100 + data.markupValue)) * 100;

    return {
      productId,
      markupValue: data.markupValue,
      marginValue: parseFloat(marginValue.toFixed(2)),
      markupChange: data.markupChange || 0,
      marginChange: data.marginChange || 0
    };
  } catch (error) {
    console.error(`Erro ao buscar mark-up do produto ${productId}:`, error);

    return {
      productId,
      markupValue: 0,
      marginValue: 0,
      markupChange: 0,
      marginChange: 0
    };
  }
};