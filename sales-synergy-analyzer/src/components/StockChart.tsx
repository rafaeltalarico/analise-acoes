import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StockHistoryResponse } from "@/models/stockTypes";
import {
  LineChart,
  BarChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface StockChartProps {
  data: StockHistoryResponse | null;
  displayType: "quantity" | "value";
  chartType: "line" | "bar";
}

interface ChartDataItem {
  date: string;
  formattedDate: string;
  quantity: number;
  value: number;
  entries: number;
  outputs: number;
}

const StockChart = ({ data, displayType, chartType }: StockChartProps) => {
  if (!data || !data.history || data.history.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Dados de Estoque</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Nenhum dado disponível para exibição.</p>
        </CardContent>
      </Card>
    );
  }

  // Formatar os dados para o gráfico
  const chartData = data.history.map((item) => ({
    date: item.date,
    formattedDate: format(parseISO(item.date), "dd/MM", { locale: ptBR }),
    quantity: item.quantity,
    value: item.value,
    entries: item.entries,
    outputs: item.outputs
  }));

  // Determinar o título e o valor a ser exibido com base no displayType
  const displayValue = displayType === "quantity" ? "quantity" : "value";
  const displayTitle = displayType === "quantity" ? "Estoque" : "Valor";
  const yAxisLabel = displayType === "quantity" ? "Quantidade" : "Valor (R$)";

  // Formatar o valor para o tooltip
  const formatTooltipValue = (value: number) => {
    if (displayType === "value") {
      return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return value;
  };

  // Formatar dados adicionais para o tooltip
  const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ChartDataItem;
      return (
        <div className="bg-white p-4 border rounded shadow">
          <p className="font-medium">{`Data: ${data.formattedDate}`}</p>
          <p>{`${displayTitle}: ${formatTooltipValue(data[displayValue as keyof ChartDataItem] as number)}`}</p>
          <p>{`Entradas: ${data.entries}`}</p>
          <p>{`Saídas: ${data.outputs}`}</p>
        </div>
      );
    }
    return null;
  };

  // Renderizar o gráfico de linha ou barra com base no chartType
  const renderChart = () => {
    if (chartType === "line") {
      return (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="formattedDate"              
            />
            <YAxis               
              tickFormatter={(value) => displayType === "value" ? `R$ ${value}` : value}
            />
            <Tooltip content={<CustomTooltip />} />            
            <Line 
              type="monotone" 
              dataKey={displayValue}               
              stroke="#4f46e5" 
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      );
    } else {
      return (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 40, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="formattedDate" 
            />
            <YAxis
              tickFormatter={(value) => displayType === "value" ? `R$ ${value}` : value}
            />
            <Tooltip content={<CustomTooltip />} />           
            <Bar 
              dataKey={displayValue}              
              fill="#4f46e5" 
              barSize={30}
            />
          </BarChart>
        </ResponsiveContainer>
      );
    }
  };

  // Calcular dados adicionais
  const initialStock = data.initialStock;
  const finalStock = chartData.length > 0 ? 
    (displayType === "quantity" ? chartData[chartData.length - 1].quantity : chartData[chartData.length - 1].value) : 0;
  
  const initialValue = initialStock * (chartData.length > 0 && chartData[0].quantity > 0 ? (chartData[0].value / chartData[0].quantity) : 0);
  const initialDisplayValue = chartData.length > 0 ? (displayType === "quantity" ? chartData[0].quantity : chartData[0].value) : 0;
  const stockChange = finalStock - initialDisplayValue;
  const stockChangePercentage = initialDisplayValue > 0 ? ((stockChange / initialDisplayValue) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "N/A";

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>
          {data.sku ? `SKU ${data.sku}` : ""}{data.sku && data.productName ? " - " : ""}{data.productName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-500">Estoque em {chartData.length > 0 ? chartData[0].formattedDate : ""}</p>
            <p className="text-2xl font-bold">
              {displayType === "value" ? `R$ ${initialDisplayValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : initialDisplayValue}
            </p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-500">Estoque em {chartData.length > 0 ? chartData[chartData.length - 1].formattedDate : ""}</p>
            <p className="text-2xl font-bold">
              {displayType === "value" ? `R$ ${finalStock.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : finalStock}
            </p>
          </div>
          <div className={`p-4 rounded-lg ${stockChange >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className={`text-sm ${stockChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>Variação</p>
            <p className="text-2xl font-bold">
              {stockChange >= 0 ? '+' : ''}
              {displayType === "value" ? `R$ ${Math.abs(stockChange).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : Math.abs(stockChange)} 
              ({stockChangePercentage}%)
            </p>
          </div>
        </div>
        {renderChart()}
      </CardContent>
    </Card>
  );
};

export default StockChart;