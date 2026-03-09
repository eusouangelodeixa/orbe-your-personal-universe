import { AlertTriangle, Bell } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useCurrency } from "@/contexts/CurrencyContext";

interface Expense {
  id: string;
  name: string;
  amount: number;
  due_date: string;
  paid: boolean;
}

interface DueDateAlertsProps {
  expenses: Expense[];
}

export function DueDateAlerts({ expenses }: DueDateAlertsProps) {
  const { formatMoney } = useCurrency();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const unpaid = expenses.filter((e) => !e.paid);

  const overdue = unpaid.filter((e) => new Date(e.due_date + "T12:00:00") < today);
  const dueSoon = unpaid.filter((e) => {
    const d = new Date(e.due_date + "T12:00:00");
    const diff = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 3;
  });

  if (overdue.length === 0 && dueSoon.length === 0) return null;

  return (
    <div className="space-y-3">
      {overdue.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Contas vencidas!</AlertTitle>
          <AlertDescription>
            {overdue.map((e) => (
              <div key={e.id} className="text-sm">
                <strong>{e.name}</strong> — R$ {Number(e.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (venceu em {new Date(e.due_date + "T12:00:00").toLocaleDateString("pt-BR")})
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}
      {dueSoon.length > 0 && (
        <Alert className="border-warning/50 text-warning">
          <Bell className="h-4 w-4" />
          <AlertTitle>Vencimento próximo</AlertTitle>
          <AlertDescription>
            {dueSoon.map((e) => (
              <div key={e.id} className="text-sm">
                <strong>{e.name}</strong> — R$ {Number(e.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (vence em {new Date(e.due_date + "T12:00:00").toLocaleDateString("pt-BR")})
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
