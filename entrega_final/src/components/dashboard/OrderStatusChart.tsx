import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Pie, PieChart, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface OrderStatusChartProps {
  data: { status: string; count: number }[];
}

const COLORS = {
  'Cancelados': 'hsl(var(--destructive))',
  'Concluídos': 'hsl(var(--success))',
  'Em Andamento': 'hsl(var(--info))'
};

export const OrderStatusChart = ({ data }: OrderStatusChartProps) => {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Status Geral dos Pedidos</CardTitle>
        <CardDescription>Distribuição por status atual</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ status, percent }) => `${status}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={100}
              innerRadius={60}
              fill="#8884d8"
              dataKey="count"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[entry.status as keyof typeof COLORS]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
