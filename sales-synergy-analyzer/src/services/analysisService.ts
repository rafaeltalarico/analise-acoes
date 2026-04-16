
import { Product, RelatedProductData, SalesAnalysis } from "@/models/types";
import { getProductById, getProductByName, getPurchasesByDateRange, getPurchaseItemsByPurchaseIds } from "./dbService";

// Obter um produto pelo nome ou ID
export const getProductByNameOrId = async (
  query: string,
  searchType: "product" | "sku"
): Promise<Product | null> => {
  if (searchType === "product") {
    return await getProductByName(query);
  } else {
    const productId = parseInt(query);
    return await getProductById(productId);
  }
};

// Analisar vendas de um produto entre duas datas
export const analyzeSales = async (
  productId: number,
  startDate: Date,
  endDate: Date,
  comparisonType: "compare" | "until" = "compare",
  isSecondProduct: boolean = false,
  firstProductId?: number
): Promise<SalesAnalysis> => {
  // Formatação de datas para comparação com o formato do banco de dados
  const formatDate = (date: Date) => {
    return date.toISOString().split("T")[0];
  };
  
  const formattedStartDate = formatDate(startDate);
  const formattedEndDate = formatDate(endDate);
  
  // Obter informações do produto
  const product = await getProductById(productId);
  
  if (comparisonType === "compare") {
    // Modo de comparação: comparar duas datas
    console.log("Analisando no modo COMPARAR:", formattedStartDate, "vs", formattedEndDate);
    
    // Obter todas as compras no período inicial (até a startDate)
    const startPeriodPurchases = await getPurchasesByDateRange('2023-10-01', formattedStartDate);
    
    // Obter todas as compras no período final (entre startDate e endDate)
    const endPeriodPurchases = await getPurchasesByDateRange(formattedStartDate, formattedEndDate);
    
    // IDs das compras em cada período
    const startPeriodPurchaseIds = startPeriodPurchases.map((p) => p.id_compra);
    const endPeriodPurchaseIds = endPeriodPurchases.map((p) => p.id_compra);
    
    // Itens vendidos do produto em cada período
    const startPeriodItems = (await getPurchaseItemsByPurchaseIds(startPeriodPurchaseIds))
      .filter(item => item.id_produto === productId);
    
    const endPeriodItems = (await getPurchaseItemsByPurchaseIds(endPeriodPurchaseIds))
      .filter(item => item.id_produto === productId);
    
    // Contagem de vendas em cada período
    const startPeriodSales = startPeriodItems.length;
    const endPeriodSales = endPeriodItems.length;
    
    console.log(`Vendas no período inicial: ${startPeriodSales}`);
    console.log(`Vendas no período final: ${endPeriodSales}`);
    
    // Calcular a diferença de vendas
    const absoluteDifference = endPeriodSales - startPeriodSales;
    const percentageDifference = startPeriodSales === 0
      ? 100
      : Math.round((absoluteDifference / startPeriodSales) * 100);
    
    // Encontrar produtos relacionados (que foram comprados junto) no período final
    const relatedProducts = await getRelatedProducts(productId, endPeriodPurchaseIds);
    
    return {
      productId,
      productName: product?.nome_produto || "Produto Desconhecido",
      startDateSales: startPeriodSales,
      endDateSales: endPeriodSales,
      salesDifference: {
        percentage: Math.abs(percentageDifference),
        absoluteValue: Math.abs(absoluteDifference),
        isIncrease: absoluteDifference >= 0,
      },
      relatedProducts,
      showComparison: true
    };
  } else {
    // Modo "até": exibir apenas o total de vendas no período selecionado
    console.log("Analisando no modo ATÉ:", formattedStartDate, "até", formattedEndDate);
    
    // Obter todas as compras no período selecionado (entre startDate e endDate)
    const periodPurchases = await getPurchasesByDateRange(formattedStartDate, formattedEndDate);
    
    // IDs das compras no período
    const periodPurchaseIds = periodPurchases.map((p) => p.id_compra);
    
    // Itens vendidos do produto no período
    const periodItems = (await getPurchaseItemsByPurchaseIds(periodPurchaseIds))
      .filter(item => item.id_produto === productId);
    
    // Contagem de vendas no período
    const totalSales = periodItems.length;
    
    console.log(`Total de vendas no período: ${totalSales}`);
    
    // Encontrar produtos relacionados (que foram comprados junto) no período
    const relatedProducts = await getRelatedProducts(productId, periodPurchaseIds);
    
    // Verificar se este é o segundo produto sendo comparado
    // Consideramos que é o segundo produto se o índice na chamada for 1
    // Isso será implementado no Index.tsx quando chamar esta função
    
    // Se for o segundo produto, vamos comparar com o primeiro
    if (isSecondProduct && firstProductId) {
      // Encontrar vendas do primeiro produto no mesmo período
      const firstProductItems = (await getPurchaseItemsByPurchaseIds(periodPurchaseIds))
        .filter(item => item.id_produto === firstProductId);
      
      const firstProductSales = firstProductItems.length;
      
      // Calcular a diferença de vendas em relação ao primeiro produto
      const absoluteDifference = totalSales - firstProductSales;
      const percentageDifference = firstProductSales === 0
        ? 100
        : Math.round((absoluteDifference / firstProductSales) * 100);
      
      return {
        productId,
        productName: product?.nome_produto || "Produto Desconhecido",
        startDateSales: firstProductSales,
        endDateSales: totalSales,
        salesDifference: {
          percentage: Math.abs(percentageDifference),
          absoluteValue: Math.abs(absoluteDifference),
          isIncrease: absoluteDifference >= 0,
        },
        relatedProducts,
        showComparison: true
      };
    }
    
    // Se for o primeiro produto ou produto único
    return {
      productId,
      productName: product?.nome_produto || "Produto Desconhecido",
      startDateSales: 0,
      endDateSales: totalSales,
      salesDifference: {
        percentage: 0,
        absoluteValue: totalSales,
        isIncrease: true,
      },
      relatedProducts,
      showComparison: false
    };
  }
};

