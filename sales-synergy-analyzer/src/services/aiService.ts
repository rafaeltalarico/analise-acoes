import type { AIInsightsResponse } from "@/models/types";

const API_URL = import.meta.env.VITE_API_URL;

export async function perguntarAoLuminAI(pergunta: string): Promise<string> {
  const response = await fetch(`${API_URL}/analytics`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ pergunta }),
  });

  if (!response.ok) {
    throw new Error("Erro ao obter resposta da IA");
  }

  const data = await response.json();
  return data.resposta || "Nenhuma resposta recebida da IA.";
}


export async function getProductInsights(
  productId: string,
  salesData?: unknown,
  stockData?: unknown,
  relatedProducts?: unknown[]
): Promise<AIInsightsResponse> {
  const response = await fetch("http://localhost:8000/analytics", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pergunta: `Gere insights sobre o produto ${productId} com base nas vendas e produtos relacionados.`,
      salesData,
      stockData,
      relatedProducts,
    }),
  });

  if (!response.ok) {
    throw new Error("Erro ao obter resposta da IA");
  }

  const data = await response.json();
  return data as AIInsightsResponse;
}
