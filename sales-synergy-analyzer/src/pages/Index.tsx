import { useState } from "react";
import Navbar from "@/components/Navbar";
import DateRangeSelector from "@/components/DateRangeSelector";
import ProductSearch from "@/components/ProductSearch";
import ResultsDisplay, { ProductResult } from "@/components/ResultsDisplay";
import InfoCard from "@/components/InfoCard";
import { analyzeSales } from "@/services/apiClient";
import { getProductByNameOrId } from "@/services/apiClient";
import { useToast } from "@/hooks/use-toast";
import { ProductSearchResult } from "@/models/types";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";


const Index = () => {
  const [firstStartDate, setFirstStartDate] = useState<Date | undefined>(
    new Date("2024-02-27")
  );
  const [firstEndDate, setFirstEndDate] = useState<Date | undefined>(
    new Date("2025-02-27")
  );
  const [firstComparisonType, setFirstComparisonType] = useState<"compare" | "until">("compare");
  
  const [secondStartDate, setSecondStartDate] = useState<Date | undefined>(
    new Date("2025-02-27")
  );
  const [secondEndDate, setSecondEndDate] = useState<Date | undefined>(
    new Date("2025-02-27")
  );
  const [secondComparisonType, setSecondComparisonType] = useState<"compare" | "until">("compare");
  
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [activeResult, setActiveResult] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [searchCount, setSearchCount] = useState(1);
  const [dateRangeCount, setDateRangeCount] = useState(1);
  const [firstDateRangeChecked, setFirstDateRangeChecked] = useState(true);
  const [secondDateRangeChecked, setSecondDateRangeChecked] = useState(true);
  const [lastFirstDateRangeChecked, setLastFirstDateRangeChecked] = useState(true);
  const [lastSecondDateRangeChecked, setLastSecondDateRangeChecked] = useState(true);
  const [lastDateRangeCount, setLastDateRangeCount] = useState(1);
  const { toast } = useToast();
  const tips = [
    "Insira um SKU entre 1 e 20",
    "Selecione 'comparar' para comparar 2 datas diferentes",
    "Selecione 'até' para um recorte de data",
  ];
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  const handleNext = () => {
    if (currentTipIndex < tips.length - 1) {
      setCurrentTipIndex(currentTipIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentTipIndex > 0) {
      setCurrentTipIndex(currentTipIndex - 1);
    }
  };

  const handleSearch = async (query: string, searchType: "product" | "sku", searchIndex: number = 0) => {
    setIsLoading(true);   
    try {
      const product = await getProductByNameOrId(query, searchType);
      if (!product) {
        if (searchIndex === 0) {
          setSearchResults([]);
        }

        toast({
          title: "Produto não encontrado",
          description: "Verifique o nome ou ID do produto e tente novamente.",
          variant: "destructive",
        });
        
        setIsLoading(false);
        return;
    }

    const productExists = searchResults.some((result, idx) => result.productId === product.id_produto && idx !== searchIndex);

    if (productExists) {
      toast({
        title: "Produto duplicado",
        description: "Este produto já está sendo pesquisado. Por favor, selecione um produto diferente.",
        variant: "destructive",
      });
      setIsLoading(false);
      return; // Retorna sem fazer a pesquisa
    }
    
    // Only consider second date range if it's actually visible
    const useFirstDateRange = firstDateRangeChecked || dateRangeCount === 1;
    const useSecondDateRange = secondDateRangeChecked && dateRangeCount > 1;
    const noCheckboxSelected = !useFirstDateRange && !useSecondDateRange && dateRangeCount > 1;
    const hasValidFirstDateRange = firstStartDate && firstEndDate;
    const hasValidSecondDateRange = secondStartDate && secondEndDate && dateRangeCount > 1;
    
    if ((!hasValidFirstDateRange && !hasValidSecondDateRange) ||
        (useFirstDateRange && !hasValidFirstDateRange) ||
        (useSecondDateRange && !hasValidSecondDateRange) ||
        (noCheckboxSelected && (!hasValidFirstDateRange || !hasValidSecondDateRange))) {
      toast({
        title: "Datas não selecionadas",
        description: "Por favor, selecione um período de análise válido.",
        variant: "destructive",
      });
      return;
    }
    
    if (dateRangeCount > 1) {
      if (noCheckboxSelected && (firstComparisonType !== "until" || secondComparisonType !== "until")) {
        toast({
          title: "Configuração inválida",
          description: "Para comparar sem selecionar períodos, ambos os radios devem estar em 'ATÉ'.",
          variant: "destructive",
        });
        return;
      }
      
      if (useFirstDateRange && useSecondDateRange && (firstComparisonType !== "until" || secondComparisonType !== "until")) {
        toast({
          title: "Configuração inválida",
          description: "Com ambos os períodos selecionados, os dois radios devem estar em 'ATÉ'.",
          variant: "destructive",
        });
        return;
      }
    }
    
    let startDate, endDate, comparisonType;
    const comparePeriods = dateRangeCount > 1 && ((useFirstDateRange && useSecondDateRange && firstComparisonType === "until" && secondComparisonType === "until") || 
                           (noCheckboxSelected && firstComparisonType === "until" && secondComparisonType === "until"));
    
    if (comparePeriods) {
      startDate = firstStartDate;
      endDate = firstEndDate;
      comparisonType = "until";
    } else {
      startDate = useFirstDateRange ? firstStartDate : secondStartDate;
      endDate = useFirstDateRange ? firstEndDate : secondEndDate;
      comparisonType = useFirstDateRange ? firstComparisonType : secondComparisonType;
    }

    setIsLoading(true);

    try {
  
      const isComparisonProduct = searchIndex > 0;
      const firstProductId = isComparisonProduct && searchResults.length > 0 ? searchResults[0].productId : undefined;
      
      const analysis = await analyzeSales(
        product.id_produto, 
        startDate, 
        endDate, 
        comparisonType, 
        isComparisonProduct, 
        firstProductId,
        null,
        comparePeriods,
        comparePeriods ? secondStartDate : undefined,
        comparePeriods ? secondEndDate : undefined
      );
      
      const newResult: ProductSearchResult = {
        id: searchIndex,
        productName: product.nome_produto,
        productId: product.id_produto,
        mainProductName: searchIndex === 0 ? product.nome_produto : (searchResults[0]?.productName || product.nome_produto),
        salesDifference: analysis.salesDifference,
        totalSales: analysis.endDateSales,
        firstStartDate: firstStartDate.toISOString(),
        firstEndDate: firstEndDate.toISOString(),
        secondStartDate: dateRangeCount > 1 ? (secondStartDate ? secondStartDate.toISOString() : undefined) : undefined, 
        secondEndDate: dateRangeCount > 1 ? (secondEndDate ? secondEndDate.toISOString() : undefined) : undefined,
        currentFirstStartDate: firstStartDate.toISOString(),
        currentFirstEndDate: firstEndDate.toISOString(),
        currentSecondStartDate: dateRangeCount > 1 ? (secondStartDate ? secondStartDate.toISOString() : undefined) : undefined,
        currentSecondEndDate: dateRangeCount > 1 ? (secondEndDate ? secondEndDate.toISOString() : undefined) : undefined,
        currentFirstDateRangeChecked: firstDateRangeChecked,
        currentSecondDateRangeChecked: secondDateRangeChecked,
        relatedProducts: analysis.relatedProducts.map(rp => ({
          name: rp.productName,
          percentage: rp.percentage,
          absoluteValue: rp.occurrences,
        })),
        showComparison: analysis.showComparison,
        comparisonType: comparisonType
      };

      console.log('Estado ao criar resultado:', {
        dateRangeCount,
        firstDateRangeChecked,
        secondDateRangeChecked,
        secondStartDate: secondStartDate ? 'definido' : 'indefinido',
        secondEndDate: secondEndDate ? 'definido' : 'indefinido'
      });

      const updatedResults = [...searchResults];
      updatedResults[searchIndex] = newResult;
      
      setSearchResults(updatedResults);
      setActiveResult(searchIndex);

      // Atualize os estados de "última pesquisa" após uma pesquisa bem-sucedida
      setLastFirstDateRangeChecked(firstDateRangeChecked);
      setLastSecondDateRangeChecked(secondDateRangeChecked);
      setLastDateRangeCount(dateRangeCount);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast({
        title: "Erro ao buscar dados",
        description: "Ocorreu um erro ao buscar os dados. Por favor, tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast({
        title: "Erro ao buscar dados",
        description: "Ocorreu um erro ao buscar os dados. Por favor, tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleResult = () => {
    if (searchResults.length > 1) {
      setActiveResult(activeResult === 0 ? 1 : 0);
    }
  };

  const handleAddSearch = () => {
    if (searchCount < 5) {
      setSearchCount(prevCount => prevCount + 1);
    }
  };

  const handleRemoveSearch = (index: number) => {
    setSearchCount(prevCount => prevCount - 1);
    const updatedResults = searchResults.filter((_, i) => i !== index);
    setSearchResults(updatedResults);
    setActiveResult(Math.min(activeResult, updatedResults.length - 1));
  };

  const handleRemoveSecondDateRange = () => {
    console.log('Estado antes de remover segundo filtro:', {
      dateRangeCount,
      firstDateRangeChecked,
      secondDateRangeChecked
    });
    
    // Garantir que o primeiro filtro esteja ativo
    setFirstDateRangeChecked(true);
    
    // Definir explicitamente que o segundo filtro não está mais selecionado
    setSecondDateRangeChecked(false);
    
    // Salva o estado atual antes de remover o segundo filtro
    const currentQuery = searchResults.length > 0 ? 
      { productId: searchResults[activeResult].productId, productName: searchResults[activeResult].productName } : 
      null;
      
    // Limpa os dados do segundo filtro e marca como removido
    setSecondStartDate(undefined);
    setSecondEndDate(undefined);
    setDateRangeCount(1);
    
    // Se tivermos um resultado atual, force uma nova pesquisa com apenas o filtro principal
    if (currentQuery && searchResults.length > 0) {
      console.log('Forçando nova pesquisa após remover filtro secundário');
      
      // Note: Não precisamos atualizar os estados de "última pesquisa" aqui,
      // isso será feito automaticamente dentro da função handleSearch após a pesquisa
      setTimeout(() => {
        handleSearch(currentQuery.productName, "product", activeResult);
      }, 100);
    } else {
      // Se não tivermos um resultado atual para forçar uma nova pesquisa,
      // atualizamos manualmente os estados de "última pesquisa"
      setLastFirstDateRangeChecked(true);
      setLastSecondDateRangeChecked(false);
      setLastDateRangeCount(1);
    }
    
    console.log('Estado depois de remover segundo filtro:', {
      dateRangeCount: 1,
      firstDateRangeChecked: true,
      secondDateRangeChecked: false
    });
  };
  const mainProductName = searchResults.length > 0 ? searchResults[0].productName : "";
  return (
    <div className="min-h-screen bg-synergy-light flex flex-col">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-synergy-dark mb-2">
              Análise de Vendas e Cross-Sell
            </h1>
            <p className="text-muted-foreground">
              Compare o desempenho de produtos e descubra oportunidades de cross-sell baseadas em dados reais de vendas.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <InfoCard title="Período de Análise">
                <DateRangeSelector
                  startDate={firstStartDate}
                  endDate={firstEndDate}
                  onStartDateChange={setFirstStartDate}
                  onEndDateChange={setFirstEndDate}
                  comparisonType={firstComparisonType}
                  onComparisonTypeChange={setFirstComparisonType}
                  onAddDateRange={() => setDateRangeCount(prev => Math.min(prev + 1, 2))}
                  hasMultipleDateRanges={dateRangeCount > 1}
                  isChecked={firstDateRangeChecked}
                  onCheckChange={(checked) => setFirstDateRangeChecked(checked)}
                />
                {dateRangeCount > 1 && (
                  <div className="mt-4">
                    <DateRangeSelector
                      startDate={secondStartDate}
                      endDate={secondEndDate}
                      onStartDateChange={setSecondStartDate}
                      onEndDateChange={setSecondEndDate}
                      comparisonType={secondComparisonType}
                      onComparisonTypeChange={setSecondComparisonType}
                      onRemoveSecondDateRange={handleRemoveSecondDateRange}
                      hasMultipleDateRanges={dateRangeCount > 1}
                      isSecondDateRange
                      isChecked={secondDateRangeChecked}
                      onCheckChange={(checked) => setSecondDateRangeChecked(checked)}
                    />
                  </div>
                )}
              </InfoCard>
            </div>

            <div className="sm:col-span-1">
              <InfoCard title="Tutorial" >
                <div className="flex items-center justify-between h-16 px-2 space-x-2">
                  <button                
                    onClick={handlePrev}
                    disabled={currentTipIndex === 0}
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:text-gray-300 disabled:bg-gray-50 disabled:cursor-not-allowed"
                  >
                    &lt;
                  </button>
                  <p className="text-sm text-center text-muted-foreground mx-2 overflow-hidden text-ellipsis leading-snug">
                    {tips[currentTipIndex]}
                  </p>
                  <button
                    
                    onClick={handleNext}
                    disabled={currentTipIndex === tips.length - 1}
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:text-gray-300 disabled:bg-gray-50 disabled:cursor-not-allowed"
                  >
                    &gt;
                  </button>
                </div>
              </InfoCard>
            </div>
          </div>

          <InfoCard title="Pesquisar Produto">
            <div className="space-y-4">
              {Array.from({ length: searchCount }).map((_, index) => (
                <ProductSearch 
                  key={index}
                  onSearch={(query, searchType) => handleSearch(query, searchType, index)} 
                  label={index === 0 ? "Produto Principal" : `Produto para Comparação ${index}`}
                  placeholder={index === 0 ? "Digite o nome do produto ou SKU..." : "Digite um produto para comparar..."}
                  isSecondary={index !== 0}
                  onAddSecondSearch={index === 0 && searchCount < 5 ? handleAddSearch : undefined}
                  onRemoveSecondSearch={index !== 0 ? () => handleRemoveSearch(index) : undefined}
                />
              ))}
            </div>
          </InfoCard>

          {isLoading ? (
            <div className="w-full flex justify-center py-12">
              <div className="animate-pulse flex flex-col items-center">
                <div className="h-8 w-40 bg-synergy-blue/20 rounded-md mb-4"></div>
                <div className="h-64 w-full max-w-2xl bg-synergy-blue/10 rounded-md"></div>
              </div>
            </div>
          ) : (
            searchResults.length > 0 && (
              <div className="space-y-4">
                {searchResults.length > 1 && (
                  <div className="flex justify-center gap-2">
                    {searchResults.map((result, index) => (
                      <Button 
                        key={index}
                        variant={activeResult === index ? "default" : "outline"}
                        onClick={() => setActiveResult(index)}
                        className={`flex items-center gap-2 ${activeResult === index ? 'bg-synergy-blue text-white' : 'text-synergy-blue hover:text-synergy-blue/90'}`}
                      >
                        {result.productName}
                      </Button>
                    ))}
                  </div>
                )}
                
                <ResultsDisplay                 
                  result={searchResults[activeResult] ? 
                    {
                      productName: searchResults[activeResult].productName,
                      productId: searchResults[activeResult].productId,
                      mainProductName: searchResults[activeResult].mainProductName,
                      salesDifference: searchResults[activeResult].salesDifference,
                      relatedProducts: searchResults[activeResult].relatedProducts,
                      totalSales: searchResults[activeResult].totalSales,
                      firstStartDate: searchResults[activeResult].currentFirstStartDate,
                      firstEndDate: searchResults[activeResult].currentFirstEndDate,
                      secondStartDate: searchResults[activeResult].currentSecondStartDate,
                      secondEndDate: searchResults[activeResult].currentSecondEndDate,
                      showComparison: searchResults[activeResult].showComparison,
                      firstDateRangeChecked: searchResults[activeResult].currentFirstDateRangeChecked,
                      secondDateRangeChecked: searchResults[activeResult].currentSecondDateRangeChecked
                    } : null
                  } 
                  comparisonType={searchResults[activeResult]?.comparisonType || "compare"}
                  showCrossSell={lastDateRangeCount > 1 ? (lastFirstDateRangeChecked !== lastSecondDateRangeChecked) : true}
                  mainProductName={searchResults[0]?.productName}
                />
              </div>
            )
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

export default Index;