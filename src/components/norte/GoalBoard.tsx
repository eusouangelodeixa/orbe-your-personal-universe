import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Compass, Target, Plus, Clock, CheckCircle, Circle,
  ChevronRight, Loader2, Calendar,
} from "lucide-react";
import {
  useActiveGoalsWithProgress, useCreateGoal, useUpdateGoal,
  useGoalWithMilestones, useCreateMilestone, useUpdateMilestone,
  useTodayPriorities,
  GOAL_TYPE_META, GoalWithProgress,
} from "@/hooks/useNorte";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const TYPES = Object.entries(GOAL_TYPE_META) as [string, typeof GOAL_TYPE_META[keyof typeof GOAL_TYPE_META]][];

export function GoalBoard({ onSelect }: { onSelect: (id: string) => void }) {
  const { data: goals = [], isLoading } = useActiveGoalsWithProgress();
  const [showForm, setShowForm] = useState(false);

  if (isLoading) return <div className="animate-pulse space-y-3">{[1,2].map(i => <div key={i} className="h-24 rounded-lg bg-muted" />)}</div>;

  return (
    <div className="space-y-3">
      {goals.map((g) => {
        const meta = GOAL_TYPE_META[g.goal_type];
        return (
          <Card
            key={g.id}
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => onSelect(g.id)}
          >
            <CardContent className="py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span>{meta.icon}</span>
                    <span className="font-medium text-sm truncate">{g.title}</span>
                    <Badge variant="outline" className="text-[10px]" style={{ borderColor: meta.color, color: meta.color }}>
                      {meta.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {g.daysLeft !== null && (
                      <span className={`flex items-center gap-0.5 ${g.daysLeft <= 7 ? "text-red-500 font-medium" : ""}`}>
                        <Clock className="h-3 w-3" /> {g.daysLeft}d restantes
                      </span>
                    )}
                    <span>{g.milestones.filter(m => m.status === "completed").length}/{g.milestones.length} marcos</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold" style={{ color: meta.color }}>{g.progressPct}%</p>
                  <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                </div>
              </div>
              <Progress value={g.progressPct} className="h-1.5 mt-2" />
            </CardContent>
          </Card>
        );
      })}

      {goals.length === 0 && !showForm && (
        <Card className="text-center py-8">
          <CardContent>
            <Compass className="h-8 w-8 text-primary mx-auto mb-2 opacity-60" />
            <p className="text-sm text-muted-foreground mb-2">Seu Norte está vazio — defina sua primeira meta estratégica</p>
          </CardContent>
        </Card>
      )}

      {!showForm ? (
        <Button className="w-full" variant="outline" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova Meta
        </Button>
      ) : (
        <GoalForm onCreated={() => setShowForm(false)} onCancel={() => setShowForm(false)} />
      )}
    </div>
  );
}

function GoalForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const create = useCreateGoal();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("personal");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState(3);
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState("");

  const handleSubmit = () => {
    if (!title.trim()) return;
    create.mutate(
      {
        goal_type: type as any,
        title: title.trim(),
        description: description || null,
        target_value: targetValue ? Number(targetValue) : null,
        unit: unit || null,
        deadline: deadline || null,
        priority,
        tags: [],
      },
      { onSuccess: onCreated }
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Nova Meta Estratégica</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input placeholder="Ex: Passar em cálculo com nota ≥7" value={title} onChange={(e) => setTitle(e.target.value)} />

        <div>
          <Label className="text-xs mb-1.5 block">Tipo</Label>
          <div className="flex flex-wrap gap-1.5">
            {TYPES.map(([key, meta]) => (
              <button
                key={key}
                onClick={() => setType(key)}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                  type === key ? "border-primary bg-primary/10 font-medium" : "border-border hover:bg-accent/50"
                }`}
              >
                {meta.icon} {meta.label}
              </button>
            ))}
          </div>
        </div>

        <Textarea placeholder="Descrição (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Valor alvo</Label>
            <div className="flex gap-1">
              <Input type="number" placeholder="Ex: 7" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
              <Input placeholder="Un." value={unit} onChange={(e) => setUnit(e.target.value)} className="w-16" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Prazo</Label>
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <Label>Prioridade</Label>
            <span className="font-medium">{priority}/5</span>
          </div>
          <Slider min={1} max={5} step={1} value={[priority]} onValueChange={([v]) => setPriority(v)} />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || create.isPending} className="flex-1">
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Target className="h-4 w-4 mr-1" />}
            Criar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function GoalDetail({ goalId, onBack }: { goalId: string; onBack: () => void }) {
  const { data: goal, isLoading } = useGoalWithMilestones(goalId);
  const updateGoal = useUpdateGoal();
  const createMilestone = useCreateMilestone();
  const updateMilestone = useUpdateMilestone();
  const [newMilestone, setNewMilestone] = useState("");

  if (isLoading || !goal) return <div className="animate-pulse h-48 rounded-xl bg-muted" />;

  const meta = GOAL_TYPE_META[goal.goal_type];

  const addMilestone = () => {
    if (!newMilestone.trim()) return;
    createMilestone.mutate({
      goal_id: goalId,
      title: newMilestone.trim(),
      description: null,
      due_date: null,
      milestone_order: goal.milestones.length,
    });
    setNewMilestone("");
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="text-xs">← Voltar</Button>

      <Card style={{ borderTop: `4px solid ${meta.color}` }}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <Badge variant="outline" className="text-xs mb-1" style={{ borderColor: meta.color, color: meta.color }}>
                {meta.icon} {meta.label}
              </Badge>
              <CardTitle className="text-lg">{goal.title}</CardTitle>
              {goal.description && <p className="text-xs text-muted-foreground mt-1">{goal.description}</p>}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold" style={{ color: meta.color }}>{goal.progressPct}%</p>
              {goal.daysLeft !== null && (
                <p className={`text-xs ${goal.daysLeft <= 7 ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                  {goal.daysLeft}d restantes
                </p>
              )}
            </div>
          </div>
          <Progress value={goal.progressPct} className="h-2 mt-2" />
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Milestones */}
          <p className="text-xs font-medium">Marcos ({goal.milestones.filter(m => m.status === "completed").length}/{goal.milestones.length})</p>
          <div className="space-y-1">
            {goal.milestones.map((m) => (
              <div
                key={m.id}
                className={`flex items-center gap-2 p-2 rounded-lg border ${
                  m.status === "completed" ? "border-emerald-500/30 bg-emerald-500/5" : "border-border"
                }`}
              >
                <button
                  onClick={() =>
                    updateMilestone.mutate({
                      id: m.id,
                      goalId,
                      status: m.status === "completed" ? "pending" : "completed",
                    })
                  }
                >
                  {m.status === "completed" ? (
                    <CheckCircle className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground hover:text-primary" />
                  )}
                </button>
                <span className={`text-sm flex-1 ${m.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                  {m.title}
                </span>
                {m.due_date && (
                  <span className="text-xs text-muted-foreground">
                    {format(parseISO(m.due_date), "dd/MM", { locale: ptBR })}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Novo marco..."
              value={newMilestone}
              onChange={(e) => setNewMilestone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMilestone()}
              className="flex-1"
            />
            <Button variant="outline" size="icon" onClick={addMilestone}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {goal.status === "active" && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => updateGoal.mutate({ id: goalId, status: "completed" })}
              >
                ✅ Concluir Meta
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function TodayPriorities() {
  const { data: priorities = [], isLoading } = useTodayPriorities();

  if (isLoading || !priorities.length) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Compass className="h-4 w-4 text-primary" /> Prioridades de Hoje
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {priorities.map((p: any, idx: number) => {
          const meta = GOAL_TYPE_META[p.goal.goal_type as keyof typeof GOAL_TYPE_META];
          return (
            <div key={p.goal.id} className="flex items-center gap-2 p-2 rounded-lg border border-border">
              <span className="text-xs font-bold text-muted-foreground w-4">{idx + 1}</span>
              <span>{meta.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{p.goal.title}</p>
                {p.nextMilestone && (
                  <p className="text-[10px] text-muted-foreground truncate">→ {p.nextMilestone.title}</p>
                )}
              </div>
              <Badge
                variant={p.urgency === "high" ? "destructive" : p.urgency === "medium" ? "default" : "secondary"}
                className="text-[10px] h-4"
              >
                {p.urgency === "high" ? "Urgente" : p.urgency === "medium" ? "Médio" : "Normal"}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
