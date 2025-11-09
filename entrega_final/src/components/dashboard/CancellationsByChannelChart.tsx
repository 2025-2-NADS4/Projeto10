import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface CancellationsByChannelChartProps {
  data: { channel: string; total: number; canceled: number }[];
}

export const CancellationsByChannelChart = ({ data }: CancellationsByChannelChartProps) => {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Cancelamento por Canal de Venda</CardTitle>
        <CardDescription>Comparação entre todos os pedidos e cancelados</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis 
              dataKey="channel" 
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Bar 
              dataKey="total" 
              name="Total de Pedidos"
              fill="hsl(var(--primary))" 
              radius={[8, 8, 0, 0]}
            />
            <Bar 
              dataKey="canceled" 
              name="Cancelados"
              fill="hsl(var(--destructive))" 
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
