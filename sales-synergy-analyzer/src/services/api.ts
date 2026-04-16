import axios from 'axios';
import type { StockAnalysis } from '../types/stock';

const BASE_URL = 'http://localhost:8000';

export async function analyzeStock(ticker: string): Promise<StockAnalysis> {
  const response = await axios.get<StockAnalysis>(`${BASE_URL}/api/analyze/${ticker}`, {
    timeout: 60000,
  });
  return response.data;
}