// Encontrar produtos relacionados (comprados junto)
const getRelatedProducts = async (
  productId: number,
  purchaseIds: number[]
): Promise<RelatedProductData[]> => {
  // Obter todos os itens de compra para os IDs de compra fornecidos
  const allPurchaseItems = await getPurchaseItemsByPurchaseIds(purchaseIds);
  
  // Encontrar todas as compras que contêm o produto
  const purchasesWithProduct = allPurchaseItems
    .filter(item => item.id_produto === productId)
    .map(item => item.id_compra);
  
  if (purchasesWithProduct.length === 0) {
    return [];
  }
  
  // Contabilizar outros produtos nestas compras (apenas uma ocorrência por compra)
  const productOccurrences: Record<number, number> = {};
  
  // Para cada compra que contém o produto principal
  for (const purchaseId of purchasesWithProduct) {
    // Encontrar produtos únicos nesta compra (excluindo o produto principal)
    const purchaseItems = allPurchaseItems.filter(
      item => item.id_compra === purchaseId && item.id_produto !== productId
    );
    
    // Adicionar uma ocorrência para cada produto único nesta compra
    const uniqueProducts = new Set(purchaseItems.map(item => item.id_produto));
    uniqueProducts.forEach(productIdKey => {
      if (!productOccurrences[productIdKey]) {
        productOccurrences[productIdKey] = 0;
      }
      productOccurrences[productIdKey]++;
    });
  }
  
  // Calcular percentuais
  const totalPurchases = purchasesWithProduct.length;
  
  // Obter informações de todos os produtos relacionados
  const relatedProductsData: RelatedProductData[] = [];
  
  // Processar cada produto relacionado
  for (const [idProdutoStr, occurrences] of Object.entries(productOccurrences)) {
    const id = parseInt(idProdutoStr);
    const product = await getProductById(id);
    
    relatedProductsData.push({
      productName: product?.nome_produto || `Produto ${id}`,
      occurrences,
      percentage: Math.round((occurrences / totalPurchases) * 100),
    });
  }
  
  // Ordenar por percentual e pegar os top 5
  return relatedProductsData
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 5); // Top 5 produtos relacionados
};
