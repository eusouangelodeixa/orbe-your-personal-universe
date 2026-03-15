import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useCurrency, SUPPORTED_CURRENCIES } from "@/contexts/CurrencyContext";
import { useExchangeRates, convertToBRL } from "@/hooks/useExchangeRates";
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
import { Switch } from "@/components/ui/switch";
import {
  Plus, Check, Clock, Trash2, Loader2, DollarSign, FileDown, CalendarIcon,
  Wallet, ArrowUpCircle, ArrowDownCircle, CreditCard, PiggyBank, Repeat, ArrowLeftRight, Pencil,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { MonthSelector } from "@/components/MonthSelector";
import { DueDateAlerts } from "@/components/DueDateAlerts";
import {
  useCategories, useIncomes, useExpenses, useAddIncome, useAddExpense,
  useToggleExpensePaid, useDeleteExpense, useDeleteIncome, useUpdateExpense,
  useWallets, useAddWallet, useDeleteWallet, useAddWalletTransaction, useWalletTransactions,
  useSavingsGoals, useUpdateSavingsGoal, useWalletTransfer,
} from "@/hooks/useFinance";
import {
  createOrbeDoc, finalizeDoc, drawHeader, drawSectionTitle,
  drawStatCard, drawTable, drawProgressBar, PDF_COLORS,
} from "@/lib/pdfTemplate";

export default function Planilha() {
  const { formatMoney, currency } = useCurrency();
  const formatMoneyBRL = (value: number) =>
    Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: categories = [] } = useCategories();
  const { data: incomes = [], isLoading: loadingIncomes } = useIncomes(month, year);
  const { data: expenses = [], isLoading: loadingExpenses } = useExpenses(month, year);
  const { data: wallets = [], isLoading: loadingWallets } = useWallets();
  const walletCurrencies = wallets.map((w: any) => w.currency || "BRL").filter((c: string) => c !== "BRL");
  const { data: exchangeRates } = useExchangeRates(walletCurrencies.length > 0 ? [...new Set(walletCurrencies)] as string[] : undefined);
  const { data: transactions = [] } = useWalletTransactions();
  const { data: savingsGoals = [] } = useSavingsGoals();
  const updateSavingsGoal = useUpdateSavingsGoal();

  // ── Multi-currency helpers ──
  /** Convert amount from a given currency to the user's system currency */
  const toSystemCurrency = (amount: number, fromCurrency: string): number => {
    const sysCur = currency.code;
    if (fromCurrency === sysCur) return amount;
    // Step 1: convert to BRL
    const inBRL = convertToBRL(amount, fromCurrency, exchangeRates?.rates);
    if (sysCur === "BRL") return inBRL;
    // Step 2: BRL to system currency
    const sysRate = exchangeRates?.rates?.[sysCur];
    if (!sysRate || sysRate === 0) return inBRL;
    return inBRL * sysRate;
  };

  /** Get the currency code of a wallet */
  const getWalletCurrency = (walletId?: string | null): string => {
    if (!walletId) return currency.code;
    const w = wallets.find((w) => w.id === walletId);
    return (w as any)?.currency || "BRL";
  };

  /** Convert an income/expense amount to system currency based on its wallet */
  const convertItem = (amount: number, walletId?: string | null): number => {
    return toSystemCurrency(amount, getWalletCurrency(walletId));
  };

  /** Format an amount in its wallet's native currency */
  const formatNative = (amount: number, walletCurrency: string): string => {
    const info = SUPPORTED_CURRENCIES.find((c) => c.code === walletCurrency);
    if (!info) return formatMoney(amount);
    return Number(amount)
      .toLocaleString(info.locale, {
        style: "currency",
        currency: walletCurrency,
        minimumFractionDigits: walletCurrency === "JPY" ? 0 : 2,
      })
      .replace(/MTn|MTN/g, "MT");
  };

  const addIncome = useAddIncome();
  const addExpense = useAddExpense();
  const togglePaid = useToggleExpensePaid();
  const deleteExpense = useDeleteExpense();
  const deleteIncome = useDeleteIncome();
  const addWallet = useAddWallet();
  const deleteWallet = useDeleteWallet();
  const addWalletTx = useAddWalletTransaction();
  const updateExpense = useUpdateExpense();
  const walletTransfer = useWalletTransfer();

  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [dueDate, setDueDate] = useState<Date>();

  const [novoGasto, setNovoGasto] = useState({
    nome: "", categoria: "", valor: "", tipo: "variavel" as "fixo" | "variavel", walletId: "",
    recurring: false, recurringDay: "",
  });
  const [novaRenda, setNovaRenda] = useState({ descricao: "", valor: "", walletId: "", recurring: false });
  const [novaCarteira, setNovaCarteira] = useState({ nome: "", saldoInicial: "", currency: "BRL" });
  const [txForm, setTxForm] = useState({ valor: "", descricao: "" });
  // For marking expense as paid with wallet
  const [payWalletId, setPayWalletId] = useState("");
  const [cofrinhoForm, setCofrinhoForm] = useState({ goalId: "", valor: "" });
  const [transferForm, setTransferForm] = useState({ fromId: "", toId: "", valor: "" });
  const [editExpense, setEditExpense] = useState<any>(null);
  const [editForm, setEditForm] = useState({ nome: "", valor: "", dueDate: undefined as Date | undefined, tipo: "variavel" as string, categoria: "", walletId: "", recurring: false, recurringDay: "" });

  // ── Converted totals (all in system currency) ──
  const totalRenda = incomes.reduce((a, i) => a + convertItem(Number(i.amount), i.wallet_id), 0);
  const totalGastos = expenses.reduce((a, e) => a + convertItem(Number(e.amount), e.wallet_id), 0);
  const gastosPagos = expenses.filter((e) => e.paid).reduce((a, e) => a + convertItem(Number(e.amount), e.wallet_id), 0);
  const gastosPendentes = totalGastos - gastosPagos;
  const saldo = totalRenda - totalGastos;
  const percentual = totalRenda > 0 ? Math.round((totalGastos / totalRenda) * 100) : 0;
  const totalCarteiras = wallets.reduce((a, w) => {
    const wCurrency = (w as any).currency || "BRL";
    return a + toSystemCurrency(Number(w.balance), wCurrency);
  }, 0);

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
        recurring: novoGasto.recurring,
        recurring_day: novoGasto.recurring && novoGasto.recurringDay ? parseInt(novoGasto.recurringDay) : null,
      },
      {
        onSuccess: () => {
          setNovoGasto({ nome: "", categoria: "", valor: "", tipo: "variavel", walletId: "", recurring: false, recurringDay: "" });
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
      recurring: novaRenda.recurring,
      month,
      year,
    });
    setNovaRenda({ descricao: "", valor: "", walletId: "", recurring: false });
    setShowIncomeForm(false);
  };

  const handleAddWallet = () => {
    if (!novaCarteira.nome.trim()) return;
    addWallet.mutate({
      name: novaCarteira.nome.trim(),
      balance: novaCarteira.saldoInicial ? parseFloat(novaCarteira.saldoInicial) : 0,
      currency: novaCarteira.currency,
    });
    setNovaCarteira({ nome: "", saldoInicial: "", currency: "BRL" });
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
    drawStatCard(doc, startX, y, cardW, "Renda", formatMoney(totalRenda), PDF_COLORS.green);
    drawStatCard(doc, startX + cardW + gap, y, cardW, "Gastos", formatMoney(totalGastos), PDF_COLORS.red);
    drawStatCard(doc, startX + (cardW + gap) * 2, y, cardW, "Saldo", formatMoney(saldo), saldo >= 0 ? PDF_COLORS.green : PDF_COLORS.red);
    drawStatCard(doc, startX + (cardW + gap) * 3, y, cardW, `Patrimônio (${currency.code})`, formatMoney(totalCarteiras), PDF_COLORS.amber);
    y += 36;

    // Comprometimento bar
    const pct = totalRenda > 0 ? Math.round((totalGastos / totalRenda) * 100) : 0;
    drawProgressBar(doc, 14, y, doc.internal.pageSize.getWidth() - 28, pct, `${pct}% da renda comprometida`);
    y += 18;

    // Wallets
    if (wallets.length > 0) {
      y = drawSectionTitle(doc, y, "Carteiras / Bancos");
      y = drawTable(doc, y,
        ["Nome", "Saldo", `Em ${currency.code}`],
        wallets.map((w) => {
          const wCur = (w as any).currency || "BRL";
          const isForeign = wCur !== currency.code;
          return [
            w.name + (w.is_default ? " ★" : ""),
            formatNative(Number(w.balance), wCur),
            isForeign ? formatMoney(toSystemCurrency(Number(w.balance), wCur)) : "—",
          ];
        })
      );
      y += 8;
    }

    // Incomes
    if (incomes.length > 0) {
      y = drawSectionTitle(doc, y, "Rendas");
      y = drawTable(doc, y,
        ["Descrição", "Valor", `Em ${currency.code}`, "Carteira"],
        incomes.map((i: any) => {
          const iCur = getWalletCurrency(i.wallet_id);
          const isForeign = iCur !== currency.code;
          return [
            i.description,
            isForeign ? formatNative(Number(i.amount), iCur) : formatMoney(Number(i.amount)),
            isForeign ? formatMoney(convertItem(Number(i.amount), i.wallet_id)) : "—",
            i.wallets?.name || "—",
          ];
        })
      );
      y += 8;
    }

    // Expenses
    if (expenses.length > 0) {
      y = drawSectionTitle(doc, y, "Gastos");
      y = drawTable(doc, y,
        ["Nome", "Categoria", "Valor", `Em ${currency.code}`, "Vencimento", "Status", "Carteira"],
        expenses.map((e: any) => {
          const eCur = getWalletCurrency(e.wallet_id);
          const isForeign = eCur !== currency.code;
          return [
            e.name,
            e.categories?.name || "—",
            isForeign ? formatNative(Number(e.amount), eCur) : formatMoney(Number(e.amount)),
            isForeign ? formatMoney(convertItem(Number(e.amount), e.wallet_id)) : "—",
            new Date(e.due_date + "T12:00:00").toLocaleDateString("pt-BR"),
            e.paid ? "Pago" : "Pendente",
            e.wallets?.name || "—",
          ];
        })
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
                Total (BRL): {formatMoneyBRL(totalCarteiras)}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {wallets.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {wallets.map((w) => {
                  const wCurrency = (w as any).currency || "BRL";
                  const currencyInfo = SUPPORTED_CURRENCIES.find(c => c.code === wCurrency);
                  const isForex = wCurrency !== "BRL";
                  const balanceBRL = isForex ? convertToBRL(Number(w.balance), wCurrency, exchangeRates?.rates) : Number(w.balance);
                  const formatWalletMoney = (val: number) => {
                    if (!currencyInfo) return formatMoney(val);
                    return Number(val).toLocaleString(currencyInfo.locale, { style: "currency", currency: wCurrency, minimumFractionDigits: wCurrency === "JPY" ? 0 : 2 }).replace(/MTn|MTN/g, "MT");
                  };
                  return (
                  <div key={w.id} className="flex flex-col p-4 rounded-lg border border-border bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                        <p className="font-medium text-sm">{w.name}</p>
                        {w.is_default && <Badge variant="outline" className="text-[10px]">Principal</Badge>}
                        {isForex && <Badge variant="secondary" className="text-[10px]">{wCurrency}</Badge>}
                      </div>
                      <button onClick={() => deleteWallet.mutate(w.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div>
                      <p className={`text-xl font-bold font-display ${Number(w.balance) < 0 ? "text-destructive" : "text-primary"}`}>
                        {formatWalletMoney(Number(w.balance))}
                      </p>
                      {isForex && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          ≈ {formatMoneyBRL(balanceBRL)}
                        </p>
                      )}
                    </div>
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
                              Debitar de <strong>{w.name}</strong> ({formatMoney(Number(w.balance))})
                            </p>
                            <div className="space-y-3 py-2">
                              <div className="space-y-1">
                                <Label>Meta</Label>
                                <Select value={cofrinhoForm.goalId} onValueChange={(v) => setCofrinhoForm({ ...cofrinhoForm, goalId: v })}>
                                  <SelectTrigger><SelectValue placeholder="Escolha a meta" /></SelectTrigger>
                                  <SelectContent>
                                    {savingsGoals.map((g: any) => (
                                      <SelectItem key={g.id} value={g.id}>
                                        {g.name} ({formatMoney(Number(g.current_amount))} / {formatMoney(Number(g.target_amount))})
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
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma carteira cadastrada.</p>
            )}

            {/* Transfer between wallets */}
            {wallets.length >= 2 && (
              <div className="border-t border-border pt-3">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1 font-display" onClick={() => setTransferForm({ fromId: "", toId: "", valor: "" })}>
                      <ArrowLeftRight className="h-4 w-4" /> Transferir entre carteiras
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle className="font-display">Transferência entre Carteiras</DialogTitle></DialogHeader>
                    <div className="space-y-3 py-2">
                      <div className="space-y-1">
                        <Label>De</Label>
                        <Select value={transferForm.fromId} onValueChange={(v) => setTransferForm({ ...transferForm, fromId: v })}>
                          <SelectTrigger><SelectValue placeholder="Carteira de origem" /></SelectTrigger>
                          <SelectContent>
                            {wallets.map((w) => <SelectItem key={w.id} value={w.id}>{w.name} ({formatMoney(Number(w.balance))})</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Para</Label>
                        <Select value={transferForm.toId} onValueChange={(v) => setTransferForm({ ...transferForm, toId: v })}>
                          <SelectTrigger><SelectValue placeholder="Carteira de destino" /></SelectTrigger>
                          <SelectContent>
                            {wallets.filter(w => w.id !== transferForm.fromId).map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Valor (R$)</Label>
                        <Input type="number" placeholder="0.00" value={transferForm.valor} onChange={(e) => setTransferForm({ ...transferForm, valor: e.target.value })} min={0} step={0.01} />
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                      <DialogClose asChild>
                        <Button onClick={() => {
                          if (transferForm.fromId && transferForm.toId && transferForm.valor) {
                            walletTransfer.mutate({ fromId: transferForm.fromId, toId: transferForm.toId, amount: parseFloat(transferForm.valor) });
                          }
                        }} disabled={!transferForm.fromId || !transferForm.toId || !transferForm.valor}>Transferir</Button>
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            <div className="flex items-end gap-3 pt-2 border-t border-border flex-wrap">
              <div className="space-y-1 flex-1 min-w-[120px]">
                <Label className="text-xs">Nome</Label>
                <Input placeholder="Ex: Nubank, Itaú" value={novaCarteira.nome} onChange={(e) => setNovaCarteira({ ...novaCarteira, nome: e.target.value })} maxLength={50} />
              </div>
              <div className="space-y-1 w-28">
                <Label className="text-xs">Moeda</Label>
                <Select value={novaCarteira.currency} onValueChange={(v) => setNovaCarteira({ ...novaCarteira, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.code} ({c.symbol})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 w-36">
                <Label className="text-xs">Saldo inicial ({SUPPORTED_CURRENCIES.find(c => c.code === novaCarteira.currency)?.symbol || "R$"})</Label>
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
                {formatMoney(totalRenda)}
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
                  {formatMoney(item.value)}
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
                  <Label>Valor ({(() => { const w = wallets.find(w => w.id === novaRenda.walletId); const cur = (w as any)?.currency || "BRL"; return SUPPORTED_CURRENCIES.find(c => c.code === cur)?.symbol || "R$"; })()})</Label>
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
                <div className="space-y-3 col-span-full border-t border-border pt-4">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={novaRenda.recurring}
                      onCheckedChange={(v) => setNovaRenda({ ...novaRenda, recurring: v })}
                    />
                    <div>
                      <Label className="cursor-pointer">Renda recorrente</Label>
                      <p className="text-xs text-muted-foreground">Será criada automaticamente todo mês</p>
                    </div>
                  </div>
                </div>
              </div>
              <Button onClick={handleAddIncome} disabled={addIncome.isPending} className="mt-4 font-display">
                {addIncome.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Adicionar
              </Button>
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
                  <Label>Valor ({(() => { const w = wallets.find(w => w.id === novoGasto.walletId); const cur = (w as any)?.currency || "BRL"; return SUPPORTED_CURRENCIES.find(c => c.code === cur)?.symbol || "R$"; })()})</Label>
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
                <div className="space-y-3 col-span-full border-t border-border pt-4">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={novoGasto.recurring}
                      onCheckedChange={(v) => setNovoGasto({ ...novoGasto, recurring: v, recurringDay: v && dueDate ? String(dueDate.getDate()) : "" })}
                    />
                    <div>
                      <Label className="cursor-pointer">Gasto recorrente</Label>
                      <p className="text-xs text-muted-foreground">Será criado automaticamente todo mês</p>
                    </div>
                  </div>
                  {novoGasto.recurring && (
                    <div className="space-y-1 w-48">
                      <Label>Dia do vencimento mensal</Label>
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        placeholder="Ex: 10"
                        value={novoGasto.recurringDay}
                        onChange={(e) => setNovoGasto({ ...novoGasto, recurringDay: e.target.value })}
                      />
                    </div>
                  )}
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
                  {formatMoney(totalRenda)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {incomes.map((inc: any) => {
                const incWallet = inc.wallet_id ? wallets.find(w => w.id === inc.wallet_id) : null;
                const incCurrency = (incWallet as any)?.currency || "BRL";
                const incCurrencyInfo = SUPPORTED_CURRENCIES.find(c => c.code === incCurrency);
                const isIncForex = incCurrency !== "BRL";
                const incAmountBRL = isIncForex ? convertToBRL(Number(inc.amount), incCurrency, exchangeRates?.rates) : Number(inc.amount);
                const formatIncMoney = (val: number) => {
                  if (!incCurrencyInfo) return formatMoney(val);
                  return Number(val).toLocaleString(incCurrencyInfo.locale, { style: "currency", currency: incCurrency, minimumFractionDigits: incCurrency === "JPY" ? 0 : 2 }).replace(/MTn|MTN/g, "MT");
                };
                return (
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
                      {isIncForex && <Badge variant="secondary" className="text-[10px]">{incCurrency}</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="font-bold font-display text-primary">
                        {isIncForex ? formatIncMoney(Number(inc.amount)) : formatMoney(Number(inc.amount))}
                      </span>
                      {isIncForex && (
                        <p className="text-xs text-muted-foreground">≈ {formatMoneyBRL(incAmountBRL)}</p>
                      )}
                    </div>
                    <button onClick={() => deleteIncome.mutate(inc.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                );
              })}
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
                  {formatMoney(items.reduce((a, e) => a + Number(e.amount), 0))}
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
                            Valor: <strong>{formatMoney(Number(e.amount))}</strong>
                          </p>
                          <div className="space-y-1">
                            <Label>Debitar de qual carteira?</Label>
                            <Select value={payWalletId} onValueChange={setPayWalletId}>
                              <SelectTrigger><SelectValue placeholder="Sem débito automático" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Nenhuma</SelectItem>
                                {wallets.map((w) => (
                                  <SelectItem key={w.id} value={w.id}>
                                    {w.name} ({formatMoney(Number(w.balance))})
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
                        {e.recurring && (
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <Repeat className="h-2.5 w-2.5" /> Recorrente
                          </Badge>
                        )}
                        {e.wallets?.name && (
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <Wallet className="h-2.5 w-2.5" />{e.wallets.name}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      {(() => {
                        const eCur = getWalletCurrency(e.wallet_id);
                        const isForeign = eCur !== currency.code;
                        return (
                          <>
                            <span className="font-bold font-display">
                              {isForeign ? formatNative(Number(e.amount), eCur) : formatMoney(Number(e.amount))}
                            </span>
                            {isForeign && (
                              <p className="text-xs text-muted-foreground">≈ {formatMoney(convertItem(Number(e.amount), e.wallet_id))}</p>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    <button onClick={() => {
                      setEditExpense(e);
                      setEditForm({
                        nome: e.name, valor: String(e.amount),
                        dueDate: new Date(e.due_date + "T12:00:00"),
                        tipo: e.type, categoria: e.category_id || "",
                        walletId: e.wallet_id || "", recurring: e.recurring || false,
                        recurringDay: e.recurring_day ? String(e.recurring_day) : "",
                      });
                    }} className="text-muted-foreground hover:text-primary">
                      <Pencil className="h-4 w-4" />
                    </button>
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
                  <div className="text-right">
                    {(() => {
                      const txCur = getWalletCurrency(tx.wallet_id);
                      const isForeign = txCur !== currency.code;
                      const txConverted = convertItem(Number(tx.amount), tx.wallet_id);
                      return (
                        <>
                          <span className={`font-bold font-display text-sm ${tx.type === "credit" ? "text-primary" : "text-destructive"}`}>
                            {tx.type === "credit" ? "+" : "-"} {isForeign ? formatNative(Number(tx.amount), txCur) : formatMoney(Number(tx.amount))}
                          </span>
                          {isForeign && (
                            <p className="text-xs text-muted-foreground">≈ {formatMoney(txConverted)}</p>
                          )}
                        </>
                      );
                    })()}
                  </div>
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
                {formatMoney(saldo)}
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
                    {formatMoney(projecaoPatrimonial)}
                  </p>
                );
              })()}
            </div>
          </CardContent>
        </Card>

        {/* Edit Expense Dialog */}
        <Dialog open={!!editExpense} onOpenChange={(open) => { if (!open) setEditExpense(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="font-display">Editar Gasto</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} maxLength={100} />
              </div>
              <div className="space-y-1">
                <Label>Valor (R$)</Label>
                <Input type="number" value={editForm.valor} onChange={(e) => setEditForm({ ...editForm, valor: e.target.value })} min={0} step={0.01} />
              </div>
              <div className="space-y-1">
                <Label>Categoria</Label>
                <Select value={editForm.categoria} onValueChange={(v) => setEditForm({ ...editForm, categoria: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={editForm.tipo} onValueChange={(v) => setEditForm({ ...editForm, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixo">Fixo</SelectItem>
                    <SelectItem value="variavel">Variável</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Vencimento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editForm.dueDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editForm.dueDate ? format(editForm.dueDate, "dd/MM/yyyy") : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={editForm.dueDate} onSelect={(d) => setEditForm({ ...editForm, dueDate: d })} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <Label>Carteira</Label>
                <Select value={editForm.walletId} onValueChange={(v) => setEditForm({ ...editForm, walletId: v })}>
                  <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {wallets.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-full flex items-center gap-3">
                <Switch checked={editForm.recurring} onCheckedChange={(v) => setEditForm({ ...editForm, recurring: v })} />
                <Label>Recorrente</Label>
                {editForm.recurring && (
                  <Input type="number" min={1} max={31} placeholder="Dia" className="w-20" value={editForm.recurringDay} onChange={(e) => setEditForm({ ...editForm, recurringDay: e.target.value })} />
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditExpense(null)}>Cancelar</Button>
              <Button onClick={() => {
                if (!editExpense || !editForm.nome.trim() || !editForm.valor) return;
                updateExpense.mutate({
                  id: editExpense.id,
                  name: editForm.nome.trim(),
                  amount: parseFloat(editForm.valor),
                  due_date: editForm.dueDate ? format(editForm.dueDate, "yyyy-MM-dd") : editExpense.due_date,
                  type: editForm.tipo,
                  category_id: editForm.categoria || null,
                  wallet_id: editForm.walletId && editForm.walletId !== "none" ? editForm.walletId : null,
                  recurring: editForm.recurring,
                  recurring_day: editForm.recurring && editForm.recurringDay ? parseInt(editForm.recurringDay) : null,
                }, { onSuccess: () => setEditExpense(null) });
              }} disabled={updateExpense.isPending}>
                {updateExpense.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
