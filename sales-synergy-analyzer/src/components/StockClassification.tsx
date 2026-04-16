import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type ClassificationType = "stockOver" | "criticalAge" | "expired" | "ok" | null;

export interface StockClassificationData {
  stockOver: number;
  criticalAge: number;
  expired: number;
  ok: number;
  total: number;
}

interface StockClassificationProps {
  data: StockClassificationData | null;
  isLoading: boolean;
  title?: string;
  onCategoryClick?: (category: ClassificationType) => void;
  selectedCategory?: ClassificationType;
  enableFiltering?: boolean;
}

const StockClassification = ({ data, isLoading, title = "Classificação do Estoque Atual",
  onCategoryClick,
  selectedCategory,
  enableFiltering = false }: StockClassificationProps) => {
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-synergy-blue"></div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-32">
          <p className="text-muted-foreground">Nenhum dado disponível para exibição.</p>
        </CardContent>
      </Card>
    );
  }

  // Extrair valores do objeto data
  const { stockOver, criticalAge, expired, ok, total } = data;

  // Calcular percentuais para cada categoria
  const stockOverPercentage = total > 0 ? Math.round((stockOver / total) * 100) : 0;
  const criticalAgePercentage = total > 0 ? Math.round((criticalAge / total) * 100) : 0;
  const expiredPercentage = total > 0 ? Math.round((expired / total) * 100) : 0;
  const okPercentage = total > 0 ? Math.round((ok / total) * 100) : 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Classificação do Estoque Atual</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <TooltipProvider>
            <div className={`bg-green-100 p-4 rounded-lg ${
                enableFiltering ? 'cursor-pointer hover:bg-green-200 transition-colors' : ''
              } ${selectedCategory === 'ok' ? 'ring-2 ring-green-500' : ''}`}
              onClick={() => enableFiltering && onCategoryClick && onCategoryClick('ok')}
            >
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <h3 className="font-medium">OK</h3>
                </div>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="outline" className="bg-green-300">{okPercentage}%</Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Produtos com estoque adequado e validade normal</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-2xl font-bold text-green-700">{ok}</p>
            </div>

            <div className={`bg-red-300 p-4 rounded-lg ${
                enableFiltering ? 'cursor-pointer hover:bg-red-400 transition-colors' : ''
              } ${selectedCategory === 'criticalAge' ? 'ring-2 ring-red-500' : ''}`}
              onClick={() => enableFiltering && onCategoryClick && onCategoryClick('criticalAge')}
            >
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center">
                  <Clock className="h-5 w-5 text-red-500 mr-2" />
                  <h3 className="font-medium">Idade Crítica</h3>
                </div>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="outline" className="bg-red-200">{criticalAgePercentage}%</Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Produtos com menos de 15 dias de cobertura ou validade menor que 90 dias</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-2xl font-bold text-red-700">{criticalAge}</p>
            </div>

            <div className={`bg-yellow-200 p-4 rounded-lg ${
                enableFiltering ? 'cursor-pointer hover:bg-yellow-300 transition-colors' : ''
              } ${selectedCategory === 'stockOver' ? 'ring-2 ring-yellow-500' : ''}`}
              onClick={() => enableFiltering && onCategoryClick && onCategoryClick('stockOver')}
            >
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
                  <h3 className="font-medium">Stock Over</h3>
                </div>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="outline" className="bg-yellow-100">{stockOverPercentage}%</Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Produtos com mais de 30 dias de cobertura</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-2xl font-bold text-yellow-700">{stockOver}</p>
            </div>

            <div className={`bg-gray-200 p-4 rounded-lg ${
                enableFiltering ? 'cursor-pointer hover:bg-gray-300 transition-colors' : ''
              } ${selectedCategory === 'expired' ? 'ring-2 ring-gray-500' : ''}`}
              onClick={() => enableFiltering && onCategoryClick && onCategoryClick('expired')}
            >
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-gray-500 mr-2" />
                  <h3 className="font-medium">Vencido</h3>
                </div>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="outline" className="bg-gray-100">{expiredPercentage}%</Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Produtos com data de validade expirada</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-2xl font-bold text-gray-700">{expired}</p>
            </div>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
};

export default StockClassification;