import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { Loader2, Users, BarChart3, FolderCog, Activity, Shield, Mail, Phone, Calendar, CheckCircle2, XCircle, Trash2, Plus, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AdminData {
  users: Array<{
    id: string;
    email: string;
    display_name: string | null;
    phone: string | null;
    phone_verified: boolean;
    created_at: string;
    last_sign_in_at: string | null;
    email_confirmed_at: string | null;
  }>;
  metrics: {
    totalUsers: number;
    totalTasks: number;
    totalExpenses: number;
    totalSubjects: number;
    totalFitProfiles: number;
  };
  recentActivity: {
    tasks: Array<{
      id: string;
      title: string;
      status: string;
      category: string;
      created_at: string;
      user_id: string;
    }>;
    expenses: Array<{
      id: string;
      name: string;
      amount: number;
      type: string;
      created_at: string;
      user_id: string;
    }>;
  };
}

interface Category {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<AdminData | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [catName, setCatName] = useState("");
  const [catColor, setCatColor] = useState("#E87C1E");
  const [catIcon, setCatIcon] = useState("");
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [showCatDialog, setShowCatDialog] = useState(false);

  const fetchData = async () => {
    try {
      const { data: result, error } = await supabase.functions.invoke("admin-data", {
        body: null,
        headers: {},
      });
      if (error) {
        if (error.message?.includes("403") || error.message?.includes("Forbidden")) {
          setForbidden(true);
        }
        throw error;
      }
      // Check if result contains error
      if (result?.error === "Forbidden") {
        setForbidden(true);
        return;
      }
      setData(result);
    } catch (err: any) {
      console.error("Admin fetch error:", err);
      if (err?.message?.includes("Forbidden") || err?.status === 403) {
        setForbidden(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data: result } = await supabase.functions.invoke("admin-data?action=categories", {
        body: null,
      });
      if (result?.categories) setCategories(result.categories);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchData();
      fetchCategories();
    }
  }, [authLoading, user]);

  const handleSaveCategory = async () => {
    try {
      const action = editingCat ? "update-category" : "create-category";
      const body = editingCat
        ? { id: editingCat.id, name: catName, color: catColor, icon: catIcon || null }
        : { name: catName, color: catColor, icon: catIcon || null };

      await supabase.functions.invoke(`admin-data?action=${action}`, { body });
      toast.success(editingCat ? "Categoria atualizada" : "Categoria criada");
      setShowCatDialog(false);
      setCatName("");
      setCatColor("#E87C1E");
      setCatIcon("");
      setEditingCat(null);
      fetchCategories();
    } catch {
      toast.error("Erro ao salvar categoria");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await supabase.functions.invoke("admin-data?action=delete-category", {
        body: { id },
      });
      toast.success("Categoria removida");
      fetchCategories();
    } catch {
      toast.error("Erro ao remover");
    }
  };

  const openEditCat = (cat: Category) => {
    setEditingCat(cat);
    setCatName(cat.name);
    setCatColor(cat.color || "#E87C1E");
    setCatIcon(cat.icon || "");
    setShowCatDialog(true);
  };

  const openNewCat = () => {
    setEditingCat(null);
    setCatName("");
    setCatColor("#E87C1E");
    setCatIcon("");
    setShowCatDialog(true);
  };

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (forbidden) {
    return <Navigate to="/dashboard" replace />;
  }

  const userMap = new Map(data?.users.map((u) => [u.id, u]) || []);

  const getUserEmail = (userId: string) => userMap.get(userId)?.email || userId.slice(0, 8);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Shield className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-display tracking-wider text-foreground">Painel Admin</h1>
            <p className="text-sm text-muted-foreground">Gerenciamento do sistema ORBE</p>
          </div>
        </div>

        <Tabs defaultValue="metrics" className="space-y-4">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="metrics" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <BarChart3 className="h-4 w-4" /> Métricas
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Users className="h-4 w-4" /> Usuários
            </TabsTrigger>
            <TabsTrigger value="content" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <FolderCog className="h-4 w-4" /> Conteúdo
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Activity className="h-4 w-4" /> Atividade
            </TabsTrigger>
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
                <CardTitle className="text-foreground font-display tracking-wider">
                  Usuários Cadastrados ({data?.users.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-muted-foreground">Nome</TableHead>
                      <TableHead className="text-muted-foreground">Email</TableHead>
                      <TableHead className="text-muted-foreground">Telefone</TableHead>
                      <TableHead className="text-muted-foreground">Cadastro</TableHead>
                      <TableHead className="text-muted-foreground">Último Acesso</TableHead>
                      <TableHead className="text-muted-foreground">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.users.map((u) => (
                      <TableRow key={u.id} className="border-border">
                        <TableCell className="text-foreground font-medium">
                          {u.display_name || "—"}
                        </TableCell>
                        <TableCell className="text-foreground flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs">{u.email}</span>
                        </TableCell>
                        <TableCell className="text-foreground">
                          {u.phone ? (
                            <span className="flex items-center gap-1.5 text-xs">
                              <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              {u.phone}
                              {u.phone_verified ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-destructive" />
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-foreground text-xs">
                          {format(new Date(u.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-foreground text-xs">
                          {u.last_sign_in_at
                            ? format(new Date(u.last_sign_in_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {u.email_confirmed_at ? (
                            <Badge variant="outline" className="border-green-500/30 text-green-500 text-[10px]">
                              Verificado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-destructive/30 text-destructive text-[10px]">
                              Pendente
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
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
                <Button size="sm" onClick={openNewCat} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Nova
                </Button>
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
                        <TableCell>
                          <div
                            className="h-5 w-5 rounded-sm border border-border"
                            style={{ backgroundColor: cat.color || "#888" }}
                          />
                        </TableCell>
                        <TableCell className="text-foreground font-medium">{cat.name}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{cat.icon || "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditCat(cat)}>
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteCategory(cat.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {categories.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Nenhuma categoria cadastrada
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Category Dialog */}
            <Dialog open={showCatDialog} onOpenChange={setShowCatDialog}>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="text-foreground font-display">
                    {editingCat ? "Editar Categoria" : "Nova Categoria"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Nome</label>
                    <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Nome da categoria" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Cor</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={catColor}
                        onChange={(e) => setCatColor(e.target.value)}
                        className="h-10 w-10 rounded border border-border cursor-pointer bg-transparent"
                      />
                      <Input value={catColor} onChange={(e) => setCatColor(e.target.value)} className="flex-1" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Ícone (emoji ou texto)</label>
                    <Input value={catIcon} onChange={(e) => setCatIcon(e.target.value)} placeholder="🏠" />
                  </div>
                  <Button onClick={handleSaveCategory} disabled={!catName.trim()} className="w-full">
                    Salvar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* ACTIVITY */}
          <TabsContent value="activity" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground font-display tracking-wider text-sm">
                    Últimas Tarefas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data?.recentActivity.tasks.map((t) => (
                    <div key={t.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                      <div>
                        <p className="text-sm text-foreground">{t.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {getUserEmail(t.user_id)} · {format(new Date(t.created_at), "dd/MM HH:mm")}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] border-border">
                        {t.status}
                      </Badge>
                    </div>
                  ))}
                  {(!data?.recentActivity.tasks.length) && (
                    <p className="text-muted-foreground text-sm text-center py-4">Sem atividade recente</p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground font-display tracking-wider text-sm">
                    Últimas Despesas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data?.recentActivity.expenses.map((e) => (
                    <div key={e.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                      <div>
                        <p className="text-sm text-foreground">{e.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {getUserEmail(e.user_id)} · {format(new Date(e.created_at), "dd/MM HH:mm")}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        R$ {Number(e.amount).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {(!data?.recentActivity.expenses.length) && (
                    <p className="text-muted-foreground text-sm text-center py-4">Sem atividade recente</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
