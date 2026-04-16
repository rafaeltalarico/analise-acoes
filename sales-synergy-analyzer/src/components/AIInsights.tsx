import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, TrendingUp, TrendingDown, AlertCircle, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getProductInsights } from "@/services/aiService";
import type { AIInsightsResponse, ProductInsightType, ProductInsight } from "@/models/types";



interface AIInsightsProps {
  productId: string;
  productName: string;
  salesData?: any;
  stockData?: any;
  relatedProducts?: any[];
}

const AIInsights  = ({ productId, productName, salesData, stockData, relatedProducts }: AIInsightsProps) => {
  const [insights, setInsights] = useState<AIInsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  

  useEffect(() => {
    const fetchInsights = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const data = await getProductInsights(productId, salesData, stockData, relatedProducts);
        setInsights(data);
      } catch (err) {
        console.error("Error fetching AI insights:", err);
        setError("Não foi possível gerar insights para este produto. Tente novamente mais tarde.");
      } finally {
        setLoading(false);
      }
    };

    if (productId) {
      fetchInsights();
    }
  }, [productId, salesData, stockData, relatedProducts]);

  const getInsightIcon = (type: ProductInsight['type']) => {
    switch (type) {
      case 'positive':
        return <TrendingUp className="h-5 w-5 text-green-500" />;
      case 'negative':
        return <TrendingDown className="h-5 w-5 text-red-500" />;
      case 'suggestion':
        return <ArrowRight className="h-5 w-5 text-blue-500" />;
      case 'neutral':
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getInsightColor = (type: ProductInsight['type']) => {
    switch (type) {
      case 'positive':
        return 'bg-green-50 border-green-200';
      case 'negative':
        return 'bg-red-50 border-red-200';
      case 'suggestion':
        return 'bg-blue-50 border-blue-200';
      case 'neutral':
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const fakeData: AIInsightsResponse = {
    summary: `Resumo do produto ${productId}`,
    insights: [
      {
        title: "Vendas em alta",
        description: "O produto teve aumento nas vendas de 15% nos últimos 30 dias.",
        type: "positive",  // <= Aqui deve ser um dos valores exatos do union type
        metric: {
          value: 15,
          unit: "%",
          change: 5,
        },
      },
    ],
  };
  
  setInsights(fakeData);

  return (
    <Card className="border border-blue-100">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-blue-500" />
          <CardTitle className="text-xl">Insights de IA</CardTitle>
        </div>
        <CardDescription>
          Análise inteligente para {productName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-500">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p>{error}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-sm text-blue-800">{insights?.summary}</p>
            </div>
            
            <div className="grid gap-3">
              {insights?.insights.map((insight, index) => (
                <div 
                  key={index} 
                  className={`p-3 rounded-lg border ${getInsightColor(insight.type)}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getInsightIcon(insight.type)}
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">{insight.title}</h4>
                      <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
                      
                      {insight.metric && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="font-semibold">
                            {insight.metric.value}{insight.metric.unit}
                          </span>
                          {insight.metric.change && (
                            <span className={insight.metric.change > 0 ? "text-green-500" : "text-red-500"}>
                              {insight.metric.change > 0 ? "↑" : "↓"}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AIInsights;