import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { KPICard } from "@/components/dashboard/KPICard";
import { OrdersByChannelChart } from "@/components/dashboard/OrdersByChannelChart";
import { CancellationsByChannelChart } from "@/components/dashboard/CancellationsByChannelChart";
import { OrderStatusChart } from "@/components/dashboard/OrderStatusChart";
import { loadOrderData, DashboardMetrics } from "@/lib/dataProcessor";
import { ShoppingCart, TrendingDown, DollarSign, Receipt, LogOut, Bot, Send, Download } from "lucide-react";
import datiLogo from "@/assets/dati-logo.png";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [userMessage, setUserMessage] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUserEmail(session.user.email || "");
      }
    });

    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUserEmail(session.user.email || "");
    };

    checkAuth();

    const fetchData = async () => {
      try {
        const data = await loadOrderData();
        setMetrics(data);
      } catch (error) {
        toast.error("Erro ao carregar dados do dashboard");
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado com sucesso!");
    navigate("/auth");
  };

  const handleSendMessage = async () => {
    if (!userMessage.trim() || isAiLoading) return;

    const newUserMessage: Message = { role: "user", content: userMessage };
    setChatMessages(prev => [...prev, newUserMessage]);
    setUserMessage("");
    setIsAiLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/datia-assistant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [...chatMessages, newUserMessage],
            dashboardData: metrics,
          }),
        }
      );

      if (!response.ok || !response.body) {
        throw new Error("Falha ao conectar com DatIA");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";
      let textBuffer = "";

      setChatMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantMessage += content;
              setChatMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                  role: "assistant",
                  content: assistantMessage,
                };
                return newMessages;
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      toast.error("Erro ao comunicar com DatIA");
      setChatMessages(prev => prev.slice(0, -1));
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!dashboardRef.current) return;

    toast.info("Gerando PDF...");
    
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        logging: false,
        useCORS: true,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const imgWidth = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      pdf.save(`dashboard-cannoli-${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast.success("PDF exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      toast.error("Erro ao exportar PDF");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Erro ao carregar dados</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10 shadow-sm">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={datiLogo} alt="Dati Logo" className="h-12 w-12" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">Dati Analytics</h1>
                <p className="text-sm text-muted-foreground">Cannoli</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={handleExportPDF}>
                <Download className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">{userEmail}</p>
                <p className="text-xs text-muted-foreground">Cliente</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main ref={dashboardRef} className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* KPIs Section */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">Indicadores Principais</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Total de Pedidos"
              value={metrics.totalOrders.toLocaleString('pt-BR')}
              icon={ShoppingCart}
              description="Todos os pedidos registrados"
            />
            <KPICard
              title="Taxa de Cancelamento"
              value={`${metrics.cancellationRate.toFixed(1)}%`}
              icon={TrendingDown}
              description="Pedidos cancelados vs total"
            />
            <KPICard
              title="Receita Total"
              value={`R$ ${metrics.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              icon={DollarSign}
              description="Receita de pedidos concluídos"
            />
            <KPICard
              title="Ticket Médio"
              value={`R$ ${metrics.averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              icon={Receipt}
              description="Valor médio por pedido"
            />
          </div>
        </section>

        {/* Charts Section */}
        <section className="space-y-6">
          <h2 className="text-xl font-semibold text-foreground">Análise Detalhada</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <OrdersByChannelChart data={metrics.ordersByChannel} />
            <OrderStatusChart data={metrics.ordersByStatus} />
          </div>

          <div className="grid grid-cols-1 gap-6">
            <CancellationsByChannelChart data={metrics.cancellationsByChannel} />
          </div>
        </section>
      </main>

      {/* Floating Chat Button */}
      <Button
        onClick={() => setIsChatOpen(!isChatOpen)}
        size="icon"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:scale-110 transition-transform z-50"
      >
        <Bot className="h-6 w-6" />
      </Button>

      {/* DatIA Floating Chat */}
      {isChatOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-[500px] z-50 animate-scale-in">
          <Card className="h-full flex flex-col shadow-2xl">
            <CardHeader className="border-b border-border pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  DatIA - Assistente de Estratégia
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsChatOpen(false)}
                  className="h-8 w-8"
                >
                  <span className="text-xl">&times;</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Analise dados e tire dúvidas estratégicas
              </p>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
              <ScrollArea className="flex-1 p-4">
                {chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-4">
                    <Bot className="h-12 w-12 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Olá! Sou a DatIA, sua assistente de estratégia de mercado.
                      Pergunte-me qualquer coisa sobre os dados do dashboard!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {chatMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${
                          msg.role === "user" ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[85%] rounded-lg p-3 ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                    {isAiLoading && (
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-lg p-3">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-100" />
                            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-200" />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>
              <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                  <Input
                    value={userMessage}
                    onChange={(e) => setUserMessage(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder="Digite sua pergunta..."
                    disabled={isAiLoading}
                  />
                  <Button
                    size="icon"
                    onClick={handleSendMessage}
                    disabled={isAiLoading || !userMessage.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
