import { useState } from "react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Bell, Plus, Trash2, Loader2, Pencil } from "lucide-react";
import {
  useSavingsReminders, useAddSavingsReminder, useUpdateSavingsReminder, useDeleteSavingsReminder,
} from "@/hooks/useFinance";
import { toast } from "sonner";

interface SavingsRemindersProps {
  goals: Array<{ id: string; name: string }>;
}

export function SavingsReminders({ goals }: SavingsRemindersProps) {
  const { formatMoney } = useCurrency();
  const { data: reminders = [], isLoading } = useSavingsReminders();
  const addReminder = useAddSavingsReminder();
  const updateReminder = useUpdateSavingsReminder();
  const deleteReminder = useDeleteSavingsReminder();

  const [newReminder, setNewReminder] = useState({ goal_id: "", day_of_month: "", amount: "" });
  const [editReminder, setEditReminder] = useState<{ id: string; day_of_month: string; amount: string; enabled: boolean } | null>(null);

  const handleAdd = () => {
    const day = parseInt(newReminder.day_of_month);
    const amount = parseFloat(newReminder.amount);
    if (!newReminder.goal_id || isNaN(day) || day < 1 || day > 28 || isNaN(amount) || amount <= 0) {
      toast.error("Preencha todos os campos corretamente (dia entre 1 e 28)");
      return;
    }
    addReminder.mutate({ goal_id: newReminder.goal_id, day_of_month: day, amount });
    setNewReminder({ goal_id: "", day_of_month: "", amount: "" });
  };

  const handleEdit = () => {
    if (!editReminder) return;
    const day = parseInt(editReminder.day_of_month);
    const amount = parseFloat(editReminder.amount);
    if (isNaN(day) || day < 1 || day > 28 || isNaN(amount) || amount <= 0) {
      toast.error("Valores inválidos");
      return;
    }
    updateReminder.mutate({ id: editReminder.id, day_of_month: day, amount, enabled: editReminder.enabled });
    setEditReminder(null);
    toast.success("Lembrete atualizado!");
  };

  const goalName = (goalId: string) => goals.find((g) => g.id === goalId)?.name || "Meta removida";

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Lembretes de Poupança
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new reminder */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div className="space-y-1">
            <Label>Meta</Label>
            <Select value={newReminder.goal_id} onValueChange={(v) => setNewReminder({ ...newReminder, goal_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a meta" />
              </SelectTrigger>
              <SelectContent>
                {goals.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Dia do mês (1-28)</Label>
            <Input
              type="number"
              placeholder="Ex: 5"
              value={newReminder.day_of_month}
              onChange={(e) => setNewReminder({ ...newReminder, day_of_month: e.target.value })}
              min={1}
              max={28}
            />
          </div>
          <div className="space-y-1">
            <Label>Valor a guardar (R$)</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={newReminder.amount}
              onChange={(e) => setNewReminder({ ...newReminder, amount: e.target.value })}
              min={0}
              step={0.01}
            />
          </div>
          <Button onClick={handleAdd} disabled={addReminder.isPending} className="font-display">
            {addReminder.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Criar Lembrete
          </Button>
        </div>

        {/* Reminders list */}
        {reminders.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum lembrete configurado. Crie um acima para receber notificações mensais!
          </p>
        ) : (
          <div className="space-y-2">
            {reminders.map((r: any) => (
              <div
                key={r.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge variant={r.enabled ? "default" : "secondary"} className="text-xs">
                    Dia {r.day_of_month}
                  </Badge>
                  <span className="font-medium text-sm">{goalName(r.goal_id)}</span>
                  <span className="text-primary font-bold text-sm">{formatMoney(Number(r.amount))}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={r.enabled}
                    onCheckedChange={(enabled) => updateReminder.mutate({ id: r.id, enabled })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setEditReminder({
                      id: r.id,
                      day_of_month: String(r.day_of_month),
                      amount: String(r.amount),
                      enabled: r.enabled,
                    })}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => deleteReminder.mutate(r.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editReminder} onOpenChange={(open) => !open && setEditReminder(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">Editar Lembrete</DialogTitle></DialogHeader>
            {editReminder && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>Dia do mês (1-28)</Label>
                  <Input
                    type="number"
                    value={editReminder.day_of_month}
                    onChange={(e) => setEditReminder({ ...editReminder, day_of_month: e.target.value })}
                    min={1}
                    max={28}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    value={editReminder.amount}
                    onChange={(e) => setEditReminder({ ...editReminder, amount: e.target.value })}
                    min={0}
                    step={0.01}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editReminder.enabled}
                    onCheckedChange={(enabled) => setEditReminder({ ...editReminder, enabled })}
                  />
                  <Label>Ativo</Label>
                </div>
              </div>
            )}
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
              <Button onClick={handleEdit}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}