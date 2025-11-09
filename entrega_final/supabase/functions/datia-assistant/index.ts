import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, dashboardData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    // Sistema de contexto com dados do dashboard
    const systemPrompt = `Você é a DatIA, uma assistente de IA especializada em estratégia de mercado para a empresa Cannoli.

DADOS DO DASHBOARD ATUAL:
${JSON.stringify(dashboardData, null, 2)}

Você tem acesso completo aos dados de vendas da Cannoli, incluindo:
- Total de Pedidos: ${dashboardData?.totalOrders || 'N/A'}
- Taxa de Cancelamento: ${dashboardData?.cancellationRate?.toFixed(1) || 'N/A'}%
- Receita Total: R$ ${dashboardData?.totalRevenue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || 'N/A'}
- Ticket Médio: R$ ${dashboardData?.averageTicket?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || 'N/A'}

CANAIS DE VENDA:
${dashboardData?.ordersByChannel?.map((ch: any) => `- ${ch.channel}: ${ch.orders} pedidos`).join('\n') || 'N/A'}

CANCELAMENTOS POR CANAL:
${dashboardData?.cancellationsByChannel?.map((ch: any) => `- ${ch.channel}: ${ch.total} total, ${ch.canceled} cancelados`).join('\n') || 'N/A'}

STATUS DOS PEDIDOS:
${dashboardData?.ordersByStatus?.map((st: any) => `- ${st.status}: ${st.count} pedidos`).join('\n') || 'N/A'}

Sua função é:
1. Analisar os dados e fornecer insights estratégicos de mercado
2. Responder perguntas sobre performance de vendas
3. Sugerir ações para melhorar resultados
4. Identificar padrões e oportunidades nos dados
5. Ser concisa e objetiva, focando em ações práticas

Sempre base suas respostas nos dados reais fornecidos acima. Seja profissional, mas amigável.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro da API Lovable AI:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Pagamento necessário. Adicione créditos ao seu workspace Lovable AI." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`Erro na API: ${response.status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Erro no assistente DatIA:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
