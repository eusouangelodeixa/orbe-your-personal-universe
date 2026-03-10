import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import {
  Loader2, Users, BarChart3, FolderCog, Activity, Shield, Mail, Phone,
  Calendar, CheckCircle2, XCircle, Trash2, Plus, Pencil, Link2, DollarSign,
  Zap, Bot, CreditCard, MessageSquare, Eye, EyeOff, TrendingUp, TrendingDown, Globe
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface AdminData {
  users: Array<{
    id: string; email: string; display_name: string | null; phone: string | null;
    phone_verified: boolean; created_at: string; last_sign_in_at: string | null; email_confirmed_at: string | null;
    subscription_status: string; plan_name: string | null; subscription_end: string | null; trial_ends_at: string | null;
  }>;
  metrics: { totalUsers: number; totalTasks: number; totalExpenses: number; totalSubjects: number; totalFitProfiles: number };
  recentActivity: {
    tasks: Array<{ id: string; title: string; status: string; category: string; created_at: string; user_id: string }>;
    expenses: Array<{ id: string; name: string; amount: number; type: string; created_at: string; user_id: string }>;
  };
}

interface Category { id: string; name: string; color: string | null; icon: string | null; }

interface AdminSetting {
  id: string; key: string; value: Record<string, any>; description: string | null; category: string;
}

interface FinancialData {
  totalUsers: number;
  totalSubscribers: number;
  trialingUsers: number;
  canceledSubscriptions: number;
  mrr: number;
  monthlyRevenue: number;
  refunds: number;
  planBreakdown: Array<{ name: string; count: number; revenue: number }>;
  monthlyHistory: Array<{ month: number; year: number; revenue: number }>;
  recentPayments: Array<{ id: string; email: string; amount: number; date: string; description: string }>;
}

interface LojouFinancialData {
  activeSubscribers: number;
  totalSubscriptions: number;
  canceledCount: number;
  approvedCount: number;
  conversionRate: number;
  mrr: number;
  totalRevenue: number;
  monthlyRevenue: number;
  planBreakdown: Array<{ name: string; count: number; revenue: number }>;
  subscriberList: Array<{
    id: string; user_id: string; name: string; email: string; phone: string;
    plan: string; plan_period: string; status: string; starts_at: string; ends_at: string;
    order_number: string | null; created_at: string;
  }>;
  monthlyHistory: Array<{ month: number; year: number; revenue: number }>;
}

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<AdminData | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<AdminSetting[]>([]);
  const [connections, setConnections] = useState<Array<{key: string; connected: boolean; label: string; description: string}>>([]);
  const [financial, setFinancial] = useState<FinancialData | null>(null);
  const [lojouFinancial, setLojouFinancial] = useState<LojouFinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [catName, setCatName] = useState("");
  const [catColor, setCatColor] = useState("#E87C1E");
  const [catIcon, setCatIcon] = useState("");
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [showCatDialog, setShowCatDialog] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [settingEdits, setSettingEdits] = useState<Record<string, Record<string, any>>>({});
  const [savingSettings, setSavingSettings] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    try {
      const { data: result, error } = await supabase.functions.invoke("admin-data", { body: null, headers: {} });
      if (error) { if (error.message?.includes("403") || error.message?.includes("Forbidden")) setForbidden(true); throw error; }
      if (result?.error === "Forbidden") { setForbidden(true); return; }
      setData(result);
    } catch (err: any) {
      console.error("Admin fetch error:", err);
      if (err?.message?.includes("Forbidden") || err?.status === 403) setForbidden(true);
    } finally { setLoading(false); }
  };

  const fetchCategories = async () => {
    try {
      const { data: result } = await supabase.functions.invoke("admin-data?action=categories", { body: null });
      if (result?.categories) setCategories(result.categories);
    } catch (err) { console.error(err); }
  };

  const fetchSettings = async () => {
    try {
      const { data: result } = await supabase.functions.invoke("admin-data?action=settings", { body: null });
      if (result?.settings) {
        setSettings(result.settings);
        const edits: Record<string, Record<string, any>> = {};
        result.settings.forEach((s: AdminSetting) => { edits[s.key] = { ...s.value }; });
        setSettingEdits(edits);
      }
      if (result?.connections) setConnections(result.connections);
    } catch (err) { console.error(err); }
  };

  const fetchFinancial = async () => {
    try {
      const { data: result } = await supabase.functions.invoke("admin-data?action=financial", { body: null });
      if (result && typeof result.monthlyRevenue === "number") setFinancial(result);
      else console.warn("Financial data shape mismatch:", result);
    } catch (err) { console.error(err); }
  };

  const fetchLojouFinancial = async () => {
    try {
      const { data: result } = await supabase.functions.invoke("admin-data?action=lojou-financial", { body: null });
      if (result && typeof result.mrr === "number") setLojouFinancial(result);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchData();
      fetchCategories();
      fetchSettings();
      fetchFinancial();
      fetchLojouFinancial();
    }
  }, [authLoading, user]);

  const handleSaveCategory = async () => {
    try {
      const action = editingCat ? "update-category" : "create-category";
      const body = editingCat ? { id: editingCat.id, name: catName, color: catColor, icon: catIcon || null } : { name: catName, color: catColor, icon: catIcon || null };
      await supabase.functions.invoke(`admin-data?action=${action}`, { body });
      toast.success(editingCat ? "Categoria atualizada" : "Categoria criada");
      setShowCatDialog(false); setCatName(""); setCatColor("#E87C1E"); setCatIcon(""); setEditingCat(null);
      fetchCategories();
    } catch { toast.error("Erro ao salvar categoria"); }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await supabase.functions.invoke("admin-data?action=delete-category", { body: { id } });
      toast.success("Categoria removida"); fetchCategories();
    } catch { toast.error("Erro ao remover"); }
  };

  const handleSaveSetting = async (key: string) => {
    setSavingSettings(p => ({ ...p, [key]: true }));
    try {
      await supabase.functions.invoke("admin-data?action=update-setting", { body: { key, value: settingEdits[key] } });
      toast.success("Configuração salva");
      fetchSettings();
    } catch { toast.error("Erro ao salvar"); }
    finally { setSavingSettings(p => ({ ...p, [key]: false })); }
  };

  const updateSettingField = (key: string, field: string, value: any) => {
    setSettingEdits(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const openEditCat = (cat: Category) => { setEditingCat(cat); setCatName(cat.name); setCatColor(cat.color || "#E87C1E"); setCatIcon(cat.icon || ""); setShowCatDialog(true); };
  const openNewCat = () => { setEditingCat(null); setCatName(""); setCatColor("#E87C1E"); setCatIcon(""); setShowCatDialog(true); };

  if (authLoading || loading) {
    return <AppLayout><div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;
  }
  if (forbidden) return <Navigate to="/dashboard" replace />;

  const userMap = new Map(data?.users.map((u) => [u.id, u]) || []);
  const getUserEmail = (userId: string) => userMap.get(userId)?.email || userId.slice(0, 8);

  const settingIcons: Record<string, any> = { uazapi: MessageSquare, ai_transcription: Bot, ai_text: Zap, stripe: CreditCard };
  const settingLabels: Record<string, string> = { uazapi: "uazapi (WhatsApp)", ai_transcription: "Modelo IA – Transcrição", ai_text: "Modelo IA – Geração de Texto", stripe: "Stripe (Pagamentos)" };

  const lojouChartData = lojouFinancial?.monthlyHistory.map(h => ({
    name: `${MONTH_NAMES[h.month - 1]}/${String(h.year).slice(2)}`,
    Receita: h.revenue,
  })) || [];

  const statusLabel: Record<string, { label: string; cls: string }> = {
    active: { label: "Ativo", cls: "border-green-500/30 text-green-500" },
    canceled: { label: "Cancelado", cls: "border-destructive/30 text-destructive" },
    inactive: { label: "Inativo", cls: "border-muted-foreground/30 text-muted-foreground" },
  };
    name: `${MONTH_NAMES[h.month - 1]}/${String(h.year).slice(2)}`,
    Receita: h.revenue,
  })) || [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-display tracking-wider text-foreground">Painel Admin</h1>
            <p className="text-sm text-muted-foreground">Gerenciamento do sistema ORBE</p>
          </div>
        </div>

        <Tabs defaultValue="metrics" className="space-y-4">
          <TabsList className="bg-card border border-border flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="metrics" className="gap-1.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary"><BarChart3 className="h-3.5 w-3.5" /> Métricas</TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary"><Users className="h-3.5 w-3.5" /> Usuários</TabsTrigger>
            <TabsTrigger value="content" className="gap-1.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary"><FolderCog className="h-3.5 w-3.5" /> Conteúdo</TabsTrigger>
            <TabsTrigger value="activity" className="gap-1.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary"><Activity className="h-3.5 w-3.5" /> Atividade</TabsTrigger>
            <TabsTrigger value="connections" className="gap-1.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary"><Link2 className="h-3.5 w-3.5" /> Conexões</TabsTrigger>
            <TabsTrigger value="financial" className="gap-1.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary"><DollarSign className="h-3.5 w-3.5" /> Assinaturas</TabsTrigger>
          </TabsList>

          {/* METRICS */}
          <TabsContent value="metrics" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: "Usuários", value: data?.metrics.totalUsers || 0, icon: Users },
                { label: "Tarefas", value: data?.metrics.totalTasks || 0, icon: CheckCircle2 },
                { label: "Despesas", value: data?.metrics.totalExpenses || 0, icon: BarChart3 },
                { label: "Disciplinas", value: data?.metrics.totalSubjects || 0, icon: Calendar },
                { label: "Perfis Fit", value: data?.metrics.totalFitProfiles || 0, icon: Activity },
              ].map((m) => (
                <Card key={m.label} className="bg-card border-border">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">{m.label}</p>
                        <p className="text-3xl font-display text-foreground mt-1">{m.value}</p>
                      </div>
                      <m.icon className="h-8 w-8 text-primary/40" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* USERS */}
          <TabsContent value="users">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground font-display tracking-wider">Usuários Cadastrados ({data?.users.length || 0})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-muted-foreground">Nome</TableHead>
                      <TableHead className="text-muted-foreground">Email</TableHead>
                      <TableHead className="text-muted-foreground">Assinatura</TableHead>
                      <TableHead className="text-muted-foreground">Plano</TableHead>
                      <TableHead className="text-muted-foreground">Cadastro</TableHead>
                      <TableHead className="text-muted-foreground">Último Acesso</TableHead>
                      <TableHead className="text-muted-foreground">Verificação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.users.map((u) => {
                      const statusConfig: Record<string, { label: string; className: string }> = {
                        admin: { label: "Admin", className: "border-primary/30 text-primary" },
                        active: { label: "Pagante", className: "border-green-500/30 text-green-500" },
                        trialing: { label: "Trial Stripe", className: "border-amber-500/30 text-amber-500" },
                        trial: { label: "Trial", className: "border-amber-500/30 text-amber-500" },
                        free: { label: "Gratuito", className: "border-muted-foreground/30 text-muted-foreground" },
                      };
                      const sc = statusConfig[u.subscription_status] || statusConfig.free;

                      return (
                        <TableRow key={u.id} className="border-border">
                          <TableCell className="text-foreground font-medium text-xs">{u.display_name || "—"}</TableCell>
                          <TableCell className="text-foreground">
                            <span className="flex items-center gap-1.5 text-xs"><Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />{u.email}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] ${sc.className}`}>{sc.label}</Badge>
                          </TableCell>
                          <TableCell className="text-foreground text-xs">
                            {u.plan_name || (u.subscription_status === "trial" ? "Trial 3 dias" : "—")}
                            {u.subscription_end && u.subscription_status === "active" && (
                              <span className="block text-[10px] text-muted-foreground">até {format(new Date(u.subscription_end), "dd/MM/yyyy")}</span>
                            )}
                            {u.subscription_status === "trial" && u.trial_ends_at && (
                              <span className="block text-[10px] text-muted-foreground">expira {format(new Date(u.trial_ends_at), "dd/MM HH:mm")}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-foreground text-xs">{format(new Date(u.created_at), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                          <TableCell className="text-foreground text-xs">{u.last_sign_in_at ? format(new Date(u.last_sign_in_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}</TableCell>
                          <TableCell>
                            {u.email_confirmed_at ? (
                              <Badge variant="outline" className="border-green-500/30 text-green-500 text-[10px]">✓</Badge>
                            ) : (
                              <Badge variant="outline" className="border-destructive/30 text-destructive text-[10px]">✗</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CONTENT */}
          <TabsContent value="content" className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-foreground font-display tracking-wider">Categorias</CardTitle>
                <Button size="sm" onClick={openNewCat} className="gap-1.5"><Plus className="h-4 w-4" /> Nova</Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-muted-foreground">Cor</TableHead>
                      <TableHead className="text-muted-foreground">Nome</TableHead>
                      <TableHead className="text-muted-foreground">Ícone</TableHead>
                      <TableHead className="text-muted-foreground text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((cat) => (
                      <TableRow key={cat.id} className="border-border">
                        <TableCell><div className="h-5 w-5 rounded-sm border border-border" style={{ backgroundColor: cat.color || "#888" }} /></TableCell>
                        <TableCell className="text-foreground font-medium">{cat.name}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{cat.icon || "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditCat(cat)}><Pencil className="h-4 w-4 text-muted-foreground" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteCategory(cat.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {categories.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhuma categoria cadastrada</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Dialog open={showCatDialog} onOpenChange={setShowCatDialog}>
              <DialogContent className="bg-card border-border">
                <DialogHeader><DialogTitle className="text-foreground font-display">{editingCat ? "Editar Categoria" : "Nova Categoria"}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><label className="text-xs text-muted-foreground mb-1 block">Nome</label><Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Nome da categoria" /></div>
                  <div><label className="text-xs text-muted-foreground mb-1 block">Cor</label><div className="flex items-center gap-3"><input type="color" value={catColor} onChange={(e) => setCatColor(e.target.value)} className="h-10 w-10 rounded border border-border cursor-pointer bg-transparent" /><Input value={catColor} onChange={(e) => setCatColor(e.target.value)} className="flex-1" /></div></div>
                  <div><label className="text-xs text-muted-foreground mb-1 block">Ícone (emoji ou texto)</label><Input value={catIcon} onChange={(e) => setCatIcon(e.target.value)} placeholder="🏠" /></div>
                  <Button onClick={handleSaveCategory} disabled={!catName.trim()} className="w-full">Salvar</Button>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* ACTIVITY */}
          <TabsContent value="activity" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="bg-card border-border">
                <CardHeader><CardTitle className="text-foreground font-display tracking-wider text-sm">Últimas Tarefas</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {data?.recentActivity.tasks.map((t) => (
                    <div key={t.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                      <div>
                        <p className="text-sm text-foreground">{t.title}</p>
                        <p className="text-[10px] text-muted-foreground">{getUserEmail(t.user_id)} · {format(new Date(t.created_at), "dd/MM HH:mm")}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] border-border">{t.status}</Badge>
                    </div>
                  ))}
                  {(!data?.recentActivity.tasks.length) && <p className="text-muted-foreground text-sm text-center py-4">Sem atividade recente</p>}
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardHeader><CardTitle className="text-foreground font-display tracking-wider text-sm">Últimas Despesas</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {data?.recentActivity.expenses.map((e) => (
                    <div key={e.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                      <div>
                        <p className="text-sm text-foreground">{e.name}</p>
                        <p className="text-[10px] text-muted-foreground">{getUserEmail(e.user_id)} · {format(new Date(e.created_at), "dd/MM HH:mm")}</p>
                      </div>
                      <span className="text-sm font-medium text-foreground">R$ {Number(e.amount).toFixed(2)}</span>
                    </div>
                  ))}
                  {(!data?.recentActivity.expenses.length) && <p className="text-muted-foreground text-sm text-center py-4">Sem atividade recente</p>}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* CONNECTIONS */}
          <TabsContent value="connections" className="space-y-4">
            <p className="text-xs text-muted-foreground">Status das integrações configuradas no backend. As conexões são detectadas automaticamente.</p>
            {connections.map((conn) => {
              const Icon = settingIcons[conn.key] || Link2;

              return (
                <Card key={conn.key} className="bg-card border-border">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${conn.connected ? "bg-green-500/10" : "bg-muted"}`}>
                        <Icon className={`h-5 w-5 ${conn.connected ? "text-green-500" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <CardTitle className="text-foreground font-display tracking-wider text-sm">{conn.label}</CardTitle>
                        <CardDescription className="text-xs">{conn.description}</CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${conn.connected ? "border-green-500/30 text-green-500" : "border-destructive/30 text-destructive"}`}>
                      {conn.connected ? "✓ Conectado" : "✗ Não configurado"}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {conn.connected
                        ? `${conn.label} está ativo e funcionando.`
                        : `Configure os secrets necessários no backend para ativar ${conn.label}.`}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
            {connections.length === 0 && (
              <Card className="bg-card border-border">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
                  <p>Carregando conexões...</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* FINANCIAL - Assinaturas ORBE */}
          <TabsContent value="financial" className="space-y-4">
            {financial ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Assinantes Ativos", value: String(financial.totalSubscribers), icon: Users, color: "text-green-500" },
                    { label: "Em Trial", value: String(financial.trialingUsers), icon: Zap, color: "text-amber-500" },
                    { label: "MRR", value: `R$ ${financial.mrr.toFixed(2)}`, icon: TrendingUp, color: "text-primary" },
                    { label: "Receita do Mês", value: `R$ ${financial.monthlyRevenue.toFixed(2)}`, icon: DollarSign, color: "text-green-500" },
                  ].map((m) => (
                    <Card key={m.label} className="bg-card border-border">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{m.label}</p>
                            <p className={`text-xl font-display mt-1 ${m.color}`}>{m.value}</p>
                          </div>
                          <m.icon className={`h-7 w-7 ${m.color} opacity-40`} />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-card border-border">
                    <CardContent className="pt-6">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Usuários</p>
                      <p className="text-xl font-display mt-1 text-foreground">{financial.totalUsers}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border">
                    <CardContent className="pt-6">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Taxa Conversão</p>
                      <p className="text-xl font-display mt-1 text-primary">
                        {financial.totalUsers > 0 ? ((financial.totalSubscribers / financial.totalUsers) * 100).toFixed(1) : 0}%
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border">
                    <CardContent className="pt-6">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cancelamentos</p>
                      <p className="text-xl font-display mt-1 text-destructive">{financial.canceledSubscriptions}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border">
                    <CardContent className="pt-6">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Reembolsos</p>
                      <p className="text-xl font-display mt-1 text-destructive">R$ {financial.refunds.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="bg-card border-border">
                    <CardHeader><CardTitle className="text-foreground font-display tracking-wider text-sm">Receita Mensal (6 meses)</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                            labelStyle={{ color: "hsl(var(--foreground))" }}
                            formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Receita"]}
                          />
                          <Bar dataKey="Receita" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader><CardTitle className="text-foreground font-display tracking-wider text-sm">Planos Ativos</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {financial.planBreakdown.length > 0 ? (
                        financial.planBreakdown.map((plan, i) => (
                          <div key={i} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                            <div>
                              <p className="text-sm text-foreground font-medium">{plan.name}</p>
                              <p className="text-[10px] text-muted-foreground">{plan.count} assinante{plan.count !== 1 ? "s" : ""}</p>
                            </div>
                            <span className="text-sm font-display text-green-500">R$ {plan.revenue.toFixed(2)}/mês</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground text-sm text-center py-4">Nenhum plano ativo</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Recent payments */}
                <Card className="bg-card border-border">
                  <CardHeader><CardTitle className="text-foreground font-display tracking-wider text-sm">Últimos Pagamentos</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead className="text-muted-foreground">Email</TableHead>
                          <TableHead className="text-muted-foreground">Descrição</TableHead>
                          <TableHead className="text-muted-foreground">Data</TableHead>
                          <TableHead className="text-muted-foreground text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {financial.recentPayments.map((p) => (
                          <TableRow key={p.id} className="border-border">
                            <TableCell className="text-foreground text-xs">{p.email}</TableCell>
                            <TableCell className="text-foreground text-xs">{p.description}</TableCell>
                            <TableCell className="text-foreground text-xs">{format(new Date(p.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                            <TableCell className="text-right text-sm font-medium text-green-500">R$ {p.amount.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                        {financial.recentPayments.length === 0 && (
                          <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum pagamento recente</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="bg-card border-border">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
                  <p>Carregando dados de assinaturas...</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
