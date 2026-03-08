import { useState } from "react";
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
import {
  Plus, Check, Clock, Trash2, Loader2, DollarSign, FileDown, CalendarIcon,
  Wallet, ArrowUpCircle, ArrowDownCircle, CreditCard, PiggyBank,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { MonthSelector } from "@/components/MonthSelector";
import { DueDateAlerts } from "@/components/DueDateAlerts";
import {
  useCategories, useIncomes, useExpenses, useAddIncome, useAddExpense,
  useToggleExpensePaid, useDeleteExpense, useDeleteIncome,
  useWallets, useAddWallet, useDeleteWallet, useAddWalletTransaction, useWalletTransactions,
  useSavingsGoals, useUpdateSavingsGoal,
} from "@/hooks/useFinance";
import {
  createOrbeDoc, finalizeDoc, drawHeader, drawSectionTitle,
  drawStatCard, drawTable, drawProgressBar, PDF_COLORS,
} from "@/lib/pdfTemplate";

export default function Planilha() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: categories = [] } = useCategories();
  const { data: incomes = [], isLoading: loadingIncomes } = useIncomes(month, year);
  const { data: expenses = [], isLoading: loadingExpenses } = useExpenses(month, year);
  const { data: wallets = [], isLoading: loadingWallets } = useWallets();
  const { data: transactions = [] } = useWalletTransactions();
  const { data: savingsGoals = [] } = useSavingsGoals();
  const updateSavingsGoal = useUpdateSavingsGoal();

  const addIncome = useAddIncome();
  const addExpense = useAddExpense();
  const togglePaid = useToggleExpensePaid();
  const deleteExpense = useDeleteExpense();
  const deleteIncome = useDeleteIncome();
  const addWallet = useAddWallet();
  const deleteWallet = useDeleteWallet();
  const addWalletTx = useAddWalletTransaction();

  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [dueDate, setDueDate] = useState<Date>();

  const [novoGasto, setNovoGasto] = useState({
    nome: "", categoria: "", valor: "", tipo: "variavel" as "fixo" | "variavel", walletId: "",
  });
  const [novaRenda, setNovaRenda] = useState({ descricao: "", valor: "", walletId: "" });
  const [novaCarteira, setNovaCarteira] = useState({ nome: "", saldoInicial: "" });
  const [txForm, setTxForm] = useState({ valor: "", descricao: "" });
  // For marking expense as paid with wallet
  const [payWalletId, setPayWalletId] = useState("");
  const [cofrinhoForm, setCofrinhoForm] = useState({ goalId: "", valor: "" });

  const totalRenda = incomes.reduce((a, i) => a + Number(i.amount), 0);
  const totalGastos = expenses.reduce((a, e) => a + Number(e.amount), 0);
  const gastosPagos = expenses.filter((e) => e.paid).reduce((a, e) => a + Number(e.amount), 0);
  const gastosPendentes = totalGastos - gastosPagos;
  const saldo = totalRenda - totalGastos;
  const percentual = totalRenda > 0 ? Math.round((totalGastos / totalRenda) * 100) : 0;
  const totalCarteiras = wallets.reduce((a, w) => a + Number(w.balance), 0);

  const handleAddExpense = () => {
    if (!novoGasto.nome.trim() || !novoGasto.valor || !dueDate) return;
    addExpense.mutate(
      {
        name: novoGasto.nome.trim(),
        category_id: novoGasto.categoria || null,
        amount: parseFloat(novoGasto.valor),
        due_date: format(dueDate, "yyyy-MM-dd"),
        type: novoGasto.tipo,
        wallet_id: novoGasto.walletId || null,
        month,
        year,
      },
      {
        onSuccess: () => {
          setNovoGasto({ nome: "", categoria: "", valor: "", tipo: "variavel", walletId: "" });
          setDueDate(undefined);
          setShowExpenseForm(false);
        },
      }
    );
  };

  const handleAddIncome = () => {
    if (!novaRenda.descricao.trim() || !novaRenda.valor) return;
    addIncome.mutate({
      description: novaRenda.descricao.trim(),
      amount: parseFloat(novaRenda.valor),
      wallet_id: novaRenda.walletId || null,
      month,
      year,
    });
    setNovaRenda({ descricao: "", valor: "", walletId: "" });
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

  const handleTogglePaid = (e: any) => {
    if (!e.paid && e.wallet_id) {
      // Auto-debit from linked wallet
      togglePaid.mutate({ id: e.id, paid: true, wallet_id: e.wallet_id, amount: Number(e.amount), name: e.name });
      return;
    }
    togglePaid.mutate({ id: e.id, paid: !e.paid, amount: Number(e.amount), name: e.name });
  };

  const confirmPayWithWallet = (expense: any) => {
    togglePaid.mutate({
      id: expense.id,
      paid: true,
      wallet_id: payWalletId || null,
      amount: Number(expense.amount),
      name: expense.name,
    });
    setPayWalletId("");
  };

  const handleSaveToCofrinho = (walletId: string) => {
    const amount = parseFloat(cofrinhoForm.valor);
    if (!cofrinhoForm.goalId || isNaN(amount) || amount <= 0) return;
    const goal = savingsGoals.find((g: any) => g.id === cofrinhoForm.goalId);
    if (!goal) return;
    addWalletTx.mutate({
      wallet_id: walletId,
      amount,
      type: "debit",
      description: `Cofrinho: ${goal.name}`,
      reference_type: "savings",
      reference_id: goal.id,
    });
    updateSavingsGoal.mutate({
      id: goal.id,
      current_amount: Number(goal.current_amount) + amount,
    });
    setCofrinhoForm({ goalId: "", valor: "" });
  };

  const byCategory = expenses.reduce<Record<string, typeof expenses>>((acc, e) => {
    const catName = (e as any).categories?.name || "Sem categoria";
    (acc[catName] = acc[catName] || []).push(e);
    return acc;
  }, {});

  const exportPDF = () => {
    const doc = createOrbeDoc();
    const monthLabel = new Date(year, month - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

    let y = drawHeader(doc, `Planilha — ${monthLabel}`, "RELATÓRIO FINANCEIRO");

    // Stat cards row
    const cardW = 42;
    const gap = 4;
    const startX = 14;
    drawStatCard(doc, startX, y, cardW, "Renda", `R$ ${totalRenda.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, PDF_COLORS.green);
    drawStatCard(doc, startX + cardW + gap, y, cardW, "Gastos", `R$ ${totalGastos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, PDF_COLORS.red);
    drawStatCard(doc, startX + (cardW + gap) * 2, y, cardW, "Saldo", `R$ ${saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, saldo >= 0 ? PDF_COLORS.green : PDF_COLORS.red);
    drawStatCard(doc, startX + (cardW + gap) * 3, y, cardW, "Patrimônio", `R$ ${totalCarteiras.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, PDF_COLORS.amber);
    y += 36;

    // Comprometimento bar
    const pct = totalRenda > 0 ? Math.round((totalGastos / totalRenda) * 100) : 0;
    drawProgressBar(doc, 14, y, doc.internal.pageSize.getWidth() - 28, pct, `${pct}% da renda comprometida`);
    y += 18;

    // Wallets
    if (wallets.length > 0) {
      y = drawSectionTitle(doc, y, "Carteiras / Bancos");
      y = drawTable(doc, y,
        ["Nome", "Saldo"],
        wallets.map((w) => [
          w.name + (w.is_default ? " ★" : ""),
          `R$ ${Number(w.balance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        ])
      );
      y += 8;
    }

    // Incomes
    if (incomes.length > 0) {
      y = drawSectionTitle(doc, y, "Rendas");
      y = drawTable(doc, y,
        ["Descrição", "Valor", "Carteira"],
        incomes.map((i: any) => [
          i.description,
          `R$ ${Number(i.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          i.wallets?.name || "—",
        ])
      );
      y += 8;
    }

    // Expenses
    if (expenses.length > 0) {
      y = drawSectionTitle(doc, y, "Gastos");
      y = drawTable(doc, y,
        ["Nome", "Categoria", "Valor", "Vencimento", "Status", "Carteira"],
        expenses.map((e: any) => [
          e.name,
          e.categories?.name || "—",
          `R$ ${Number(e.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          new Date(e.due_date + "T12:00:00").toLocaleDateString("pt-BR"),
          e.paid ? "Pago" : "Pendente",
          e.wallets?.name || "—",
        ])
      );
    }

    finalizeDoc(doc);
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

        <DueDateAlerts expenses={expenses as any} />

        {/* Wallets / Banks */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <CardTitle className="font-display text-lg">Carteiras & Bancos</CardTitle>
              </div>
              <span className="text-sm font-display font-bold text-primary">
                Total: R$ {totalCarteiras.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
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
                    <div className="flex flex-wrap gap-1.5">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="gap-1 text-xs px-2.5 min-w-0" onClick={() => setTxForm({ valor: "", descricao: "" })}>
                            <ArrowUpCircle className="h-3.5 w-3.5 shrink-0 text-primary" /> Creditar
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle className="font-display">Creditar em {w.name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3 py-2">
                            <div className="space-y-1">
                              <Label>Valor (R$)</Label>
                              <Input type="number" placeholder="0.00" value={txForm.valor} onChange={(e) => setTxForm({ ...txForm, valor: e.target.value })} min={0} step={0.01} />
                            </div>
                            <div className="space-y-1">
                              <Label>Descrição</Label>
                              <Input placeholder="Ex: Depósito" value={txForm.descricao} onChange={(e) => setTxForm({ ...txForm, descricao: e.target.value })} maxLength={100} />
                            </div>
                          </div>
                          <DialogFooter>
                            <DialogClose asChild>
                              <Button variant="outline">Cancelar</Button>
                            </DialogClose>
                            <DialogClose asChild>
                              <Button onClick={() => {
                                if (txForm.valor) addWalletTx.mutate({
                                  wallet_id: w.id, amount: parseFloat(txForm.valor), type: "credit",
                                  description: txForm.descricao || "Crédito manual", reference_type: "manual",
                                });
                              }} disabled={!txForm.valor}>Confirmar</Button>
                            </DialogClose>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="gap-1 text-xs px-2.5 min-w-0" onClick={() => setTxForm({ valor: "", descricao: "" })}>
                            <ArrowDownCircle className="h-3.5 w-3.5 shrink-0 text-destructive" /> Debitar
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle className="font-display">Debitar de {w.name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3 py-2">
                            <div className="space-y-1">
                              <Label>Valor (R$)</Label>
                              <Input type="number" placeholder="0.00" value={txForm.valor} onChange={(e) => setTxForm({ ...txForm, valor: e.target.value })} min={0} step={0.01} />
                            </div>
                            <div className="space-y-1">
                              <Label>Descrição</Label>
                              <Input placeholder="Ex: Saque" value={txForm.descricao} onChange={(e) => setTxForm({ ...txForm, descricao: e.target.value })} maxLength={100} />
                            </div>
                          </div>
                          <DialogFooter>
                            <DialogClose asChild>
                              <Button variant="outline">Cancelar</Button>
                            </DialogClose>
                            <DialogClose asChild>
                              <Button variant="destructive" onClick={() => {
                                if (txForm.valor) addWalletTx.mutate({
                                  wallet_id: w.id, amount: parseFloat(txForm.valor), type: "debit",
                                  description: txForm.descricao || "Débito manual", reference_type: "manual",
                                });
                              }} disabled={!txForm.valor}>Confirmar</Button>
                            </DialogClose>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      {savingsGoals.length > 0 && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline" className="gap-1 text-xs px-2.5 min-w-0" onClick={() => setCofrinhoForm({ goalId: "", valor: "" })}>
                              <PiggyBank className="h-3.5 w-3.5 shrink-0 text-primary" /> Cofrinho
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle className="font-display flex items-center gap-2">
                                <PiggyBank className="h-5 w-5 text-primary" />
                                Guardar no Cofrinho
                              </DialogTitle>
                            </DialogHeader>
                            <p className="text-sm text-muted-foreground">
                              Debitar de <strong>{w.name}</strong> (R$ {Number(w.balance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })})
                            </p>
                            <div className="space-y-3 py-2">
                              <div className="space-y-1">
                                <Label>Meta</Label>
                                <Select value={cofrinhoForm.goalId} onValueChange={(v) => setCofrinhoForm({ ...cofrinhoForm, goalId: v })}>
                                  <SelectTrigger><SelectValue placeholder="Escolha a meta" /></SelectTrigger>
                                  <SelectContent>
                                    {savingsGoals.map((g: any) => (
                                      <SelectItem key={g.id} value={g.id}>
                                        {g.name} (R$ {Number(g.current_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / R$ {Number(g.target_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label>Valor (R$)</Label>
                                <Input type="number" placeholder="0.00" value={cofrinhoForm.valor} onChange={(e) => setCofrinhoForm({ ...cofrinhoForm, valor: e.target.value })} min={0} step={0.01} />
                              </div>
                            </div>
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button variant="outline">Cancelar</Button>
                              </DialogClose>
                              <DialogClose asChild>
                                <Button onClick={() => handleSaveToCofrinho(w.id)} disabled={!cofrinhoForm.goalId || !cofrinhoForm.valor} className="gap-1">
                                  <PiggyBank className="h-4 w-4" /> Guardar
                                </Button>
                              </DialogClose>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma carteira cadastrada.</p>
            )}

            <div className="flex items-end gap-3 pt-2 border-t border-border">
              <div className="space-y-1 flex-1">
                <Label className="text-xs">Nome</Label>
                <Input placeholder="Ex: Nubank, Itaú" value={novaCarteira.nome} onChange={(e) => setNovaCarteira({ ...novaCarteira, nome: e.target.value })} maxLength={50} />
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <Label>Descrição</Label>
                  <Input placeholder="Ex: Salário" value={novaRenda.descricao} onChange={(e) => setNovaRenda({ ...novaRenda, descricao: e.target.value })} maxLength={100} />
                </div>
                <div className="space-y-1">
                  <Label>Valor (R$)</Label>
                  <Input type="number" placeholder="0.00" value={novaRenda.valor} onChange={(e) => setNovaRenda({ ...novaRenda, valor: e.target.value })} min={0} step={0.01} />
                </div>
                <div className="space-y-1">
                  <Label>Creditar em</Label>
                  <Select value={novaRenda.walletId} onValueChange={(v) => setNovaRenda({ ...novaRenda, walletId: v })}>
                    <SelectTrigger><SelectValue placeholder="Nenhuma carteira" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {wallets.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                <div className="space-y-1">
                  <Label>Carteira vinculada</Label>
                  <Select value={novoGasto.walletId} onValueChange={(v) => setNovoGasto({ ...novoGasto, walletId: v })}>
                    <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {wallets.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
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
              {incomes.map((inc: any) => (
                <div key={inc.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div>
                    <p className="font-medium">{inc.description}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {inc.recurring && <Badge variant="outline" className="text-[10px]">Recorrente</Badge>}
                      {inc.wallets?.name && (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <Wallet className="h-2.5 w-2.5" />{inc.wallets.name}
                        </Badge>
                      )}
                    </div>
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
              {items.map((e: any) => (
                <div
                  key={e.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    e.paid ? "bg-muted/30 border-border" : "bg-card border-border"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {e.paid ? (
                      <button onClick={() => togglePaid.mutate({ id: e.id, paid: false, amount: Number(e.amount), name: e.name })} className="shrink-0">
                        <Check className="h-5 w-5 text-primary" />
                      </button>
                    ) : e.wallet_id ? (
                      <button onClick={() => handleTogglePaid(e)} className="shrink-0" title={`Debitar de ${wallets.find(w => w.id === e.wallet_id)?.name || 'carteira vinculada'}`}>
                        <Clock className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
                      </button>
                    ) : wallets.length > 0 ? (
                      <Dialog>
                        <DialogTrigger asChild>
                          <button className="shrink-0" onClick={() => setPayWalletId("")}>
                            <Clock className="h-5 w-5 text-muted-foreground" />
                          </button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle className="font-display">Pagar {e.name}</DialogTitle>
                          </DialogHeader>
                          <p className="text-sm text-muted-foreground">
                            Valor: <strong>R$ {Number(e.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
                          </p>
                          <div className="space-y-1">
                            <Label>Debitar de qual carteira?</Label>
                            <Select value={payWalletId} onValueChange={setPayWalletId}>
                              <SelectTrigger><SelectValue placeholder="Sem débito automático" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Nenhuma</SelectItem>
                                {wallets.map((w) => (
                                  <SelectItem key={w.id} value={w.id}>
                                    {w.name} (R$ {Number(w.balance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <DialogFooter>
                            <DialogClose asChild>
                              <Button variant="outline">Cancelar</Button>
                            </DialogClose>
                            <DialogClose asChild>
                              <Button onClick={() => confirmPayWithWallet(e)}>Confirmar Pagamento</Button>
                            </DialogClose>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    ) : (
                      <button onClick={() => togglePaid.mutate({ id: e.id, paid: true, amount: Number(e.amount), name: e.name })} className="shrink-0">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                      </button>
                    )}
                    <div>
                      <p className={`font-medium ${e.paid ? "line-through text-muted-foreground" : ""}`}>{e.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          Vence: {new Date(e.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
                        </span>
                        <Badge variant="outline" className="text-[10px]">{e.type === "fixo" ? "Fixo" : "Variável"}</Badge>
                        {e.wallets?.name && (
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <Wallet className="h-2.5 w-2.5" />{e.wallets.name}
                          </Badge>
                        )}
                      </div>
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
            <p className="text-sm text-muted-foreground">Adicione carteiras, renda e gastos para começar</p>
          </Card>
        )}

        {/* Recent transactions */}
        {transactions.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-lg">Últimas Movimentações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {transactions.slice(0, 8).map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-3">
                    {tx.type === "credit" ? (
                      <ArrowUpCircle className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <ArrowDownCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{tx.description}</p>
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

        {/* Projection */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Fluxo Mensal</p>
                <p className="text-xs text-muted-foreground">Renda − Gastos do mês</p>
              </div>
              <p className={`text-2xl font-bold font-display ${saldo < 0 ? "text-destructive" : "text-primary"}`}>
                R$ {saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="border-t border-border pt-4 flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Projeção Patrimonial</p>
                <p className="text-xs text-muted-foreground">Carteiras − Gastos pendentes</p>
              </div>
              {(() => {
                const projecaoPatrimonial = totalCarteiras - gastosPendentes;
                return (
                  <p className={`text-2xl font-bold font-display ${projecaoPatrimonial < 0 ? "text-destructive" : "text-primary"}`}>
                    R$ {projecaoPatrimonial.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
