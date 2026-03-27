import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEnergyHistory } from "@/hooks/useEnergy";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart3 } from "lucide-react";

export function EnergyTimeline({ days = 14 }: { days?: number }) {
  const { data: logs = [] } = useEnergyHistory(days);

  const chartData = logs.map((l) => ({
    date: format(parseISO(l.created_at), "dd/MM", { locale: ptBR }),
    energia: l.energy_level,
    fadiga: l.mental_fatigue,
    motivação: l.motivation,
  }));

  if (!chartData.length) return (
    <Card>
      <CardContent className="py-8 text-center text-sm text-muted-foreground">
        Nenhum registro de energia ainda. Faça o check-in acima.
      </CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> Evolução de Energy — {days} dias
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Area type="monotone" dataKey="energia" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} strokeWidth={2} />
            <Area type="monotone" dataKey="fadiga" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} strokeWidth={1.5} strokeDasharray="4 4" />
            <Area type="monotone" dataKey="motivação" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Energia</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Fadiga</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Motivação</span>
        </div>
      </CardContent>
    </Card>
  );
}
