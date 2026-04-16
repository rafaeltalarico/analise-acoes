import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Search, BarChart2, LineChart, Calendar as CalendarIcon } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { StockFilterParams } from "@/models/stockTypes";

interface StockFilterProps {
  onFilterChange: (params: StockFilterParams) => void;
}

const StockFilter = ({ onFilterChange }: StockFilterProps) => {
  // Estado para os filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"product" | "sku">("product");
  const [displayType, setDisplayType] = useState<"quantity" | "value">("quantity");
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  
  // Estado para armazenar o último filtro aplicado com sucesso
  const [lastAppliedFilter, setLastAppliedFilter] = useState<StockFilterParams | null>(null);
  
  // Estado para as datas
  const today = new Date();
  const [startDate, setStartDate] = useState<Date | undefined>(subDays(today, 7));
  const [endDate, setEndDate] = useState<Date | undefined>(today);
  const [dateOption, setDateOption] = useState("7days");
  
  // Estado para os popover de calendário
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [isEndOpen, setIsEndOpen] = useState(false);

  // Função para atualizar as datas com base na opção selecionada
  const updateDatesByOption = (option: string) => {
    setDateOption(option);
    
    switch (option) {
      case "today":
        setStartDate(today);
        setEndDate(today);
        break;
      case "7days":
        setStartDate(subDays(today, 7));
        setEndDate(today);
        break;
      case "30days":
        setStartDate(subDays(today, 30));
        setEndDate(today);
        break;
      case "custom":
        // Manter as datas atuais para seleção personalizada
        break;
    }
  };

  // Função para aplicar os filtros
  const handleApplyFilter = () => {
    if (!searchQuery.trim() || !startDate || !endDate) {
      // Validar que todos os campos obrigatórios estão preenchidos
      return;
    }

    const newFilter = {
      query: searchQuery,
      searchType,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      displayType,
      chartType
    };
    
    // Salvar o filtro aplicado para uso posterior
    setLastAppliedFilter(newFilter);
    onFilterChange(newFilter);
  };

  // Função para atualizar o tipo de exibição sem fazer nova requisição
  const handleDisplayTypeChange = (value: "quantity" | "value") => {
    setDisplayType(value);
    
    // Apenas notificar o componente pai sobre a mudança de tipo de exibição
    // sem fazer uma nova requisição ao servidor
    if (lastAppliedFilter) {
      onFilterChange({
        ...lastAppliedFilter,
        displayType: value
      });
    }
  };

  // Função para atualizar o tipo de gráfico sem fazer nova requisição
  const handleChartTypeChange = (value: "line" | "bar") => {
    setChartType(value);
    
    // Apenas notificar o componente pai sobre a mudança de tipo de gráfico
    // sem fazer uma nova requisição ao servidor
    if (lastAppliedFilter) {
      onFilterChange({
        ...lastAppliedFilter,
        chartType: value
      });
    }
  };

  return (
    <Card className="w-full mb-6">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Filtro de período */}
          <div>
            <h3 className="text-sm font-medium mb-2">Período</h3>
            <Tabs value={dateOption} onValueChange={updateDatesByOption} className="w-full">
              <TabsList className="grid grid-cols-4 mb-4">
                <TabsTrigger value="today">Hoje</TabsTrigger>
                <TabsTrigger value="7days">Últimos 7 dias</TabsTrigger>
                <TabsTrigger value="30days">Últimos 30 dias</TabsTrigger>
                <TabsTrigger value="custom">Personalizado</TabsTrigger>
              </TabsList>
              
              <TabsContent value="custom" className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Label htmlFor="start-date" className="text-xs mb-1 block">Data inicial</Label>
                  <Popover open={isStartOpen} onOpenChange={setIsStartOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="start-date"
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => {
                          setStartDate(date);
                          setIsStartOpen(false);
                        }}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="flex-1">
                  <Label htmlFor="end-date" className="text-xs mb-1 block">Data final</Label>
                  <Popover open={isEndOpen} onOpenChange={setIsEndOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="end-date"
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={(date) => {
                          setEndDate(date);
                          setIsEndOpen(false);
                        }}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </TabsContent>
            </Tabs>
          </div>
          
          {/* Pesquisa de produto */}
          <div>
            <h3 className="text-sm font-medium mb-2">Produto</h3>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Digite o nome do produto ou SKU"
                    className="pl-10"
                  />
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <RadioGroup
                  value={searchType}
                  onValueChange={(value) => setSearchType(value as "product" | "sku")}
                  className="flex items-center space-x-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="product" id="product" />
                    <Label htmlFor="product">Nome</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sku" id="sku" />
                    <Label htmlFor="sku">SKU</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </div>
          
          {/* Opções de visualização */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Exibir</h3>
              <RadioGroup
                value={displayType}
                onValueChange={handleDisplayTypeChange}
                className="flex items-center space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="quantity" id="quantity" />
                  <Label htmlFor="quantity">Quantidade</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="value" id="value" />
                  <Label htmlFor="value">Valor (R$)</Label>
                </div>
              </RadioGroup>
            </div>
            
            <div>
              <h3 className="text-sm font-medium mb-2">Tipo de gráfico</h3>
              <RadioGroup
                value={chartType}
                onValueChange={handleChartTypeChange}
                className="flex items-center space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="line" id="line" />
                  <Label htmlFor="line" className="flex items-center">
                    <LineChart className="h-4 w-4 mr-1" /> Linha
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="bar" id="bar" />
                  <Label htmlFor="bar" className="flex items-center">
                    <BarChart2 className="h-4 w-4 mr-1" /> Coluna
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
          
          {/* Botão de pesquisa */}
          <div className="flex justify-end">
            <Button 
              onClick={handleApplyFilter}
              className="bg-synergy-blue hover:bg-synergy-blue/90 transition-colors duration-200"
            >
              Pesquisar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StockFilter;