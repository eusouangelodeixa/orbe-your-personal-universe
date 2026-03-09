import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, Wallet as WalletIcon, AlertTriangle, Loader2,
  CreditCard, ArrowUpCircle, ArrowDownCircle,
} from "lucide-react";
import { useIncomes, useExpenses, useWallets, useWalletTransactions, useFinancialHistory } from "@/hooks/useFinance";
import { MonthSelector } from "@/components/MonthSelector";
import { useCurrency } from "@/contexts/CurrencyContext";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from "recharts";

const COLORS = ["#4CAF50", "#FF9800", "#2196F3", "#9C27B0", "#F44336", "#3F51B5", "#E91E63", "#607D8B"];
const MONTH_NAMES = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function Dashboard() {
  const { formatMoney, currency } = useCurrency();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: incomes = [], isLoading: li } = useIncomes(month, year);
  const { data: expenses = [], isLoading: le } = useExpenses(month, year);
  const { data: wallets = [], isLoading: lw } = useWallets();
  const { data: transactions = [] } = useWalletTransactions();
  const { data: history = [] } = useFinancialHistory();

  const renda = incomes.reduce((a, i) => a + Number(i.amount), 0);
  const totalGastos = expenses.reduce((a, e) => a + Number(e.amount), 0);
  const gastosPendentes = expenses.filter(e => !e.paid).reduce((a, e) => a + Number(e.amount), 0);
  const fluxoMensal = renda - totalGastos;
  const percentual = renda > 0 ? Math.round((totalGastos / renda) * 100) : 0;
  const isCritical = percentual > 80;
  const totalCarteiras = wallets.reduce((a, w) => a + Number(w.balance), 0);

  const byCat = expenses.reduce<Record<string, { name: string; value: number; color: string }>>((acc, e) => {
    const catName = (e as any).categories?.name || "Outros";
    const catColor = (e as any).categories?.color || "#607D8B";
    if (!acc[catName]) acc[catName] = { name: catName, value: 0, color: catColor };
    acc[catName].value += Number(e.amount);
    return acc;
  }, {});
  const pieData = Object.values(byCat);
  const recentTx = transactions.slice(0, 10);
  const chartData = history.map(h => ({
    label: `${MONTH_NAMES[h.month]}/${String(h.year).slice(2)}`,
    Renda: h.income,
    Gastos: h.expense,
    Saldo: h.income - h.expense,
  }));

  if (li || le || lw) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold font-display">Dashboard Financeiro</h1>
            <p className="text-muted-foreground">Visão geral das suas finanças</p>
          </div>
          <MonthSelector month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
        </div>

        {/* Row 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between pb-1">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Renda Mensal</CardTitle>
              <ArrowUpCircle className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-display text-primary">{formatMoney(renda)}</p>
              <p className="text-xs text-muted-foreground mt-1">Total recebido no mês</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-destructive">
            <CardHeader className="flex flex-row items-center justify-between pb-1">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Gastos</CardTitle>
              <ArrowDownCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-display text-destructive">{formatMoney(totalGastos)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {gastosPendentes > 0 ? <span className="text-warning font-medium">{formatMoney(gastosPendentes)} pendentes</span> : "Tudo pago ✓"}
              </p>
            </CardContent>
          </Card>
          <Card className={`border-l-4 ${fluxoMensal >= 0 ? "border-l-primary" : "border-l-destructive"}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-1">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Fluxo do Mês</CardTitle>
              {fluxoMensal >= 0 ? <TrendingUp className="h-4 w-4 text-primary" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold font-display ${fluxoMensal >= 0 ? "text-primary" : "text-destructive"}`}>
                {fluxoMensal >= 0 ? "+" : ""}{formatMoney(fluxoMensal)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Renda − Gastos</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-1">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Comprometimento</CardTitle>
              {isCritical && <AlertTriangle className="h-4 w-4 text-warning" />}
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold font-display mb-1 ${isCritical ? "text-warning" : ""}`}>{percentual}%</p>
              <Progress value={Math.min(percentual, 100)} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {percentual > 100 ? "Gastos excedem a renda!" : percentual > 80 ? "Atenção: alto comprometimento" : "Dentro do orçamento"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-1">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Patrimônio Atual</CardTitle>
              <WalletIcon className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold font-display ${totalCarteiras < 0 ? "text-destructive" : "text-primary"}`}>
                {formatMoney(totalCarteiras)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Saldo total de todas as carteiras</p>
            </CardContent>
          </Card>
          <Card className={`${(totalCarteiras - gastosPendentes) >= 0 ? "bg-primary/5 border-primary/20" : "bg-destructive/5 border-destructive/20"}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-1">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Disponível Real</CardTitle>
              <CreditCard className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold font-display ${(totalCarteiras - gastosPendentes) < 0 ? "text-destructive" : "text-primary"}`}>
                R$ {(totalCarteiras - gastosPendentes).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Patrimônio − Gastos pendentes</p>
            </CardContent>
          </Card>
        </div>

        {/* Wallets */}
        {wallets.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <CardTitle className="font-display">Carteiras & Bancos</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {wallets.map((w) => (
                  <div key={w.id} className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
                    <div className="flex items-center gap-2">
                      <WalletIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{w.name}</span>
                      {w.is_default && <Badge variant="outline" className="text-[10px]">Principal</Badge>}
                    </div>
                    <span className={`font-bold font-display ${Number(w.balance) < 0 ? "text-destructive" : "text-primary"}`}>
                      R$ {Number(w.balance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="font-display">Gastos por Categoria</CardTitle></CardHeader>
            <CardContent className="h-64">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" stroke="none" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Adicione gastos para ver o gráfico</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="font-display">Gastos por Categoria (R$)</CardTitle></CardHeader>
            <CardContent className="h-64">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pieData} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Adicione gastos para ver o gráfico</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Evolution Chart */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="font-display">Evolução Financeira (últimos 6 meses)</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`} />
                  <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                  <Legend />
                  <Line type="monotone" dataKey="Renda" stroke="#4CAF50" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="Gastos" stroke="#F44336" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="Saldo" stroke="#FF9800" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Recent Transactions */}
        {recentTx.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="font-display">Últimas Movimentações</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {recentTx.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-3">
                    {tx.type === "credit" ? <ArrowUpCircle className="h-4 w-4 text-primary shrink-0" /> : <ArrowDownCircle className="h-4 w-4 text-destructive shrink-0" />}
                    <div>
                      <p className="font-medium text-sm">{tx.description || (tx.type === "credit" ? "Crédito" : "Débito")}</p>
                      <p className="text-xs text-muted-foreground">
                        {tx.wallets?.name} • {new Date(tx.created_at).toLocaleDateString("pt-BR")}
                        {tx.reference_type && (
                          <Badge variant="outline" className="ml-1 text-[10px]">
                            {tx.reference_type === "income" ? "Renda" : tx.reference_type === "expense" ? "Gasto" : "Manual"}
                          </Badge>
                        )}
                      </p>
                    </div>
                  </div>
                  <span className={`font-bold font-display text-sm ${tx.type === "credit" ? "text-primary" : "text-destructive"}`}>
                    {tx.type === "credit" ? "+" : "-"} R$ {Number(tx.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
