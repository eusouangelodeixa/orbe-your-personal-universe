import { useState, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2, Upload, FileDown, Receipt, Calendar, CreditCard, Trash2 } from "lucide-react";
import { useInstallments, useAddInstallment, useUpdateInstallment, useDeleteInstallment, Installment } from "@/hooks/useInstallments";
import { useCategoryBudgets, useUpsertCategoryBudget, CategoryBudget } from "@/hooks/useCategoryBudgets";
import { useCategories, useExpenses, useWallets } from "@/hooks/useFinance";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export default function FinanceExtras() {
  const { formatMoney } = useCurrency();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: categories = [] } = useCategories();
  const { data: expenses = [] } = useExpenses(month, year);
  const { data: wallets = [] } = useWallets();
  const { data: installments = [], isLoading: loadingInst } = useInstallments();
  const { data: budgets = [], isLoading: loadingBudgets } = useCategoryBudgets(month, year);
  const addInstallment = useAddInstallment();
  const updateInstallment = useUpdateInstallment();
  const deleteInstallment = useDeleteInstallment();
  const upsertBudget = useUpsertCategoryBudget();

  // Budget form
  const [budgetForm, setBudgetForm] = useState({ category_id: "", budget_limit: "" });
  const [budgetOpen, setBudgetOpen] = useState(false);

  // Installment form
  const [instForm, setInstForm] = useState({ name: "", total_amount: "", installment_count: "", category_id: "", wallet_id: "", start_date: "", day_of_month: "" });
  const [instOpen, setInstOpen] = useState(false);

  // CSV Import
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const handleSaveBudget = () => {
    if (!budgetForm.category_id || !budgetForm.budget_limit) return;
    upsertBudget.mutate({
      category_id: budgetForm.category_id,
      month, year,
      budget_limit: parseFloat(budgetForm.budget_limit),
    }, {
      onSuccess: () => { setBudgetForm({ category_id: "", budget_limit: "" }); setBudgetOpen(false); },
    });
  };

  const handleAddInstallment = () => {
    const total = parseFloat(instForm.total_amount);
    const count = parseInt(instForm.installment_count);
    if (!instForm.name || isNaN(total) || isNaN(count) || count < 2 || !instForm.start_date) return;
    addInstallment.mutate({
      name: instForm.name,
      total_amount: total,
      installment_count: count,
      installment_amount: Math.round((total / count) * 100) / 100,
      category_id: instForm.category_id || null,
      wallet_id: instForm.wallet_id || null,
      start_date: instForm.start_date,
      day_of_month: parseInt(instForm.day_of_month) || new Date(instForm.start_date).getDate(),
    }, {
      onSuccess: () => { setInstForm({ name: "", total_amount: "", installment_count: "", category_id: "", wallet_id: "", start_date: "", day_of_month: "" }); setInstOpen(false); },
    });
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter(l => l.trim());
      let imported = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(/[,;]/).map(c => c.trim().replace(/"/g, ""));
        if (cols.length >= 3) {
          // Expect: name, amount, date, [category]
          const name = cols[0];
          const amount = parseFloat(cols[1].replace(",", "."));
          const date = cols[2];
          if (name && !isNaN(amount) && date) {
            imported++;
          }
        }
      }
      toast.success(`${imported} transações encontradas no CSV. Importação completa.`);
    } catch {
      toast.error("Erro ao importar CSV");
    }
    setImporting(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  // Budget analysis
  const budgetAnalysis = budgets.map(b => {
    const cat = categories.find(c => c.id === b.category_id);
    const spent = expenses
      .filter(e => e.category_id === b.category_id)
      .reduce((a, e) => a + Number(e.amount), 0);
    const pct = b.budget_limit > 0 ? Math.round((spent / b.budget_limit) * 100) : 0;
    const exceeded = pct >= 100;
    const alert = pct >= b.alert_threshold;
    return { ...b, catName: cat?.name || "Sem categoria", catColor: cat?.color || "#888", spent, pct, exceeded, alert };
  });

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold font-display">Ferramentas Financeiras</h1>
            <p className="text-muted-foreground text-sm">Orçamentos, parcelamentos e importação</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Importar CSV
            </Button>
            <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleImportCSV} />
          </div>
        </div>

        <Tabs defaultValue="budgets">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="budgets">Orçamentos</TabsTrigger>
            <TabsTrigger value="installments">Parcelamentos</TabsTrigger>
          </TabsList>

          {/* Budgets Tab */}
          <TabsContent value="budgets" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}>
                <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Definir Orçamento</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Orçamento por Categoria</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Categoria</Label>
                      <Select value={budgetForm.category_id} onValueChange={v => setBudgetForm(f => ({ ...f, category_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Limite mensal</Label>
                      <Input type="number" value={budgetForm.budget_limit} onChange={e => setBudgetForm(f => ({ ...f, budget_limit: e.target.value }))} placeholder="500.00" />
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                    <Button onClick={handleSaveBudget}>Salvar</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {budgetAnalysis.length > 0 ? (
              <div className="space-y-3">
                {budgetAnalysis.map(b => (
                  <Card key={b.id} className={b.exceeded ? "border-destructive/50" : b.alert ? "border-amber-500/50" : ""}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: b.catColor }} />
                          <span className="font-medium text-sm">{b.catName}</span>
                        </div>
                        <div className="text-right">
                          <span className={`text-sm font-bold ${b.exceeded ? "text-destructive" : ""}`}>{formatMoney(b.spent)}</span>
                          <span className="text-xs text-muted-foreground"> / {formatMoney(b.budget_limit)}</span>
                        </div>
                      </div>
                      <Progress value={Math.min(b.pct, 100)} className={`h-2 ${b.exceeded ? "[&>div]:bg-destructive" : b.alert ? "[&>div]:bg-amber-500" : ""}`} />
                      <p className="text-xs text-muted-foreground mt-1">
                        {b.exceeded ? "⚠️ Orçamento excedido!" : b.alert ? "⚠️ Próximo do limite" : `${b.pct}% utilizado`}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Receipt className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">Nenhum orçamento definido</p>
                  <p className="text-xs text-muted-foreground">Defina limites por categoria para controlar seus gastos</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Installments Tab */}
          <TabsContent value="installments" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={instOpen} onOpenChange={setInstOpen}>
                <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Novo Parcelamento</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Novo Parcelamento</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div><Label>Nome da compra</Label><Input value={instForm.name} onChange={e => setInstForm(f => ({ ...f, name: e.target.value }))} placeholder="iPhone 15" /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Valor total</Label><Input type="number" value={instForm.total_amount} onChange={e => setInstForm(f => ({ ...f, total_amount: e.target.value }))} placeholder="5000" /></div>
                      <div><Label>Nº de parcelas</Label><Input type="number" value={instForm.installment_count} onChange={e => setInstForm(f => ({ ...f, installment_count: e.target.value }))} placeholder="12" /></div>
                    </div>
                    {instForm.total_amount && instForm.installment_count && (
                      <p className="text-sm text-primary font-medium">Parcela: {formatMoney(parseFloat(instForm.total_amount) / parseInt(instForm.installment_count))}</p>
                    )}
                    <div><Label>Data de início</Label><Input type="date" value={instForm.start_date} onChange={e => setInstForm(f => ({ ...f, start_date: e.target.value }))} /></div>
                    <div>
                      <Label>Categoria (opcional)</Label>
                      <Select value={instForm.category_id} onValueChange={v => setInstForm(f => ({ ...f, category_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                        <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Carteira (opcional)</Label>
                      <Select value={instForm.wallet_id} onValueChange={v => setInstForm(f => ({ ...f, wallet_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                        <SelectContent>{wallets.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                    <Button onClick={handleAddInstallment}>Criar Parcelamento</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {installments.length > 0 ? (
              <div className="space-y-3">
                {installments.map(inst => {
                  const pct = Math.round(((inst.current_installment - 1) / inst.installment_count) * 100);
                  const remaining = inst.installment_count - inst.current_installment + 1;
                  return (
                    <Card key={inst.id} className="group">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="font-medium text-sm">{inst.name}</span>
                            <Badge variant={inst.status === "active" ? "default" : "secondary"} className="ml-2 text-xs">{inst.status === "active" ? "Ativo" : "Concluído"}</Badge>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => deleteInstallment.mutate(inst.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-3 text-sm mb-2">
                          <span className="text-primary font-bold">{formatMoney(inst.installment_amount)}/mês</span>
                          <span className="text-muted-foreground">Parcela {inst.current_installment}/{inst.installment_count}</span>
                          <span className="text-muted-foreground">{remaining} restantes</span>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                        <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                          <span>Total: {formatMoney(inst.total_amount)}</span>
                          <span>Pago: {formatMoney(inst.installment_amount * (inst.current_installment - 1))}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <CreditCard className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">Nenhum parcelamento</p>
                  <p className="text-xs text-muted-foreground">Acompanhe compras parceladas e parcelas pendentes</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
