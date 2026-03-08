import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Wallet, AlertTriangle } from "lucide-react";

export default function Dashboard() {
  // Placeholder data — will be replaced with real data from Supabase
  const renda = 5000;
  const totalGastos = 3200;
  const saldo = renda - totalGastos;
  const percentual = Math.round((totalGastos / renda) * 100);
  const isCritical = percentual > 80;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-display">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral das suas finanças</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Renda Mensal</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-display">
                R$ {renda.toLocaleString("pt-BR")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Gastos</CardTitle>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-display">
                R$ {totalGastos.toLocaleString("pt-BR")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Restante</CardTitle>
              <Wallet className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold font-display ${saldo < 0 ? "text-destructive" : ""}`}>
                R$ {saldo.toLocaleString("pt-BR")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Comprometimento</CardTitle>
              {isCritical && <AlertTriangle className="h-4 w-4 text-warning" />}
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-display mb-2">{percentual}%</p>
              <Progress value={percentual} className="h-2" />
            </CardContent>
          </Card>
        </div>

        {/* Placeholder for charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="h-72 flex items-center justify-center">
            <p className="text-muted-foreground text-sm">Gráfico de gastos por categoria — em breve</p>
          </Card>
          <Card className="h-72 flex items-center justify-center">
            <p className="text-muted-foreground text-sm">Comparativo mensal — em breve</p>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
