import { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import InfoCard from "@/components/InfoCard";
import { StockTotal, StockItem, StockClassificationData } from "@/models/stockTypes";
import { getStockTotal, getStockItems, getStockClassification } from "@/services/stockService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import StockClassification from "@/components/StockClassification";
//import { getGeneralMarkup, getProductMarkup, MarkupData } from "@/services/markupService";

// Tipo para as categorias de classificação
type ClassificationType = "stockOver" | "criticalAge" | "expired" | "ok" | null;

const Dashboard = () => {
  const [stockTotal, setStockTotal] = useState<StockTotal | null>(null);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<StockItem | null>(null);
  const [classificationData, setClassificationData] = useState<StockClassificationData | null>(null);
  const [isClassificationLoading, setIsClassificationLoading] = useState(false);
  const [overallClassificationData, setOverallClassificationData] = useState<StockClassificationData | null>(null);
  const [selectedClassification, setSelectedClassification] = useState<ClassificationType>(null);
  const [productClassifications, setProductClassifications] = useState<Record<number, ClassificationType>>({});
  const [productClassificationData, setProductClassificationData] = useState<Record<number, StockClassificationData>>({});
  //const [markupData, setMarkupData] = useState<MarkupData | null>(null);
  //const [isMarkupLoading, setIsMarkupLoading] = useState(true);
  //const [generalMarkupData, setGeneralMarkupData] = useState<MarkupData | null>(null);
  //const [productMarkupData, setProductMarkupData] = useState<MarkupData | null>(null);
  //const currentMarkup = selectedProduct ? productMarkupData : generalMarkupData;

  
  /* Substituir o useEffect atual por estes dois efeitos separados
  useEffect(() => {
    const fetchGeneralMarkup = async () => {
      setIsMarkupLoading(true);
      try {
        const data = await getGeneralMarkup();
        console.log("Dados de markup geral recebidos:", data);
        setGeneralMarkupData(data); // ✅ CORRIGIDO
      } catch (err) {
        console.error("Erro ao buscar dados de markup geral:", err);
      } finally {
        setIsMarkupLoading(false);
      }
    };
  
    fetchGeneralMarkup();
  }, []);
  

  useEffect(() => {
    if (!selectedProduct) return;
    
    const fetchProductMarkup = async () => {
      setIsMarkupLoading(true);
      try {
        const data = await getProductMarkup(selectedProduct.productId);
        console.log(`Dados de markup para produto ${selectedProduct.productId}:`, data);
        setProductMarkupData(data); // ✅ CORRIGIDO
      } catch (err) {
        console.error(`Erro ao buscar dados de markup para o produto ${selectedProduct.productId}:`, err);
      } finally {
        setIsMarkupLoading(false);
      }
    };
  
    fetchProductMarkup();
  }, [selectedProduct]); */
  
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const total = await getStockTotal();
        if (total) {
          setStockTotal(total);
        }

        const items = await getStockItems();
        setStockItems(items);
        setFilteredItems(items);

        if (items.length > 0) {
          const overall: StockClassificationData = {
            stockOver: 0,
            criticalAge: 0,
            expired: 0,
            ok: 0,
            total: 0
          };

          // Objeto para armazenar a classificação de cada produto
          const classifications: Record<number, ClassificationType> = {};

          const classificationData: Record<number, StockClassificationData> = {};

          for (const item of items.slice(0, 20)) {
            try {
              const itemClassification = await getStockClassification(item.productId.toString(), "sku");
              if (itemClassification) {
                overall.stockOver += itemClassification.stockOver || 0;
                overall.criticalAge += itemClassification.criticalAge || 0;
                overall.expired += itemClassification.expired || 0;
                overall.ok += itemClassification.ok || 0;
                overall.total += itemClassification.total || 0;
                classificationData[item.productId] = itemClassification;
                
                // Determinar a classificação predominante deste produto
                const maxCategory = Object.entries({
                  stockOver: itemClassification.stockOver || 0,
                  criticalAge: itemClassification.criticalAge || 0,
                  expired: itemClassification.expired || 0,
                  ok: itemClassification.ok || 0
                }).reduce((max, [category, value]) => 
                  value > max.value ? { category: category as ClassificationType, value } : max, 
                  { category: null as ClassificationType, value: 0 }
                );
                
                if (maxCategory.category) {
                  classifications[item.productId] = maxCategory.category;
                }
              }
            } catch (error) {
              console.error(`Erro ao buscar dados de classificação para produto ${item.productId}:`, error);
            }
          }
          
          setOverallClassificationData(overall);
          setProductClassifications(classifications);
          setProductClassificationData(classificationData);
        }

      } catch (err) {
        console.error("Erro ao buscar dados de estoque:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const getClassificationQuantity = useCallback((productId: string | number, classification: ClassificationType) => {
    const id = String(productId);
    const data = productClassificationData[id];
    if (!data) return 0;
    return data[classification] || 0;
  }, [productClassificationData]);

  // Efeito para filtrar itens quando a classificação selecionada muda
  useEffect(() => {
    if (selectedClassification) {
      // Modificando a lógica de filtragem para considerar produtos que têm quantidade > 0 na classificação selecionada
      if (selectedProduct) {
        // Verificar se o produto tem dados de classificação
        const productData = productClassificationData[selectedProduct.productId];
        if (productData && productData[selectedClassification] > 0) {
          setFilteredItems([selectedProduct]);
        } else {
          setFilteredItems([]);
        }
      } else {
        const filtered = stockItems.filter(item => {
        // Verificar se o produto tem dados de classificação
          const productData = productClassificationData[item.productId];
          if (!productData) 
            return false;
            return productData[selectedClassification] > 0;
        });
        setFilteredItems(filtered);
      }
    } else {
      setFilteredItems(selectedProduct ? [selectedProduct] : stockItems);
    }
  }, [selectedClassification, selectedProduct, stockItems, productClassificationData]);
        
        
    
  
  

  useEffect(() => {
    const fetchClassificationData = async () => {
      if (selectedProduct) {
        setIsClassificationLoading(true);
        try {
          const data = await getStockClassification(
            selectedProduct.productId.toString(),
            "sku"
          );
          setClassificationData(data);
        } catch (err) {
          console.error("Erro ao buscar dados de classificação:", err);
        } finally {
          setIsClassificationLoading(false);
        }
      } else {
        setClassificationData(null);
      }
    };

    fetchClassificationData();
  }, [selectedProduct]);

  const getClassificationValue = (productId: number, classification: ClassificationType, totalValue: number): number => {
    const productData = productClassificationData[productId];
    if (!classification || !productData || productData.total === 0) return 0;
    const proportion = productData[classification] / productData.total;
    return totalValue * proportion;
  };
  
  const handleProductSelect = (product: StockItem) => {
    setSelectedProduct(product);
    setSelectedClassification(null); // Limpar filtro de classificação ao selecionar produto
  };

  const clearSelection = () => {
    setSelectedProduct(null);
    setSelectedClassification(null);
  };

  const handleClassificationClick = (classification: ClassificationType) => {
    // Se clicar na mesma classificação, desseleciona
    if (selectedClassification === classification) {
      setSelectedClassification(null);
    } else {
      setSelectedClassification(classification);
    }
  };

  const displayQuantity = selectedProduct && selectedClassification
  ? getClassificationQuantity(selectedProduct.productId, selectedClassification)
  : selectedProduct
    ? selectedProduct.quantity
    : selectedClassification
      ? overallClassificationData ? overallClassificationData[selectedClassification] : 0
      : stockTotal?.quantity;

  const displayValue = selectedProduct && selectedClassification
  ? getClassificationValue(selectedProduct.productId, selectedClassification, selectedProduct.value)
  : selectedProduct
    ? selectedProduct.value
    : selectedClassification && filteredItems.length > 0
      ? filteredItems.reduce((sum, item) => {
          // Corrigindo o cálculo do valor para considerar a proporção da classificação
          if (selectedClassification) {
            return sum + getClassificationValue(item.productId, selectedClassification, item.value);
          }
          return sum + item.value;
        }, 0)
      : stockTotal?.value;
    
  const displayClassification = selectedProduct ? classificationData : overallClassificationData;
  const isDisplayClassificationLoading = selectedProduct ? isClassificationLoading : isLoading;

  return (
    <div className="min-h-screen bg-synergy-light flex flex-col">
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-synergy-dark mb-2">Dashboard</h1>
            <p className="text-muted-foreground">
              Visão geral das análises e métricas de vendas.
            </p>
          </div>

          <div className="mb-6">             
            <StockClassification
              data={displayClassification}
              isLoading={isDisplayClassificationLoading}
              title={selectedProduct 
                ? `Classificação de Estoque: ${selectedProduct.productName}` 
                : selectedClassification 
                  ? `Produtos com Classificação: ${getClassificationLabel(selectedClassification)}`
                  : "Classificação de Estoque Geral"
              }
              onCategoryClick={handleClassificationClick}
              selectedCategory={selectedClassification}
              enableFiltering={true}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <InfoCard title={
              selectedProduct 
                ? `Quantidade em estoque: ${selectedProduct.productName}` 
                : selectedClassification
                  ? `Quantidade em estoque: ${getClassificationLabel(selectedClassification)}`
                  : "Quantidade total em estoque"
            }>
              <p className="text-2xl font-semibold">
                {isLoading ? "Carregando..." : displayQuantity || 0}
              </p>          
            </InfoCard>

            <InfoCard title={
              selectedProduct 
                ? `Valor em estoque: ${selectedProduct.productName}` 
                : selectedClassification
                  ? `Valor em estoque: ${getClassificationLabel(selectedClassification)}`
                  : "Valor total em estoque"
            }>
              <p className="text-2xl font-semibold">
                {isLoading ? "Carregando..." : `R$ ${(displayValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </p>
            </InfoCard>
            {selectedProduct && (
              <InfoCard title="Preço Unitário">
                <p className="text-2xl font-semibold"> 
                  R$ {selectedProduct.unitPrice.toFixed(2)}
                </p>
              </InfoCard>
            )}
            {selectedClassification && !selectedProduct && (
              <InfoCard title="Produtos nesta categoria">
                <p className="text-2xl font-semibold"> 
                  {filteredItems.length}
                </p>
              </InfoCard>
            )}
          </div>

          {/*<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-blue-800">Margem Bruta Média</h3>
                  <div className="h-10 w-10 rounded-full bg-blue-200 flex items-center justify-center">
                    <span className="text-blue-700 font-bold">%</span>
                  </div>
                </div>
                <div className="text-3xl font-bold text-blue-700">
                  {selectedProduct ? "32.5%" : "28.7%"}
                </div>
                <p className="text-sm text-blue-600 mt-2">
                  {selectedProduct 
                    ? "↑ Aumento de 2.8% em relação à média" 
                    : "↑ Aumento de 1.5% em relação ao mês anterior"}
                </p>
              </CardContent>
            </Card>
          </div>*/}
          
          <div className="mt-8">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-synergy-dark mb-4">
                {selectedClassification 
                  ? `Produtos com Classificação: ${getClassificationLabel(selectedClassification)}` 
                  : "Produtos em Estoque"}
              </h2>
              <div>
                {(selectedProduct || selectedClassification) && (              
                  <Button variant="outline" onClick={clearSelection}>
                    <X className="h-4 w-4 mr-2" />
                    Limpar filtros
                  </Button>
                )}
              </div>
            </div>
            <Card className="mt-6">
              <CardContent className="pt-6">
                {isLoading ? (
                  <div className="text-center py-8">Carregando produtos...</div>
                ) : filteredItems.length === 0 ? (
                  <div className="text-center py-8">Nenhum produto encontrado com esta classificação.</div>
                ) : (
                  <>
                    <div className="grid grid-cols-4 font-semibold border-b border-gray-300 pb-2">
                      <div>Produto</div>
                      <div className="text-right">Quantidade</div>
                      <div className="text-right">Valor (R$)</div>                      
                    </div>               
                    {filteredItems.map((item) => (
                      <div 
                        key={item.productId} 
                        className={`grid grid-cols-4 py-2 border-b border-gray-100 text-sm
                          cursor-pointer hover:bg-gray-50 ${selectedProduct?.productId === item.productId ? "bg-blue-50" : ""}`}
                        onClick={() => handleProductSelect(item)}
                      >
                        <div>{item.productName}</div>
                        <div className="text-right">{selectedClassification 
                          ? getClassificationQuantity(item.productId, selectedClassification)
                          : item.quantity}
                        </div>
                        <div className="text-right">
                          {selectedClassification 
                            ? getClassificationValue(item.productId, selectedClassification, item.value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        
                      </div>
                    ))}
                  </>
                )}                
              </CardContent>
            </Card>
          </div>
        </div>  
      </main>

      <footer className="border-t bg-white py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>LuminAI &copy; {new Date().getFullYear()} - Análise de vendas inteligente</p>
        </div>
      </footer>
    </div>
  );
};

// Funções auxiliares para exibir rótulos e cores de classificação
function getClassificationLabel(classification: ClassificationType): string {
  switch (classification) {
    case "stockOver": return "Stock Over";
    case "criticalAge": return "Idade Crítica";
    case "expired": return "Vencido";
    case "ok": return "OK";
    default: return "Desconhecido";
  }
}

function getClassificationColor(classification: ClassificationType): string {
  switch (classification) {
    case "stockOver": return "bg-blue-100 text-blue-800";
    case "criticalAge": return "bg-yellow-100 text-yellow-800";
    case "expired": return "bg-red-100 text-red-800";
    case "ok": return "bg-green-100 text-green-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

export default Dashboard;