import { useState } from "react";
import Navbar from "@/components/Navbar";
import StockFilter from "@/components/StockFilter";
import StockChart from "@/components/StockChart";
import StockClassification from "@/components/StockClassification";
import { StockFilterParams, StockHistoryResponse, StockClassificationData } from "@/models/stockTypes";
import { getStockData, getStockClassification } from "@/services/stockService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const Estoque = () => {
  const [stockData, setStockData] = useState<StockHistoryResponse | null>(null);
  const [classificationData, setClassificationData] = useState<StockClassificationData | null>(null);
  const [displayType, setDisplayType] = useState<"quantity" | "value">("quantity");
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [isLoading, setIsLoading] = useState(false);
  const [isClassificationLoading, setIsClassificationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchCompleted, setSearchCompleted] = useState(false);
  const [currentParams, setCurrentParams] = useState<StockFilterParams | null>(null);

  // Função para lidar com a mudança de filtros
  const handleFilterChange = async (params: StockFilterParams) => {
    // Verificar se apenas o tipo de exibição ou gráfico mudou
    const onlyDisplayOptionsChanged = 
      currentParams && 
      params.query === currentParams.query &&
      params.searchType === currentParams.searchType &&
      params.startDate === currentParams.startDate &&
      params.endDate === currentParams.endDate &&
      (params.displayType !== currentParams.displayType || 
       params.chartType !== currentParams.chartType);
    
    // Atualizar os estados de exibição
    setDisplayType(params.displayType);
    setChartType(params.chartType);
    
    // Se apenas as opções de visualização mudaram, não precisamos fazer uma nova requisição
    if (onlyDisplayOptionsChanged) {
      setCurrentParams(params);
      return;
    }
    
    // Caso contrário, fazer uma nova requisição ao servidor
    setIsLoading(true);
    setError(null);
    setSearchCompleted(false);
    
    try {
      // Buscar dados de estoque
      const data = await getStockData(params);
      setStockData(data);
      setSearchCompleted(true);
      setCurrentParams(params);
      
      // Buscar dados de classificação de estoque (independente das datas)
      setIsClassificationLoading(true);
      const classificationData = await getStockClassification(params.query, params.searchType);
      setClassificationData(classificationData);
    } catch (err) {
      setError("Erro ao buscar dados de estoque. Tente novamente.");
      console.error("Erro ao buscar dados de estoque:", err);
    } finally {
      setIsLoading(false);
      setIsClassificationLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-synergy-light flex flex-col">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-8">
          <div>
            {currentParams && (
              <StockClassification 
                data={classificationData} 
                isLoading={isClassificationLoading} 
              />
            )}
          </div>

          {/* Componente de filtro */}
          <StockFilter onFilterChange={handleFilterChange} />
          
          {/* Componente de classificação de estoque */}
          

          {/* Estado de carregamento */}
          {isLoading && (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-synergy-blue"></div>
            </div>
          )}

          {/* Mensagem de erro */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4 mr-2" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Gráfico de estoque */}
          {!isLoading && !error && stockData && (
            <StockChart 
              data={stockData} 
              displayType={displayType} 
              chartType={chartType} 
            />
          )}

          {/* Mensagem quando não há resultados mas a busca foi completada */}
          {!isLoading && !error && searchCompleted && !stockData && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">Nenhum resultado encontrado</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  Não foram encontrados dados de estoque para o produto e período selecionados.
                  Verifique se o produto existe e se há registros de entrada ou saída no período informado.
                </p>
              </CardContent>
            </Card>
          )}
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

export default Estoque;
