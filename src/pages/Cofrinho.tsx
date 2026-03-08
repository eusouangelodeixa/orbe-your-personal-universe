import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { PiggyBank, Plus, Trash2, Loader2, CalendarIcon, MinusCircle, Target } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useSavingsGoals, useAddSavingsGoal, useUpdateSavingsGoal, useDeleteSavingsGoal } from "@/hooks/useFinance";
import { toast } from "sonner";

export default function Cofrinho() {
  const { data: goals = [], isLoading } = useSavingsGoals();
  const addGoal = useAddSavingsGoal();
  const updateGoal = useUpdateSavingsGoal();
  const deleteGoal = useDeleteSavingsGoal();

  const [newGoal, setNewGoal] = useState({ name: "", target: "", deadline: undefined as Date | undefined });
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const totalSaved = goals.reduce((a, g) => a + Number(g.current_amount), 0);
  const totalTarget = goals.reduce((a, g) => a + Number(g.target_amount), 0);

  const handleAddGoal = () => {
    if (!newGoal.name.trim() || !newGoal.target) return;
    addGoal.mutate({
      name: newGoal.name.trim(),
      target_amount: parseFloat(newGoal.target),
      deadline: newGoal.deadline ? format(newGoal.deadline, "yyyy-MM-dd") : undefined,
    });
    setNewGoal({ name: "", target: "", deadline: undefined });
  };

  const handleWithdraw = (goal: any) => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Digite um valor válido");
      return;
    }
    if (amount > Number(goal.current_amount)) {
      toast.error("Valor maior que o saldo disponível");
      return;
    }
    updateGoal.mutate({
      id: goal.id,
      current_amount: Number(goal.current_amount) - amount,
    });
    setWithdrawAmount("");
    toast.success(`R$ ${amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} retirado de ${goal.name}`);
  };

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
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-display flex items-center gap-3">
            <PiggyBank className="h-8 w-8 text-primary" />
            Cofrinho
          </h1>
          <p className="text-muted-foreground">Gerencie suas metas de poupança</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Total Guardado</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-display text-primary">
                R$ {totalSaved.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Meta Total</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-display">
                R$ {totalTarget.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Progresso Geral</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-display mb-1">
                {totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0}%
              </p>
              <Progress value={totalTarget > 0 ? Math.min((totalSaved / totalTarget) * 100, 100) : 0} className="h-2" />
            </CardContent>
          </Card>
        </div>

        {/* Add new goal */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Nova Meta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label>Nome da meta</Label>
                <Input
                  placeholder="Ex: Reserva de emergência"
                  value={newGoal.name}
                  onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
                  maxLength={50}
                />
              </div>
              <div className="space-y-1">
                <Label>Valor alvo (R$)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={newGoal.target}
                  onChange={(e) => setNewGoal({ ...newGoal, target: e.target.value })}
                  min={0}
                  step={0.01}
                />
              </div>
              <div className="space-y-1">
                <Label>Prazo (opcional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !newGoal.deadline && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newGoal.deadline ? format(newGoal.deadline, "dd/MM/yyyy") : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={newGoal.deadline} onSelect={(d) => setNewGoal({ ...newGoal, deadline: d })} initialFocus locale={ptBR} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-end">
                <Button onClick={handleAddGoal} disabled={addGoal.isPending || !newGoal.name.trim() || !newGoal.target} className="font-display">
                  {addGoal.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar Meta
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Goals list */}
        {goals.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Target className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhuma meta criada ainda.</p>
              <p className="text-sm text-muted-foreground">Crie sua primeira meta de poupança acima!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {goals.map((goal: any) => {
              const progress = Number(goal.target_amount) > 0
                ? Math.min((Number(goal.current_amount) / Number(goal.target_amount)) * 100, 100)
                : 0;
              const isComplete = progress >= 100;

              return (
                <Card key={goal.id} className={isComplete ? "border-primary/50 bg-primary/5" : ""}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-bold font-display text-lg">{goal.name}</h3>
                          {isComplete && <Badge className="bg-primary text-primary-foreground">✓ Completa</Badge>}
                          {goal.deadline && (
                            <Badge variant="outline" className="text-xs">
                              Prazo: {format(new Date(goal.deadline), "dd/MM/yyyy")}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl font-bold font-display text-primary">
                            R$ {Number(goal.current_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-muted-foreground">
                            / R$ {Number(goal.target_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Progress value={progress} className="h-3 flex-1" />
                          <span className="text-sm font-medium w-12 text-right">{Math.round(progress)}%</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Withdraw button */}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-1" onClick={() => setWithdrawAmount("")} disabled={Number(goal.current_amount) === 0}>
                              <MinusCircle className="h-4 w-4 text-destructive" />
                              Retirar
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle className="font-display">Retirar de {goal.name}</DialogTitle>
                            </DialogHeader>
                            <p className="text-sm text-muted-foreground">
                              Saldo atual: <strong className="text-primary">R$ {Number(goal.current_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
                            </p>
                            <div className="space-y-1">
                              <Label>Valor a retirar (R$)</Label>
                              <Input
                                type="number"
                                placeholder="0.00"
                                value={withdrawAmount}
                                onChange={(e) => setWithdrawAmount(e.target.value)}
                                min={0}
                                max={Number(goal.current_amount)}
                                step={0.01}
                              />
                            </div>
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button variant="outline">Cancelar</Button>
                              </DialogClose>
                              <DialogClose asChild>
                                <Button variant="destructive" onClick={() => handleWithdraw(goal)} disabled={!withdrawAmount}>
                                  Confirmar Retirada
                                </Button>
                              </DialogClose>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>

                        {/* Delete button */}
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => deleteGoal.mutate(goal.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground mt-3">
                      💡 Para adicionar dinheiro a esta meta, vá em <strong>Planilha</strong> e registre uma renda vinculada a uma carteira.
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
