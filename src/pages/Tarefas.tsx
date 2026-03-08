import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckSquare, Plus, Loader2, Trash2, Calendar, AlertCircle,
  Filter, Clock, Flag, Wallet, GraduationCap, Dumbbell, ListTodo,
  Edit2, MessageCircle
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isToday, isTomorrow, isPast, isThisWeek, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  category: string;
  reference_id: string | null;
  reference_type: string | null;
  reminder_sent: boolean;
  created_at: string;
  completed_at: string | null;
}

const CATEGORIES = [
  { value: "geral", label: "Geral", icon: ListTodo, color: "text-muted-foreground" },
  { value: "financeiro", label: "Financeiro", icon: Wallet, color: "text-emerald-500" },
  { value: "academico", label: "Acadêmico", icon: GraduationCap, color: "text-blue-500" },
  { value: "fit", label: "Fitness", icon: Dumbbell, color: "text-orange-500" },
];

const PRIORITIES = [
  { value: "baixa", label: "Baixa", color: "bg-muted text-muted-foreground" },
  { value: "media", label: "Média", color: "bg-yellow-500/20 text-yellow-500" },
  { value: "alta", label: "Alta", color: "bg-red-500/20 text-red-500" },
];

export default function Tarefas() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("todas");
  const [categoryFilter, setCategoryFilter] = useState("todas");

  const [form, setForm] = useState({
    title: "",
    description: "",
    due_date: "",
    due_time: "",
    priority: "media",
    category: "geral",
  });

  useEffect(() => {
    if (user) loadTasks();
  }, [user]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("tasks-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        loadTasks();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadTasks = async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });

    if (!error) setTasks((data as any) || []);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({ title: "", description: "", due_date: "", due_time: "", priority: "media", category: "geral" });
    setEditingTask(null);
  };

  const openEdit = (task: Task) => {
    const dueDate = task.due_date ? new Date(task.due_date) : null;
    setForm({
      title: task.title,
      description: task.description || "",
      due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : "",
      due_time: dueDate ? format(dueDate, "HH:mm") : "",
      priority: task.priority,
      category: task.category,
    });
    setEditingTask(task);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Título obrigatório"); return; }
    setSaving(true);

    const dueDate = form.due_date
      ? new Date(`${form.due_date}T${form.due_time || "23:59"}:00`).toISOString()
      : null;

    if (editingTask) {
      const { error } = await supabase
        .from("tasks")
        .update({
          title: form.title.trim(),
          description: form.description.trim() || null,
          due_date: dueDate,
          priority: form.priority,
          category: form.category,
        } as any)
        .eq("id", editingTask.id);

      if (error) { toast.error("Erro ao atualizar"); console.error(error); }
      else toast.success("Tarefa atualizada");
    } else {
      const { error } = await supabase
        .from("tasks")
        .insert({
          user_id: user!.id,
          title: form.title.trim(),
          description: form.description.trim() || null,
          due_date: dueDate,
          priority: form.priority,
          category: form.category,
        } as any);

      if (error) { toast.error("Erro ao criar tarefa"); console.error(error); }
      else toast.success("Tarefa criada! ✅");
    }

    setSaving(false);
    setDialogOpen(false);
    resetForm();
    loadTasks();
  };

  const toggleComplete = async (task: Task) => {
    const newStatus = task.status === "concluida" ? "pendente" : "concluida";
    await supabase
      .from("tasks")
      .update({
        status: newStatus,
        completed_at: newStatus === "concluida" ? new Date().toISOString() : null,
      } as any)
      .eq("id", task.id);
    loadTasks();
  };

  const deleteTask = async (id: string) => {
    await supabase.from("tasks").delete().eq("id", id);
    loadTasks();
    toast.success("Tarefa removida");
  };

  const getDateLabel = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isToday(date)) return { label: "Hoje", className: "text-primary" };
    if (isTomorrow(date)) return { label: "Amanhã", className: "text-yellow-500" };
    if (isPast(date)) return { label: "Atrasada", className: "text-red-500" };
    if (isThisWeek(date)) return { label: format(date, "EEEE", { locale: ptBR }), className: "text-muted-foreground" };
    return { label: format(date, "dd/MM", { locale: ptBR }), className: "text-muted-foreground" };
  };

  // Filter tasks
  const filteredTasks = tasks.filter(t => {
    if (categoryFilter !== "todas" && t.category !== categoryFilter) return false;
    if (filter === "pendentes") return t.status !== "concluida";
    if (filter === "concluidas") return t.status === "concluida";
    if (filter === "hoje") return t.due_date && isToday(new Date(t.due_date));
    if (filter === "atrasadas") return t.due_date && isPast(new Date(t.due_date)) && t.status !== "concluida";
    if (filter === "semana") {
      if (!t.due_date) return false;
      const d = new Date(t.due_date);
      return d >= new Date() && d <= addDays(new Date(), 7);
    }
    return true;
  });

  // Sort: incomplete first, then by priority, then by due date
  const priorityOrder: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (a.status === "concluida" && b.status !== "concluida") return 1;
    if (a.status !== "concluida" && b.status === "concluida") return -1;
    const pa = priorityOrder[a.priority] ?? 1;
    const pb = priorityOrder[b.priority] ?? 1;
    if (pa !== pb) return pa - pb;
    if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return 0;
  });

  const pendingCount = tasks.filter(t => t.status !== "concluida").length;
  const overdueCount = tasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && t.status !== "concluida").length;
  const todayCount = tasks.filter(t => t.due_date && isToday(new Date(t.due_date)) && t.status !== "concluida").length;
  const completedCount = tasks.filter(t => t.status === "concluida").length;

  if (loading) {
    return <AppLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-display flex items-center gap-2">
              <CheckSquare className="h-8 w-8 text-primary" /> Tarefas
            </h1>
            <p className="text-muted-foreground">Gerencie todas as suas tarefas em um lugar</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Nova Tarefa</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTask ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Título *</Label>
                  <Input
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Ex: Pagar conta de luz"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Detalhes opcionais..."
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Data limite</Label>
                    <Input
                      type="date"
                      value={form.due_date}
                      onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Horário</Label>
                    <Input
                      type="time"
                      value={form.due_time}
                      onChange={e => setForm(f => ({ ...f, due_time: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Prioridade</Label>
                    <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map(p => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckSquare className="h-4 w-4" />}
                  {editingTask ? "Salvar" : "Criar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setFilter("pendentes")}>
            <CardContent className="pt-4 text-center">
              <ListTodo className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setFilter("hoje")}>
            <CardContent className="pt-4 text-center">
              <Calendar className="h-5 w-5 mx-auto text-blue-500 mb-1" />
              <p className="text-2xl font-bold">{todayCount}</p>
              <p className="text-xs text-muted-foreground">Para hoje</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setFilter("atrasadas")}>
            <CardContent className="pt-4 text-center">
              <AlertCircle className="h-5 w-5 mx-auto text-red-500 mb-1" />
              <p className="text-2xl font-bold">{overdueCount}</p>
              <p className="text-xs text-muted-foreground">Atrasadas</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setFilter("concluidas")}>
            <CardContent className="pt-4 text-center">
              <CheckSquare className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
              <p className="text-2xl font-bold">{completedCount}</p>
              <p className="text-xs text-muted-foreground">Concluídas</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {[
            { value: "todas", label: "Todas" },
            { value: "pendentes", label: "Pendentes" },
            { value: "hoje", label: "Hoje" },
            { value: "semana", label: "Esta semana" },
            { value: "atrasadas", label: "Atrasadas" },
            { value: "concluidas", label: "Concluídas" },
          ].map(f => (
            <Button
              key={f.value}
              variant={filter === f.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
          <div className="ml-auto">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas categorias</SelectItem>
                {CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* WhatsApp tip */}
        <div className="rounded-lg border bg-muted/30 p-3 flex items-center gap-3 text-sm">
          <MessageCircle className="h-5 w-5 text-primary flex-shrink-0" />
          <div>
            <span className="font-medium">Crie tarefas via WhatsApp!</span>{" "}
            <span className="text-muted-foreground">
              Envie uma mensagem com "tarefa:" seguido do título para criar rapidamente. Ex: "tarefa: Pagar conta de luz amanhã"
            </span>
          </div>
        </div>

        {/* Task List */}
        <Card>
          <CardContent className="p-0">
            {sortedTasks.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <CheckSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhuma tarefa encontrada</p>
                <p className="text-sm">Crie sua primeira tarefa clicando em "Nova Tarefa"</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {sortedTasks.map(task => {
                  const dateInfo = getDateLabel(task.due_date);
                  const cat = CATEGORIES.find(c => c.value === task.category);
                  const pri = PRIORITIES.find(p => p.value === task.priority);
                  const CatIcon = cat?.icon || ListTodo;
                  const isComplete = task.status === "concluida";

                  return (
                    <div
                      key={task.id}
                      className={`flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors ${isComplete ? "opacity-60" : ""}`}
                    >
                      <Checkbox
                        checked={isComplete}
                        onCheckedChange={() => toggleComplete(task)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`font-medium text-sm ${isComplete ? "line-through" : ""}`}>
                            {task.title}
                          </p>
                          <Badge variant="outline" className={`text-[10px] ${pri?.color}`}>
                            <Flag className="h-2.5 w-2.5 mr-1" />
                            {pri?.label}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            <CatIcon className={`h-2.5 w-2.5 mr-1 ${cat?.color}`} />
                            {cat?.label}
                          </Badge>
                        </div>
                        {task.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.description}</p>
                        )}
                        {dateInfo && (
                          <div className="flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className={`text-xs font-medium ${dateInfo.className}`}>
                              {dateInfo.label}
                              {task.due_date && (
                                <span className="text-muted-foreground font-normal ml-1">
                                  {format(new Date(task.due_date), "HH:mm") !== "23:59" &&
                                    `às ${format(new Date(task.due_date), "HH:mm")}`}
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(task)}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteTask(task.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
