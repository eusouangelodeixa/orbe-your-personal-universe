import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Plus, Check, Clock, Trash2, Loader2, DollarSign, FileDown, CalendarIcon, Wallet, ArrowUpCircle, ArrowDownCircle, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { MonthSelector } from "@/components/MonthSelector";
import { DueDateAlerts } from "@/components/DueDateAlerts";
import {
  useCategories,
  useIncomes,
  useExpenses,
  useAddIncome,
  useAddExpense,
  useToggleExpensePaid,
  useDeleteExpense,
  useDeleteIncome,
  useWallets,
  useAddWallet,
  useDeleteWallet,
  useUpdateWalletBalance,
} from "@/hooks/useFinance";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function Planilha() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: categories = [] } = useCategories();
  const { data: incomes = [], isLoading: loadingIncomes } = useIncomes(month, year);
  const { data: expenses = [], isLoading: loadingExpenses } = useExpenses(month, year);
  const { data: wallets = [], isLoading: loadingWallets } = useWallets();

  const addIncome = useAddIncome();
  const addExpense = useAddExpense();
  const togglePaid = useToggleExpensePaid();
  const deleteExpense = useDeleteExpense();
  const deleteIncome = useDeleteIncome();
  const addWallet = useAddWallet();
  const deleteWallet = useDeleteWallet();
  const updateWalletBalance = useUpdateWalletBalance();

  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [dueDate, setDueDate] = useState<Date>();

  const [novoGasto, setNovoGasto] = useState({
    nome: "", categoria: "", valor: "", tipo: "variavel" as "fixo" | "variavel",
  });
  const [novaRenda, setNovaRenda] = useState({ descricao: "", valor: "" });
  const [novaCarteira, setNovaCarteira] = useState({ nome: "", saldoInicial: "" });
  const [transacao, setTransacao] = useState({ walletId: "", valor: "", operation: "credit" as "credit" | "debit" });

  const totalRenda = incomes.reduce((a, i) => a + Number(i.amount), 0);
  const totalGastos = expenses.reduce((a, e) => a + Number(e.amount), 0);
  const gastosPagos = expenses.filter((e) => e.paid).reduce((a, e) => a + Number(e.amount), 0);
  const gastosPendentes = totalGastos - gastosPagos;
  const saldo = totalRenda - totalGastos;
  const percentual = totalRenda > 0 ? Math.round((totalGastos / totalRenda) * 100) : 0;
  const totalCarteiras = wallets.reduce((a, w) => a + Number(w.balance), 0);

  const handleAddExpense = () => {
    if (!novoGasto.nome.trim() || !novoGasto.valor || !dueDate) return;
    const dueDateStr = format(dueDate, "yyyy-MM-dd");
    addExpense.mutate({
      name: novoGasto.nome.trim(),
      category_id: novoGasto.categoria || null,
      amount: parseFloat(novoGasto.valor),
      due_date: dueDateStr,
      type: novoGasto.tipo,
      month,
      year,
    });
    setNovoGasto({ nome: "", categoria: "", valor: "", tipo: "variavel" });
    setDueDate(undefined);
    setShowExpenseForm(false);
  };

  const handleAddIncome = () => {
    if (!novaRenda.descricao.trim() || !novaRenda.valor) return;
    addIncome.mutate({
      description: novaRenda.descricao.trim(),
      amount: parseFloat(novaRenda.valor),
      month,
      year,
    });
    setNovaRenda({ descricao: "", valor: "" });
    setShowIncomeForm(false);
  };

  const handleAddWallet = () => {
    if (!novaCarteira.nome.trim()) return;
    addWallet.mutate({
      name: novaCarteira.nome.trim(),
      balance: novaCarteira.saldoInicial ? parseFloat(novaCarteira.saldoInicial) : 0,
    });
    setNovaCarteira({ nome: "", saldoInicial: "" });
  };

  const handleTransaction = () => {
    if (!transacao.walletId || !transacao.valor) return;
    updateWalletBalance.mutate({
      id: transacao.walletId,
      amount: parseFloat(transacao.valor),
      operation: transacao.operation,
    });
    setTransacao({ walletId: "", valor: "", operation: "credit" });
  };

  const byCategory = expenses.reduce<Record<string, typeof expenses>>((acc, e) => {
    const catName = (e as any).categories?.name || "Sem categoria";
    (acc[catName] = acc[catName] || []).push(e);
    return acc;
  }, {});

  const exportPDF = () => {
    const doc = new jsPDF();
    const monthLabel = new Date(year, month - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

    doc.setFontSize(18);
    doc.text(`ORBE - Planilha Doméstica`, 14, 20);
    doc.setFontSize(12);
    doc.text(monthLabel, 14, 28);

    doc.setFontSize(10);
    doc.text(`Renda: R$ ${totalRenda.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 14, 38);
    doc.text(`Gastos: R$ ${totalGastos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 14, 44);
    doc.text(`Saldo: R$ ${saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 14, 50);
    doc.text(`Comprometimento: ${percentual}%`, 14, 56);
    doc.text(`Total Carteiras: R$ ${totalCarteiras.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 14, 62);

    // Wallets table
    if (wallets.length > 0) {
      doc.setFontSize(12);
      doc.text("Carteiras / Bancos", 14, 72);
      autoTable(doc, {
        startY: 76,
        head: [["Nome", "Saldo"]],
        body: wallets.map((w) => [
          w.name + (w.is_default ? " (Principal)" : ""),
          `R$ ${Number(w.balance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        ]),
      });
    }

    // Incomes table
    if (incomes.length > 0) {
      const finalY = (doc as any).lastAutoTable?.finalY || 76;
      doc.setFontSize(12);
      doc.text("Rendas", 14, finalY + 10);
      autoTable(doc, {
        startY: finalY + 14,
        head: [["Descrição", "Valor"]],
        body: incomes.map((i) => [
          i.description,
          `R$ ${Number(i.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        ]),
      });
    }

    // Expenses table
    if (expenses.length > 0) {
      const finalY = (doc as any).lastAutoTable?.finalY || 76;
      doc.setFontSize(12);
      doc.text("Gastos", 14, finalY + 10);
      autoTable(doc, {
        startY: finalY + 14,
        head: [["Nome", "Categoria", "Valor", "Vencimento", "Status", "Tipo"]],
        body: expenses.map((e) => [
          e.name,
          (e as any).categories?.name || "—",
          `R$ ${Number(e.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          new Date(e.due_date + "T12:00:00").toLocaleDateString("pt-BR"),
          e.paid ? "Pago" : "Pendente",
          e.type === "fixo" ? "Fixo" : "Variável",
        ]),
      });
    }

    doc.save(`ORBE_Planilha_${month}_${year}.pdf`);
  };

  const isLoading = loadingIncomes || loadingExpenses || loadingWallets;

  if (isLoading) {
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
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold font-display">Planilha Doméstica</h1>
            <MonthSelector month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={exportPDF} className="gap-2 font-display">
              <FileDown className="h-4 w-4" /> PDF
            </Button>
            <Button variant="outline" onClick={() => setShowIncomeForm(!showIncomeForm)} className="gap-2 font-display">
              <DollarSign className="h-4 w-4" /> Renda
            </Button>
            <Button onClick={() => setShowExpenseForm(!showExpenseForm)} className="gap-2 font-display">
              <Plus className="h-4 w-4" /> Novo Gasto
            </Button>
          </div>
        </div>

        {/* Due date alerts */}
        <DueDateAlerts expenses={expenses as any} />

        {/* Wallets / Banks Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <CardTitle className="font-display text-lg">Carteiras & Bancos</CardTitle>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-display font-bold text-primary">
                  Total: R$ {totalCarteiras.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Wallet list */}
            {wallets.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {wallets.map((w) => (
                  <div key={w.id} className="flex flex-col p-4 rounded-lg border border-border bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                        <p className="font-medium text-sm">{w.name}</p>
                        {w.is_default && <Badge variant="outline" className="text-[10px]">Principal</Badge>}
                      </div>
                      <button onClick={() => deleteWallet.mutate(w.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className={`text-xl font-bold font-display ${Number(w.balance) < 0 ? "text-destructive" : "text-primary"}`}>
                      R$ {Number(w.balance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="flex-1 gap-1 text-xs" onClick={() => setTransacao({ walletId: w.id, valor: "", operation: "credit" })}>
                            <ArrowUpCircle className="h-3.5 w-3.5 text-primary" /> Creditar
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle className="font-display">Creditar em {w.name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3 py-2">
                            <div className="space-y-1">
                              <Label>Valor (R$)</Label>
                              <Input type="number" placeholder="0.00" value={transacao.walletId === w.id ? transacao.valor : ""} onChange={(e) => setTransacao({ walletId: w.id, valor: e.target.value, operation: "credit" })} min={0} step={0.01} />
                            </div>
                          </div>
                          <DialogFooter>
                            <DialogClose asChild>
                              <Button variant="outline">Cancelar</Button>
                            </DialogClose>
                            <DialogClose asChild>
                              <Button onClick={() => { if (transacao.valor) updateWalletBalance.mutate({ id: w.id, amount: parseFloat(transacao.valor), operation: "credit" }); }} disabled={!transacao.valor}>
                                Confirmar Crédito
                              </Button>
                            </DialogClose>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="flex-1 gap-1 text-xs" onClick={() => setTransacao({ walletId: w.id, valor: "", operation: "debit" })}>
                            <ArrowDownCircle className="h-3.5 w-3.5 text-destructive" /> Debitar
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle className="font-display">Debitar de {w.name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3 py-2">
                            <div className="space-y-1">
                              <Label>Valor (R$)</Label>
                              <Input type="number" placeholder="0.00" value={transacao.walletId === w.id ? transacao.valor : ""} onChange={(e) => setTransacao({ walletId: w.id, valor: e.target.value, operation: "debit" })} min={0} step={0.01} />
                            </div>
                          </div>
                          <DialogFooter>
                            <DialogClose asChild>
                              <Button variant="outline">Cancelar</Button>
                            </DialogClose>
                            <DialogClose asChild>
                              <Button variant="destructive" onClick={() => { if (transacao.valor) updateWalletBalance.mutate({ id: w.id, amount: parseFloat(transacao.valor), operation: "debit" }); }} disabled={!transacao.valor}>
                                Confirmar Débito
                              </Button>
                            </DialogClose>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma carteira cadastrada. Adicione uma abaixo.</p>
            )}

            {/* Add wallet form */}
            <div className="flex items-end gap-3 pt-2 border-t border-border">
              <div className="space-y-1 flex-1">
                <Label className="text-xs">Nome</Label>
                <Input placeholder="Ex: Nubank, Itaú, Carteira física" value={novaCarteira.nome} onChange={(e) => setNovaCarteira({ ...novaCarteira, nome: e.target.value })} maxLength={50} />
              </div>
              <div className="space-y-1 w-36">
                <Label className="text-xs">Saldo inicial (R$)</Label>
                <Input type="number" placeholder="0.00" value={novaCarteira.saldoInicial} onChange={(e) => setNovaCarteira({ ...novaCarteira, saldoInicial: e.target.value })} min={0} step={0.01} />
              </div>
              <Button onClick={handleAddWallet} disabled={addWallet.isPending || !novaCarteira.nome.trim()} size="sm" className="gap-1 font-display">
                {addWallet.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Adicionar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Renda</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold font-display text-primary">
                R$ {totalRenda.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
          {[
            { label: "Total Gastos", value: totalGastos, color: "" },
            { label: "Pagos", value: gastosPagos, color: "text-primary" },
            { label: "Pendentes", value: gastosPendentes, color: "text-warning" },
            { label: "Saldo", value: saldo, color: saldo < 0 ? "text-destructive" : "text-primary" },
          ].map((item) => (
            <Card key={item.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">{item.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-xl font-bold font-display ${item.color}`}>
                  R$ {item.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Progress bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Comprometimento da renda</span>
              <span className={`font-bold ${percentual > 80 ? "text-destructive" : percentual > 60 ? "text-warning" : "text-primary"}`}>
                {percentual}%
              </span>
            </div>
            <Progress value={Math.min(percentual, 100)} className="h-3" />
            {percentual > 80 && (
              <p className="text-xs text-destructive mt-2">⚠ Atenção: renda altamente comprometida!</p>
            )}
          </CardContent>
        </Card>

        {/* Income form */}
        {showIncomeForm && (
          <Card>
            <CardHeader><CardTitle className="font-display">Adicionar Renda</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label>Descrição</Label>
                  <Input placeholder="Ex: Salário" value={novaRenda.descricao} onChange={(e) => setNovaRenda({ ...novaRenda, descricao: e.target.value })} maxLength={100} />
                </div>
                <div className="space-y-1">
                  <Label>Valor (R$)</Label>
                  <Input type="number" placeholder="0.00" value={novaRenda.valor} onChange={(e) => setNovaRenda({ ...novaRenda, valor: e.target.value })} min={0} step={0.01} />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleAddIncome} disabled={addIncome.isPending} className="font-display">
                    {addIncome.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Adicionar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Expense form */}
        {showExpenseForm && (
          <Card>
            <CardHeader><CardTitle className="font-display">Adicionar Gasto</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="space-y-1">
                  <Label>Nome</Label>
                  <Input placeholder="Ex: Aluguel" value={novoGasto.nome} onChange={(e) => setNovoGasto({ ...novoGasto, nome: e.target.value })} maxLength={100} />
                </div>
                <div className="space-y-1">
                  <Label>Categoria</Label>
                  <Select value={novoGasto.categoria} onValueChange={(v) => setNovoGasto({ ...novoGasto, categoria: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Valor (R$)</Label>
                  <Input type="number" placeholder="0.00" value={novoGasto.valor} onChange={(e) => setNovoGasto({ ...novoGasto, valor: e.target.value })} min={0} step={0.01} />
                </div>
                <div className="space-y-1">
                  <Label>Vencimento</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dueDate ? format(dueDate, "dd/MM/yyyy") : "Selecione"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <Label>Tipo</Label>
                  <Select value={novoGasto.tipo} onValueChange={(v: "fixo" | "variavel") => setNovoGasto({ ...novoGasto, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixo">Fixo</SelectItem>
                      <SelectItem value="variavel">Variável</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleAddExpense} disabled={addExpense.isPending} className="mt-4 font-display">
                {addExpense.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Adicionar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Incomes list */}
        {incomes.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="font-display text-lg">Rendas</CardTitle>
                <span className="text-sm text-muted-foreground font-display">
                  R$ {totalRenda.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {incomes.map((inc) => (
                <div key={inc.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div>
                    <p className="font-medium">{inc.description}</p>
                    {inc.recurring && <Badge variant="outline" className="text-[10px]">Recorrente</Badge>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold font-display text-primary">
                      R$ {Number(inc.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                    <button onClick={() => deleteIncome.mutate(inc.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Grouped expenses */}
        {Object.entries(byCategory).map(([cat, items]) => (
          <Card key={cat}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="font-display text-lg">{cat}</CardTitle>
                <span className="text-sm text-muted-foreground font-display">
                  R$ {items.reduce((a, e) => a + Number(e.amount), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.map((e) => (
                <div
                  key={e.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    e.paid ? "bg-muted/30 border-border" : "bg-card border-border"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button onClick={() => togglePaid.mutate({ id: e.id, paid: !e.paid })} className="shrink-0">
                      {e.paid ? <Check className="h-5 w-5 text-primary" /> : <Clock className="h-5 w-5 text-muted-foreground" />}
                    </button>
                    <div>
                      <p className={`font-medium ${e.paid ? "line-through text-muted-foreground" : ""}`}>{e.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Vence: {new Date(e.due_date + "T12:00:00").toLocaleDateString("pt-BR")} •{" "}
                        <Badge variant="outline" className="text-[10px]">{e.type === "fixo" ? "Fixo" : "Variável"}</Badge>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold font-display">
                      R$ {Number(e.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                    <button onClick={() => deleteExpense.mutate(e.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        {expenses.length === 0 && incomes.length === 0 && wallets.length === 0 && (
          <Card className="py-12 flex flex-col items-center justify-center text-center">
            <p className="text-muted-foreground mb-2">Nenhum lançamento este mês</p>
            <p className="text-sm text-muted-foreground">Adicione sua renda, carteiras e gastos para começar</p>
          </Card>
        )}

        {/* Projection */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Projeção do mês</p>
                <p className="text-xs text-muted-foreground">Saldo após todos os gastos</p>
              </div>
              <p className={`text-2xl font-bold font-display ${saldo < 0 ? "text-destructive" : "text-primary"}`}>
                R$ {saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
