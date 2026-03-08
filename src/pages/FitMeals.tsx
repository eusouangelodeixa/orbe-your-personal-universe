import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Utensils, Loader2, Sparkles, ShoppingCart, Upload, PenLine, Trash2, DollarSign, Download, FileDown, Pencil, Save, X, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  createOrbeDoc, finalizeDoc, drawHeader, drawSectionTitle,
  drawListItem, drawChecklistItem, drawKeyValue, checkPage,
} from "@/lib/pdfTemplate";

interface Meal {
  name: string;
  time: string;
  items: string[];
  calories?: number;
}

export default function FitMeals() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);

  const [manualOpen, setManualOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualText, setManualText] = useState("");

  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [altLoading, setAltLoading] = useState(false);
  const [alternatives, setAlternatives] = useState<string>("");
  const [altOpen, setAltOpen] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Inline editing
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<{ title: string; meals: Meal[]; shopping_list: string[] } | null>(null);

  useEffect(() => { if (user) loadData(); }, [user]);

  const loadData = async () => {
    const { data } = await supabase.from("fit_meal_plans" as any).select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
    setPlans((data as any) || []);
    setLoading(false);
  };

  const generatePlan = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("fit-generate", { body: { type: "meal" } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Plano alimentar gerado! 🎉");
      loadData();
    } catch (err: any) { toast.error(err.message || "Erro ao gerar plano"); }
    setGenerating(false);
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `${user!.id}/meal-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage.from("fit-photos").upload(path, file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("fit-photos").getPublicUrl(path);
      await supabase.from("fit_meal_plans" as any).update({ active: false } as any).eq("user_id", user!.id);
      await supabase.from("fit_meal_plans" as any).insert({
        user_id: user!.id, title: file.name.replace(".pdf", ""), source: "pdf",
        plan_data: { raw_text: "Plano importado via PDF" }, pdf_url: urlData.publicUrl, active: true,
      } as any);
      toast.success("Plano importado via PDF! 📄"); loadData();
    } catch (err: any) { toast.error(err.message || "Erro ao importar PDF"); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const saveManualPlan = async () => {
    if (!manualTitle.trim()) { toast.error("Informe o título"); return; }
    await supabase.from("fit_meal_plans" as any).update({ active: false } as any).eq("user_id", user!.id);
    await supabase.from("fit_meal_plans" as any).insert({
      user_id: user!.id, title: manualTitle, source: "manual",
      plan_data: { raw_text: manualText }, active: true,
    } as any);
    toast.success("Plano salvo! ✅");
    setManualOpen(false); setManualTitle(""); setManualText(""); loadData();
  };

  const deletePlan = async (id: string) => {
    await supabase.from("fit_meal_plans" as any).delete().eq("id", id);
    toast.success("Plano removido"); loadData();
  };

  const activatePlan = async (id: string) => {
    await supabase.from("fit_meal_plans" as any).update({ active: false } as any).eq("user_id", user!.id);
    await supabase.from("fit_meal_plans" as any).update({ active: true } as any).eq("id", id);
    toast.success("Plano ativado"); loadData();
  };

  const getAlternatives = async () => {
    const ap = plans.find(p => p.active);
    if (!ap?.shopping_list?.length) { toast.error("Sem lista de compras"); return; }
    setAltLoading(true); setAltOpen(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fit-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: [{ role: "user", content: `Analise esta lista de compras e sugira alternativas mais baratas para cada item, mantendo o valor nutricional. Seja direto e objetivo.\n\nLista: ${ap.shopping_list.join(", ")}` }] }),
      });
      if (!resp.ok || !resp.body) throw new Error("Erro");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "", content = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, idx);
          textBuffer = textBuffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try { const p = JSON.parse(json); const c = p.choices?.[0]?.delta?.content; if (c) { content += c; setAlternatives(content); } } catch {}
        }
      }
    } catch { toast.error("Erro ao buscar alternativas"); }
    setAltLoading(false);
  };

  const exportShoppingList = (items: string[]) => {
    const text = items.map((item, i) => `${checkedItems.has(i) ? "✅" : "⬜"} ${item}`).join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Lista copiada! 📋");
  };

  // === INLINE EDITING ===
  const startEditing = () => {
    const ap = plans.find(p => p.active);
    if (!ap?.plan_data?.meals) { toast.error("Este plano não pode ser editado inline"); return; }
    setEditData({
      title: ap.title,
      meals: JSON.parse(JSON.stringify(ap.plan_data.meals)),
      shopping_list: ap.shopping_list ? [...ap.shopping_list] : [],
    });
    setEditing(true);
  };

  const cancelEditing = () => { setEditing(false); setEditData(null); };

  const saveEditing = async () => {
    const ap = plans.find(p => p.active);
    if (!ap || !editData) return;
    const { error } = await supabase.from("fit_meal_plans" as any).update({
      title: editData.title,
      plan_data: { ...ap.plan_data, title: editData.title, meals: editData.meals },
      shopping_list: editData.shopping_list,
    } as any).eq("id", ap.id);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Plano atualizado! ✅");
    setEditing(false); setEditData(null); loadData();
  };

  const updateMeal = (idx: number, field: string, value: any) => {
    if (!editData) return;
    const meals = [...editData.meals];
    meals[idx] = { ...meals[idx], [field]: value };
    setEditData({ ...editData, meals });
  };

  const addMeal = () => {
    if (!editData) return;
    setEditData({ ...editData, meals: [...editData.meals, { name: "Nova refeição", time: "12:00", items: [] }] });
  };

  const removeMeal = (idx: number) => {
    if (!editData) return;
    setEditData({ ...editData, meals: editData.meals.filter((_, i) => i !== idx) });
  };

  const addItemToMeal = (mealIdx: number) => {
    if (!editData) return;
    const meals = [...editData.meals];
    meals[mealIdx] = { ...meals[mealIdx], items: [...meals[mealIdx].items, "Novo item"] };
    setEditData({ ...editData, meals });
  };

  const updateItem = (mealIdx: number, itemIdx: number, value: string) => {
    if (!editData) return;
    const meals = [...editData.meals];
    const items = [...meals[mealIdx].items];
    items[itemIdx] = value;
    meals[mealIdx] = { ...meals[mealIdx], items };
    setEditData({ ...editData, meals });
  };

  const removeItem = (mealIdx: number, itemIdx: number) => {
    if (!editData) return;
    const meals = [...editData.meals];
    meals[mealIdx] = { ...meals[mealIdx], items: meals[mealIdx].items.filter((_, i) => i !== itemIdx) };
    setEditData({ ...editData, meals });
  };

  // === PDF EXPORT ===
  const exportPDF = () => {
    const ap = plans.find(p => p.active);
    if (!ap) return;
    const doc = createOrbeDoc();
    let y = drawHeader(doc, ap.title || "Plano Alimentar", "MÓDULO FIT — ALIMENTAÇÃO");

    if (ap.plan_data?.meals) {
      ap.plan_data.meals.forEach((meal: Meal) => {
        y = checkPage(doc, y, 40);
        y = drawSectionTitle(doc, y, `${meal.name}${meal.time ? ` — ${meal.time}` : ""}`);
        meal.items?.forEach(item => {
          y = drawListItem(doc, y, item);
        });
        if (meal.calories) {
          y = drawKeyValue(doc, y, "Calorias", `${meal.calories} kcal`);
        }
        y += 4;
      });
      if (ap.plan_data.total_calories) {
        y = checkPage(doc, y, 20);
        y = drawKeyValue(doc, y, "Total diário", `~${ap.plan_data.total_calories} kcal/dia`);
      }
    } else {
      const text = ap.plan_data?.raw_text || JSON.stringify(ap.plan_data, null, 2);
      const lines = doc.splitTextToSize(text, 170);
      lines.forEach((line: string) => {
        y = drawListItem(doc, y, line);
      });
    }

    if (ap.shopping_list?.length) {
      y = checkPage(doc, y, 30);
      y += 6;
      y = drawSectionTitle(doc, y, "Lista de Compras");
      ap.shopping_list.forEach((item: string) => {
        y = drawChecklistItem(doc, y, item, false);
      });
    }

    finalizeDoc(doc);
    doc.save(`${ap.title || "plano-alimentar"}.pdf`);
    toast.success("PDF exportado! 📄");
  };

  const activePlan = plans.find(p => p.active);

  if (loading) {
    return <AppLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold font-display flex items-center gap-2">
              <Utensils className="h-6 w-6 text-primary" /> Plano Alimentar
            </h1>
            <p className="text-muted-foreground text-sm">Personalizado para seu objetivo e orçamento</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setManualOpen(true)}>
              <PenLine className="h-4 w-4" /> Manual
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 relative" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} PDF
              <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} />
            </Button>
            <Button onClick={generatePlan} disabled={generating} size="sm" className="gap-1.5">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Gerar IA
            </Button>
          </div>
        </div>

        {activePlan ? (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  {editing ? (
                    <Input value={editData?.title || ""} onChange={e => setEditData(d => d ? { ...d, title: e.target.value } : d)} className="h-8 text-base font-semibold" />
                  ) : (
                    <CardTitle className="text-base">{activePlan.title}</CardTitle>
                  )}
                  <div className="flex items-center gap-1.5">
                    {editing ? (
                      <>
                        <Button variant="default" size="sm" className="h-7 text-xs gap-1" onClick={saveEditing}><Save className="h-3 w-3" /> Salvar</Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={cancelEditing}><X className="h-3 w-3" /> Cancelar</Button>
                      </>
                    ) : (
                      <>
                        <Badge variant="default">Ativo</Badge>
                        {activePlan.plan_data?.meals && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={startEditing}><Pencil className="h-3.5 w-3.5" /></Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={exportPDF}><FileDown className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deletePlan(activePlan.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                      </>
                    )}
                  </div>
                </div>
                {!editing && (
                  <CardDescription>
                    {activePlan.source === "ai" ? "Gerado por IA" : activePlan.source === "pdf" ? "Importado de PDF" : "Criado manualmente"} em{" "}
                    {new Date(activePlan.created_at).toLocaleDateString("pt-BR")}
                    {activePlan.plan_data?.total_calories && ` · ~${activePlan.plan_data.total_calories} kcal/dia`}
                    {activePlan.plan_data?.estimated_cost && ` · ~R$${activePlan.plan_data.estimated_cost}/mês`}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {editing && editData ? (
                  <div className="space-y-4">
                    {editData.meals.map((meal, mi) => (
                      <div key={mi} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Input value={meal.name} onChange={e => updateMeal(mi, "name", e.target.value)} className="h-7 text-sm font-medium flex-1" />
                          <Input type="time" value={meal.time} onChange={e => updateMeal(mi, "time", e.target.value)} className="h-7 text-xs w-24" />
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeMeal(mi)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                        </div>
                        {meal.items.map((item, ii) => (
                          <div key={ii} className="flex items-center gap-1.5 pl-2">
                            <Input value={item} onChange={e => updateItem(mi, ii, e.target.value)} className="h-7 text-xs flex-1" />
                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeItem(mi, ii)}><X className="h-3 w-3" /></Button>
                          </div>
                        ))}
                        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 w-full" onClick={() => addItemToMeal(mi)}>
                          <Plus className="h-3 w-3" /> Adicionar item
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="gap-1 w-full" onClick={addMeal}>
                      <Plus className="h-3 w-3" /> Adicionar refeição
                    </Button>
                  </div>
                ) : activePlan.plan_data?.meals ? (
                  <div className="space-y-4">
                    {activePlan.plan_data.meals.map((meal: any, i: number) => (
                      <div key={i} className="rounded-lg border p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">{meal.name}</p>
                          <span className="text-xs text-muted-foreground">{meal.time}</span>
                        </div>
                        {meal.items?.map((item: string, j: number) => (
                          <p key={j} className="text-sm pl-3 text-muted-foreground">• {item}</p>
                        ))}
                        {meal.calories && <p className="text-xs text-muted-foreground pl-3 font-medium">{meal.calories} kcal</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {activePlan.plan_data?.raw_text || JSON.stringify(activePlan.plan_data, null, 2)}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Shopping List */}
            {activePlan.shopping_list?.length > 0 && !editing && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Lista de Compras</CardTitle>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => exportShoppingList(activePlan.shopping_list)}>
                        <Download className="h-3 w-3" /> Copiar
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={getAlternatives}>
                        <DollarSign className="h-3 w-3" /> Alternativas
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activePlan.shopping_list.map((item: string, i: number) => (
                      <label key={i} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={checkedItems.has(i)} onCheckedChange={(checked) => {
                          const next = new Set(checkedItems); checked ? next.add(i) : next.delete(i); setCheckedItems(next);
                        }} />
                        <span className={checkedItems.has(i) ? "line-through text-muted-foreground" : ""}>{item}</span>
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center space-y-3">
              <Utensils className="h-12 w-12 mx-auto text-muted-foreground/30" />
              <p className="text-muted-foreground">Nenhum plano alimentar ativo</p>
              <div className="flex gap-2 justify-center">
                <Button onClick={generatePlan} disabled={generating} className="gap-1.5">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Gerar com IA
                </Button>
                <Button variant="outline" onClick={() => setManualOpen(true)} className="gap-1.5"><PenLine className="h-4 w-4" /> Criar manual</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Other plans */}
        {plans.filter(p => !p.active).length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Planos anteriores</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {plans.filter(p => !p.active).map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium text-sm">{p.title}</p>
                    <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => activatePlan(p.id)}>Ativar</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deletePlan(p.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Manual plan dialog */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Criar plano manualmente</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={manualTitle} onChange={e => setManualTitle(e.target.value)} placeholder="Meu plano alimentar" />
            </div>
            <div className="space-y-2">
              <Label>Plano</Label>
              <Textarea value={manualText} onChange={e => setManualText(e.target.value)}
                placeholder={"Café da manhã - 7h\n- 2 ovos mexidos\n- 1 fatia de pão integral\n\nAlmoço - 12h\n- 150g frango grelhado\n- Arroz e feijão"}
                className="min-h-[200px]" />
            </div>
            <Button onClick={saveManualPlan} className="w-full">Salvar plano</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Alternatives dialog */}
      <Dialog open={altOpen} onOpenChange={setAltOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><DollarSign className="h-4 w-4" /> Alternativas econômicas</DialogTitle></DialogHeader>
          {altLoading && !alternatives ? (
            <div className="flex items-center gap-2 py-8 justify-center"><Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm text-muted-foreground">Buscando alternativas...</span></div>
          ) : (
            <div className="text-sm whitespace-pre-wrap">{alternatives}</div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
