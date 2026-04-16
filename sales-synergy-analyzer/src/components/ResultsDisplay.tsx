import { useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, XAxis, YAxis, Tooltip, Bar, ResponsiveContainer, Cell } from "recharts";
import { ArrowDown, ArrowUp, BarChart2, List, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RelatedProduct {
  name: string;
  percentage: number;
  absoluteValue: number;
}

export interface ProductResult {
  productName: string;
  productId: number;
  mainProductName: string;
  totalSales: number;
  salesDifference: {
    percentage: number;
    absoluteValue: number;
    isIncrease: boolean;
  };
  relatedProducts: RelatedProduct[];
  showComparison: boolean;
  showCrossSell?: boolean;
  firstStartDate: string;
  firstEndDate: string;
  secondStartDate?: string;
  secondEndDate?: string;
  firstDateRangeChecked?: boolean;
  secondDateRangeChecked?: boolean;

}

interface ResultsDisplayProps {
  result: ProductResult | null;
  comparisonType: "compare" | "until";
  showCrossSell?: boolean;
  mainProductName: string;
  secondStartDate?: string;
  secondEndDate?: string;
  firstDateRangeChecked?: boolean;
  secondDateRangeChecked?: boolean;

}

const ResultsDisplay = ({ result, comparisonType, showCrossSell = true }: ResultsDisplayProps) => {
  const [displayType, setDisplayType] = useState<"list" | "chart">("list");
  const [valueType, setValueType] = useState<"percentage" | "absolute">("absolute");

  if (!result) return null;

  const chartData = result.relatedProducts.map((product) => ({
    name: product.name,
    value: product.percentage,
  }));
  
  const formatComparisonMessage = (result: ProductResult) => {
    const { firstStartDate, firstEndDate, secondStartDate, secondEndDate, salesDifference, productName, relatedProducts } = result;
  
    const formattedFirstStartDate = new Date(firstStartDate).toLocaleDateString("pt-BR");
    const formattedFirstEndDate = new Date(firstEndDate).toLocaleDateString("pt-BR");
    
    // Format secondEndDate only if it exists and is checked
    const formattedSecondStartDate = secondStartDate && result.secondDateRangeChecked ? new Date(secondStartDate).toLocaleDateString("pt-BR") : "";
    const formattedSecondEndDate = secondEndDate && result.secondDateRangeChecked ? new Date(secondEndDate).toLocaleDateString("pt-BR") : "";

    
    
    // Verificação explícita para quando há apenas um filtro de data
    if (secondStartDate === undefined || secondEndDate === undefined || !result.secondDateRangeChecked) {
      if (comparisonType === "until") {
        return {
          text: `${result.totalSales} un. vendidas`,
          period: `Período: ${formattedFirstStartDate} até ${formattedFirstEndDate}`,
          icon: "calendar"
        };
      } else {
        return {
          text: `${result.totalSales} un. vendidas`,
          period: `Data: ${formattedFirstEndDate}`,
          icon: "calendar-day"
        };
      }
    }
    
    if (!result.firstDateRangeChecked && !result.secondDateRangeChecked) {
      return {
        text: "Nenhum período selecionado para análise.",
        period: "",
        icon: "warning"
      };
    }
  
    // Primeiro período selecionado, segundo não
    if (result.firstDateRangeChecked && !result.secondDateRangeChecked) {
      if (comparisonType === "until") {
        return {
          text: `${result.totalSales} un. vendidas`,
          period: `Período: ${formattedFirstStartDate} até ${formattedFirstEndDate}`,
          icon: "calendar"
        };
      } else if (comparisonType === "compare") {
        return {
          text: `${result.totalSales} un. vendidas`,
          period: `Data: ${formattedFirstEndDate}`,
          icon: "calendar-day"
        };
      }
    }
  
    // Segundo período selecionado, primeiro não
    if (!result.firstDateRangeChecked && result.secondDateRangeChecked) {
      if (comparisonType === "until") {
        return {
          text: `${result.totalSales} un. vendidas`,
          period: `Período: ${formattedSecondStartDate} até ${formattedSecondEndDate}`,
          icon: "calendar"
        };
      } else if (comparisonType === "compare") {
        return {
          text: `${result.totalSales} un. vendidas`,
          period: `Data: ${formattedSecondEndDate}`,
          icon: "calendar-day"
        };
      }
    }
  
    // Ambos períodos selecionados
    if (result.firstDateRangeChecked && result.secondDateRangeChecked) {
      if (comparisonType === "until") {
        return {
          text: `${result.totalSales} un. vendidas`,
          period: `Período: ${formattedSecondStartDate} até ${formattedSecondEndDate}`,
          icon: "calendar"
        };
      } else if (comparisonType === "compare") {
        return {
          text: `${result.totalSales} un. vendidas`,
          period: `Comparação: ${formattedFirstStartDate} a ${formattedFirstEndDate} vs. ${formattedSecondStartDate} a ${formattedSecondEndDate}`,
          icon: "compare"
        };
      }
    }
  
    // Fallback para casos não cobertos
    return {
      text: `${result.totalSales} un. vendidas`,
      period: "",
      icon: "info"
    };
  };

  

  

  return (
    <div className="w-full space-y-6 animate-fade-in">
      <Card className="w-full border border-synergy-blue/20 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-synergy-light to-synergy-blue/5 pt-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-xl sm:text-2xl font-semibold">{result.productName}</h2>
          </div>
          <div className="text-sm text-muted-foreground border-l-2 border-synergy-blue/30 pl-3 italic">
            {comparisonType === "compare" 
              ? "Resultado da comparação entre as datas selecionadas."
              : "Resultado do recorte das vendas até a data selecionada."}
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center"> 
              <div className="flex gap-3">
                {/* Conditional rendering for first date block */}
                {comparisonType === "compare" && !((!result.firstDateRangeChecked && result.secondDateRangeChecked)) && (
                  <div className="bg-white/90 px-4 py-2 rounded-md border border-synergy-blue/20 mb-3 shadow-sm">
                    <div className="font-medium text-synergy-blue">{result.salesDifference.isIncrease ? result.totalSales - result.salesDifference.absoluteValue : result.totalSales + result.salesDifference.absoluteValue} un. vendidas</div>
                    <div className="text-sm text-gray-600">Data: {new Date(result.firstStartDate).toLocaleDateString("pt-BR")}</div>
                  </div>
                )}
                {comparisonType === "compare" && !result.firstDateRangeChecked && result.secondDateRangeChecked && (
                  <div className="bg-white/90 px-4 py-2 rounded-md border border-synergy-blue/20 mb-3 shadow-sm">
                    <div className="font-medium text-synergy-blue">{result.salesDifference.isIncrease ? result.totalSales - result.salesDifference.absoluteValue : result.totalSales + result.salesDifference.absoluteValue} un. vendidas</div>
                    <div className="text-sm text-gray-600">Data: {new Date(result.secondStartDate).toLocaleDateString("pt-BR")}</div>
                  </div>
                )}  
                {comparisonType === "compare" && !result.firstDateRangeChecked && result.secondDateRangeChecked && (
                  <div className="bg-white/90 px-4 py-2 rounded-md border border-synergy-blue/20 mb-3 shadow-sm">
                    <div className="font-medium text-synergy-blue">{result.salesDifference.absoluteValue} un. vendidas</div>
                    <div className="text-sm text-gray-600">Data: {new Date(result.secondEndDate).toLocaleDateString("pt-BR")}</div>
                  </div>
                )}
                {!(comparisonType === "compare" && !result.firstDateRangeChecked && result.secondDateRangeChecked) && (
                  <div className="bg-white/90 px-4 py-2 rounded-md border border-synergy-blue/20 mb-3 shadow-sm">
                    <div className="font-medium text-synergy-blue">{formatComparisonMessage(result).text}</div>
                    <div className="text-sm text-gray-600">{formatComparisonMessage(result).period}</div>
                  </div>
                )}
              </div>                
            </div>
           
            <div className="flex flex-col sm:flex-row gap-4 mb-5 items-center p-3">
              <div className="bg-white/80 p-3 rounded-md border border-synergy-blue/10 shadow-sm">
                <div className="flex flex-col gap-2">
                  <div className="text-xs font-medium text-synergy-blue">
                    Exibir valores em:
                  </div>
                  <RadioGroup
                    value={valueType}
                    onValueChange={(value) => setValueType(value as "percentage" | "absolute")}
                    className="flex items-center space-x-2"
                  >
                    <div className="flex items-center space-x-1">
                      <RadioGroupItem value="absolute" id="absolute" />
                      <Label htmlFor="absolute" className="text-xs font-medium">123</Label>
                    </div>
                    <div className="flex items-center space-x-1">
                      <RadioGroupItem value="percentage" id="percentage" />
                      <Label htmlFor="percentage" className="text-xs font-medium">%</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div> 
              <div className="bg-white/80 p-3 rounded-md border border-synergy-blue/10 shadow-sm justify-center items-center">
                <div className="flex flex-col gap-2">
                  <div className="text-xs font-medium text-synergy-blue text-center">
                    Exibir como:
                  </div>
                  <RadioGroup
                    value={displayType}
                    onValueChange={(value) => setDisplayType(value as "list" | "chart")}
                    className="flex items-center space-x-2"
                  >
                    <div className="flex items-center space-x-1">
                      <RadioGroupItem value="chart" id="chart" />
                      <Label htmlFor="chart" className="text-xs font-medium flex items-center">
                        <BarChart2 className="h-3 w-3 mr-1" />
                        GRÁFICO
                      </Label>
                    </div>
                    <div className="flex items-center space-x-1">
                      <RadioGroupItem value="list" id="list" />
                      <Label htmlFor="list" className="text-xs font-medium flex items-center">
                        <List className="h-3 w-3 mr-1" />
                        LISTA
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </div>
          </div>
          
          {result.showComparison && (
              <div className="mt-4 mb-6 from-synergy-blue/5 to-white p-4 rounded-md">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "flex items-center gap-2 py-2 px-3 rounded-md text-sm font-medium shadow-sm",
                    result.salesDifference.absoluteValue === 0 ? "bg-gray-50 text-gray-700 border border-gray-200" :
                    result.salesDifference.isIncrease ? "bg-green-50 text-green-700 border border-green-200" : 
                    "bg-red-50 text-red-700 border border-red-200"
                  )}>
                    <div className="flex flex-col">
                      <span className="text-xs uppercase">Variação</span>
                      <span className="text-base font-bold">
                        {valueType === "percentage" 
                          ? `${result.salesDifference.percentage}%` 
                          : `${result.salesDifference.absoluteValue} un.`}
                      </span>
                    </div>
                    <div className="ml-2">
                      {result.salesDifference.absoluteValue === 0 ? (
                        <div className="bg-gray-200 rounded-full p-2">
                          <Minus className="h-4 w-4" />
                        </div>
                      ) : result.salesDifference.isIncrease ? (
                        <div className="bg-green-200 rounded-full p-2">
                          <ArrowUp className="h-4 w-4" />
                        </div>
                      ) : (
                        <div className="bg-red-200 rounded-full p-2">
                          <ArrowDown className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  </div>                                    
                </div>
                {comparisonType === "until" && ((result.firstDateRangeChecked && result.secondDateRangeChecked) || (!result.firstDateRangeChecked && !result.secondDateRangeChecked)) && (
                  <div className="bg-yellow-50 px-3 py-1 mt-4 rounded-md border border-yellow-200 text-xs text-yellow-800 w-fit">
                    <span className="font-medium"> 
                      { result.salesDifference.isIncrease
                      ? result.totalSales - result.salesDifference.absoluteValue
                      : result.totalSales + result.salesDifference.absoluteValue} 
                      un. vendidas de {new Date(result.firstStartDate).toLocaleDateString("pt-BR")} até {new Date(result.firstEndDate).toLocaleDateString("pt-BR")} 
                    </span>
                  </div>
                )}
                {comparisonType === "until" && ((result.firstDateRangeChecked && !result.secondDateRangeChecked) || (!result.firstDateRangeChecked && result.secondDateRangeChecked)) && (
                  <div className="bg-yellow-50 px-3 py-1 mt-4 rounded-md border border-yellow-200 text-xs text-yellow-800 w-fit">
                    <span className="font-medium">Em comparação ao {result.mainProductName} no mesmo período pesquisado</span>
                  </div>
                )}
              </div>
            )}
            
          
        </CardHeader>

        <CardContent className="p-6">
          
          
          
          
          
          {showCrossSell ? (
            <div className="w-full mt-4">
              <Card className="results-card border border-gray-200 shadow-sm">
                <CardHeader className="pb-2 border-b bg-yellow-50/50 py-3">
                  <CardTitle className="text-sm font-medium text-gray-700">
                    Produtos mais vendidos junto com {result.productName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {displayType === "list" ? (
                    <div>
                      {result.relatedProducts.length > 0 ? (
                        <div>                         
                          {result.relatedProducts
                          .sort((a, b) => {
                            if (valueType === "percentage") {
                              return b.percentage - a.percentage;
                            } else {
                              return b.absoluteValue - a.absoluteValue;
                            }
                          })
                          .map((product, index) => (
                            <div 
                              key={product.name} 
                              className={cn(
                                "flex items-center justify-between py-4 px-5 animate-result-item",
                                index % 2 === 0 ? "bg-gray-100/50" : "bg-white"
                              )}
                              style={{ animationDelay: `${index * 0.1}s` }}
                            >
                              <span className="font-medium text-gray-800">{product.name}</span>
                              <span className="text-base font-bold text-gray-900">
                                {valueType === "percentage" ? `${product.percentage}%` : product.absoluteValue}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-4 text-center text-muted-foreground">
                          Não há dados suficientes para análise de cross-sell neste período.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-60 sm:h-72 w-full py-2 px-2">
                      {result.relatedProducts.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={result.relatedProducts
                              .sort((a, b) => {
                                if (valueType === "percentage") {
                                  return b.percentage - a.percentage;
                                } else {
                                  return b.absoluteValue - a.absoluteValue;
                                }
                              })
                              .map((product) => ({
                              name: product.name,
                              value: valueType === "percentage" ? product.percentage : product.absoluteValue,
                            }))}
                            layout="vertical"
                            margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                          >
                            <XAxis type="number" domain={[0, 100]} />
                            <YAxis dataKey="name" type="category" width={140} 
                            tick={{ fontSize: 12 }}
                            interval={0}/>
                            <Tooltip 
                              formatter={(value) => [
                                `${value}${valueType === "percentage" ? "%" : ""}`, 
                                'Frequência'
                              ]}
                              contentStyle={{ 
                                backgroundColor: 'white', 
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0'
                              }}
                            />
                            <Bar dataKey="value" barSize={20} radius={[4, 4, 0, 0]}
                            animationDuration={500}>
                              {result.relatedProducts.map((_, index) => (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill="#36A2EB" 
                                  fillOpacity={1 - (index * 0.15)} 
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground">
                          Não há dados suficientes para análise de cross-sell neste período.
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="w-full mt-4">
              <Card className="results-card border border-gray-200 shadow-sm">
                <CardContent>
                  <div className="py-4 text-center text-muted-foreground">
                    Não é gerado resultado de vendas atreladas ao produto pesquisado, pois não há um período selecionado. Para exibir o resultado, basta ativar qualquer um dos períodos.
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResultsDisplay;