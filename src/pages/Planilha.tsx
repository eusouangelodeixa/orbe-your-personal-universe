import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Check, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Gasto {
  id: string;
  nome: string;
  categoria: string;
  valor: number;
  vencimento: string;
  tipo: "fixo" | "variavel";
  pago: boolean;
}

const categorias = [
  "Moradia", "Alimentação", "Transporte", "Lazer",
  "Saúde", "Educação", "Vestuário", "Outros",
];

export default function Planilha() {
  const [renda, setRenda] = useState(5000);
  const [gastos, setGastos] = useState<Gasto[]>([
    { id: "1", nome: "Aluguel", categoria: "Moradia", valor: 1500, vencimento: "2026-03-10", tipo: "fixo", pago: true },
    { id: "2", nome: "Mercado", categoria: "Alimentação", valor: 800, vencimento: "2026-03-15", tipo: "variavel", pago: false },
    { id: "3", nome: "Internet", categoria: "Moradia", valor: 120, vencimento: "2026-03-20", tipo: "fixo", pago: false },
  ]);

  const [novoGasto, setNovoGasto] = useState({
    nome: "", categoria: "Outros", valor: "", vencimento: "", tipo: "variavel" as "fixo" | "variavel",
  });
  const [showForm, setShowForm] = useState(false);

  const totalGastos = gastos.reduce((acc, g) => acc + g.valor, 0);
  const gastosPagos = gastos.filter((g) => g.pago).reduce((acc, g) => acc + g.valor, 0);
  const gastosPendentes = totalGastos - gastosPagos;
  const saldo = renda - totalGastos;
  const projecao = renda - gastosPagos - gastosPendentes;
  const percentual = renda > 0 ? Math.round((totalGastos / renda) * 100) : 0;

  const addGasto = () => {
    if (!novoGasto.nome.trim() || !novoGasto.valor || !novoGasto.vencimento) {
      toast.error("Preencha todos os campos");
      return;
    }
    const gasto: Gasto = {
      id: Date.now().toString(),
      nome: novoGasto.nome.trim(),
      categoria: novoGasto.categoria,
      valor: parseFloat(novoGasto.valor),
      vencimento: novoGasto.vencimento,
      tipo: novoGasto.tipo,
      pago: false,
    };
    setGastos([...gastos, gasto]);
    setNovoGasto({ nome: "", categoria: "Outros", valor: "", vencimento: "", tipo: "variavel" });
    setShowForm(false);
    toast.success("Gasto adicionado");
  };

  const togglePago = (id: string) => {
    setGastos(gastos.map((g) => (g.id === id ? { ...g, pago: !g.pago } : g)));
  };

  const removeGasto = (id: string) => {
    setGastos(gastos.filter((g) => g.id !== id));
    toast.success("Gasto removido");
  };

  // Group by category
  const byCategory = gastos.reduce<Record<string, Gasto[]>>((acc, g) => {
    (acc[g.categoria] = acc[g.categoria] || []).push(g);
    return acc;
  }, {});

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-display">Planilha Doméstica</h1>
            <p className="text-muted-foreground">Controle seus gastos mensais</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="gap-2 font-display">
            <Plus className="h-4 w-4" /> Novo Gasto
          </Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="col-span-2 lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Renda</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                type="number"
                value={renda}
                onChange={(e) => setRenda(Number(e.target.value))}
                className="text-lg font-bold font-display"
              />
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
                  R$ {item.value.toLocaleString("pt-BR")}
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

        {/* Add form */}
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Adicionar Gasto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="space-y-1">
                  <Label>Nome</Label>
                  <Input
                    placeholder="Ex: Aluguel"
                    value={novoGasto.nome}
                    onChange={(e) => setNovoGasto({ ...novoGasto, nome: e.target.value })}
                    maxLength={100}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Categoria</Label>
                  <Select value={novoGasto.categoria} onValueChange={(v) => setNovoGasto({ ...novoGasto, categoria: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={novoGasto.valor}
                    onChange={(e) => setNovoGasto({ ...novoGasto, valor: e.target.value })}
                    min={0}
                    step={0.01}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Vencimento</Label>
                  <Input
                    type="date"
                    value={novoGasto.vencimento}
                    onChange={(e) => setNovoGasto({ ...novoGasto, vencimento: e.target.value })}
                  />
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
              <Button onClick={addGasto} className="mt-4 font-display">Adicionar</Button>
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
                  R$ {items.reduce((a, g) => a + g.valor, 0).toLocaleString("pt-BR")}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.map((g) => (
                <div
                  key={g.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    g.pago ? "bg-muted/30 border-border" : "bg-card border-border"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button onClick={() => togglePago(g.id)} className="shrink-0">
                      {g.pago ? (
                        <Check className="h-5 w-5 text-primary" />
                      ) : (
                        <Clock className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                    <div>
                      <p className={`font-medium ${g.pago ? "line-through text-muted-foreground" : ""}`}>
                        {g.nome}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Vence: {new Date(g.vencimento + "T12:00:00").toLocaleDateString("pt-BR")} •{" "}
                        <Badge variant="outline" className="text-[10px]">
                          {g.tipo === "fixo" ? "Fixo" : "Variável"}
                        </Badge>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold font-display">
                      R$ {g.valor.toLocaleString("pt-BR")}
                    </span>
                    <button onClick={() => removeGasto(g.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        {/* Projection */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Projeção do mês</p>
                <p className="text-xs text-muted-foreground">Se todos os pendentes forem pagos</p>
              </div>
              <p className={`text-2xl font-bold font-display ${projecao < 0 ? "text-destructive" : "text-primary"}`}>
                R$ {projecao.toLocaleString("pt-BR")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
