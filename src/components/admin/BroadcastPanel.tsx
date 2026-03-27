import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2, Send, Sparkles, Users, Play, Pause, XCircle, Copy,
  Clock, CheckCircle2, AlertTriangle, RotateCcw, Eye, Settings2,
  MessageSquare, Zap, ChevronDown, ChevronUp, Search
} from "lucide-react";

interface Recipient {
  user_id: string;
  phone: string;
  display_name: string | null;
  phone_verified: boolean;
  created_at: string;
}

interface Campaign {
  id: string;
  name: string;
  message: string;
  status: string;
  scheduled_at: string | null;
  sending_config: any;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  completed_at: string | null;
}

interface Variation {
  tone: string;
  message: string;
  estimated_open_rate: number;
}

async function callBroadcast(action: string, body: any = {}) {
  const { data, error } = await supabase.functions.invoke(`broadcast-campaign?action=${action}`, {
    body,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: any }> = {
  draft: { label: "Rascunho", cls: "border-muted-foreground/30 text-muted-foreground", icon: MessageSquare },
  scheduled: { label: "Agendado", cls: "border-amber-500/30 text-amber-500", icon: Clock },
  sending: { label: "Enviando", cls: "border-blue-500/30 text-blue-500", icon: Send },
  paused: { label: "Pausado", cls: "border-amber-500/30 text-amber-500", icon: Pause },
  completed: { label: "Concluído", cls: "border-green-500/30 text-green-500", icon: CheckCircle2 },
  canceled: { label: "Cancelado", cls: "border-destructive/30 text-destructive", icon: XCircle },
};

export function BroadcastPanel() {
  const [tab, setTab] = useState("create");
  const [users, setUsers] = useState<Recipient[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [search, setSearch] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  // Create campaign state
  const [campaignName, setCampaignName] = useState("");
  const [message, setMessage] = useState("");
  const [aiObjective, setAiObjective] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [minDelay, setMinDelay] = useState("8");
  const [maxDelay, setMaxDelay] = useState("45");
  const [hourlyLimit, setHourlyLimit] = useState("80");
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);

  // Campaign detail
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null);
  const [detailRecipients, setDetailRecipients] = useState<any[]>([]);
  const [showDetail, setShowDetail] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const data = await callBroadcast("users");
      setUsers(data.users || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const fetchCampaigns = useCallback(async () => {
    setLoadingCampaigns(true);
    try {
      const data = await callBroadcast("list");
      setCampaigns(data.campaigns || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoadingCampaigns(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchCampaigns();
  }, [fetchUsers, fetchCampaigns]);

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      (u.display_name || "").toLowerCase().includes(q) ||
      (u.phone || "").includes(q)
    );
  });

  const verifiedUsers = filteredUsers.filter((u) => u.phone_verified);

  const toggleUser = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const ids = verifiedUsers.map((u) => u.user_id);
    setSelectedIds(new Set(ids));
  };

  const deselectAll = () => setSelectedIds(new Set());

  const generateContent = async () => {
    if (!aiObjective.trim()) { toast.error("Informe o objetivo do aviso"); return; }
    setAiLoading(true);
    try {
      const data = await callBroadcast("generate-content", { objective: aiObjective });
      setVariations(data.variations || []);
      toast.success("Variações geradas com sucesso!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const useVariation = (msg: string) => {
    setMessage(msg);
    toast.success("Mensagem aplicada!");
  };

  const createAndSend = async () => {
    if (!campaignName.trim()) { toast.error("Dê um nome à campanha"); return; }
    if (!message.trim()) { toast.error("Escreva a mensagem"); return; }
    if (selectedIds.size === 0) { toast.error("Selecione ao menos um destinatário"); return; }

    setCreating(true);
    try {
      const data = await callBroadcast("create", {
        name: campaignName,
        message,
        recipient_ids: Array.from(selectedIds),
        sending_config: {
          min_delay: Number(minDelay) || 8,
          max_delay: Number(maxDelay) || 45,
          hourly_limit: Number(hourlyLimit) || 80,
        },
      });

      toast.success(`Campanha criada com ${data.recipients_count} destinatários!`);

      // Start sending
      setSending(true);
      try {
        await callBroadcast("send", { campaign_id: data.campaign.id });
        toast.success("Disparo concluído!");
      } catch (e: any) {
        toast.error("Erro no disparo: " + e.message);
      } finally {
        setSending(false);
      }

      fetchCampaigns();
      setCampaignName("");
      setMessage("");
      setSelectedIds(new Set());
      setVariations([]);
      setAiObjective("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleCampaignAction = async (campaignId: string, action: string) => {
    try {
      await callBroadcast(action, { campaign_id: campaignId });
      toast.success(`Campanha ${action === "pause" ? "pausada" : action === "resume" ? "retomada" : "cancelada"}`);
      if (action === "resume") {
        callBroadcast("send", { campaign_id: campaignId }).then(() => {
          toast.success("Disparo retomado concluído!");
          fetchCampaigns();
        });
      }
      fetchCampaigns();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const viewCampaignDetail = async (campaign: Campaign) => {
    setDetailCampaign(campaign);
    setShowDetail(true);
    try {
      const data = await callBroadcast("recipients", { campaign_id: campaign.id });
      setDetailRecipients(data.recipients || []);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const cloneCampaign = (campaign: Campaign) => {
    setCampaignName(`${campaign.name} (cópia)`);
    setMessage(campaign.message);
    setTab("create");
    toast.success("Campanha clonada — edite e envie");
  };

  const toneLabel: Record<string, string> = {
    formal: "🎩 Formal",
    amigável: "😊 Amigável",
    urgente: "🚨 Urgente",
  };

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="create" className="gap-1.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Send className="h-3.5 w-3.5" /> Novo Disparo
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Clock className="h-3.5 w-3.5" /> Histórico
          </TabsTrigger>
        </TabsList>

        {/* CREATE TAB */}
        <TabsContent value="create" className="space-y-4">
          {/* Step 1: Campaign Name */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-display tracking-wider flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" /> Informações da Campanha
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nome da Campanha</label>
                <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Ex: Aviso de novas funcionalidades" />
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Recipients */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-display tracking-wider flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> Destinatários
                  <Badge variant="outline" className="text-[10px] ml-2">{selectedIds.size} selecionados</Badge>
                </CardTitle>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={selectAll} className="text-[10px] h-7">Selecionar todos</Button>
                  <Button size="sm" variant="ghost" onClick={deselectAll} className="text-[10px] h-7">Limpar</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou telefone..." className="pl-9" />
              </div>

              {loadingUsers ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : (
                <div className="max-h-64 overflow-y-auto border border-border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="w-10"></TableHead>
                        <TableHead className="text-muted-foreground text-xs">Nome</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Telefone</TableHead>
                        <TableHead className="text-muted-foreground text-xs">WhatsApp</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((u) => (
                        <TableRow key={u.user_id} className="border-border cursor-pointer hover:bg-muted/30" onClick={() => u.phone_verified && toggleUser(u.user_id)}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(u.user_id)}
                              disabled={!u.phone_verified}
                              onCheckedChange={() => toggleUser(u.user_id)}
                            />
                          </TableCell>
                          <TableCell className="text-foreground text-xs font-medium">{u.display_name || "—"}</TableCell>
                          <TableCell className="text-foreground text-xs">{u.phone || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] ${u.phone_verified ? "border-green-500/30 text-green-500" : "border-muted-foreground/30 text-muted-foreground"}`}>
                              {u.phone_verified ? "✓ Verificado" : "✗ Não"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredUsers.length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhum usuário encontrado</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 3: AI Content Generator */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-display tracking-wider flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Gerador de Conteúdo IA
              </CardTitle>
              <CardDescription className="text-xs">Descreva o objetivo e a IA gerará variações otimizadas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={aiObjective}
                  onChange={(e) => setAiObjective(e.target.value)}
                  placeholder="Ex: comunicar nova funcionalidade de cronograma de estudos"
                  className="flex-1"
                />
                <Button onClick={generateContent} disabled={aiLoading} className="gap-1.5 shrink-0">
                  {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Gerar
                </Button>
              </div>

              {variations.length > 0 && (
                <div className="grid gap-3">
                  {variations.map((v, i) => (
                    <div key={i} className="border border-border rounded p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-[10px]">{toneLabel[v.tone] || v.tone}</Badge>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">Taxa estimada: {v.estimated_open_rate}%</span>
                          <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => useVariation(v.message)}>
                            <Copy className="h-3 w-3" /> Usar
                          </Button>
                        </div>
                      </div>
                      <div className="bg-muted/30 rounded p-2.5 text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                        {v.message}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 4: Message Editor */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-display tracking-wider flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" /> Mensagem Final
              </CardTitle>
              <CardDescription className="text-xs">Use {"{nome}"} para personalizar. Formatação WhatsApp: *negrito*, _itálico_</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Escreva a mensagem ou use o gerador IA acima..."
                rows={6}
                className="font-mono text-sm"
              />
              <p className="text-[10px] text-muted-foreground">{message.length} caracteres</p>
            </CardContent>
          </Card>

          {/* Step 5: Sending Config */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowConfig(!showConfig)}>
              <CardTitle className="text-sm font-display tracking-wider flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-primary" /> Configuração Anti-Bloqueio
                {showConfig ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
              </CardTitle>
            </CardHeader>
            {showConfig && (
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Delay mínimo (s)</label>
                    <Input type="number" value={minDelay} onChange={(e) => setMinDelay(e.target.value)} min={3} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Delay máximo (s)</label>
                    <Input type="number" value={maxDelay} onChange={(e) => setMaxDelay(e.target.value)} min={5} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Limite/hora</label>
                    <Input type="number" value={hourlyLimit} onChange={(e) => setHourlyLimit(e.target.value)} min={10} />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Intervalo entre mensagens será randomizado entre {minDelay}s e {maxDelay}s com distribuição não-linear para simular comportamento humano.
                </p>
              </CardContent>
            )}
          </Card>

          {/* Send Button */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {selectedIds.size} destinatários · ~{Math.ceil(selectedIds.size * ((Number(minDelay) + Number(maxDelay)) / 2) / 60)} min estimado
            </p>
            <Button onClick={createAndSend} disabled={creating || sending || !message.trim() || selectedIds.size === 0} className="gap-2">
              {creating || sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? "Enviando..." : creating ? "Criando..." : "Criar e Disparar"}
            </Button>
          </div>
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{campaigns.length} campanhas registradas</p>
            <Button size="sm" variant="outline" onClick={fetchCampaigns} className="gap-1.5 text-xs">
              <RotateCcw className="h-3.5 w-3.5" /> Atualizar
            </Button>
          </div>

          {loadingCampaigns ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : campaigns.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-3 opacity-40" />
                <p>Nenhuma campanha registrada ainda</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => {
                const sc = STATUS_CONFIG[c.status] || STATUS_CONFIG.draft;
                const progress = c.total_recipients > 0 ? Math.round(((c.sent_count + c.failed_count) / c.total_recipients) * 100) : 0;
                const Icon = sc.icon;

                return (
                  <Card key={c.id} className="bg-card border-border">
                    <CardContent className="pt-4 pb-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <h3 className="text-sm font-display text-foreground tracking-wider">{c.name}</h3>
                          <Badge variant="outline" className={`text-[10px] ${sc.cls}`}>{sc.label}</Badge>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(c.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {c.total_recipients}</span>
                        <span className="flex items-center gap-1 text-green-500"><CheckCircle2 className="h-3 w-3" /> {c.sent_count}</span>
                        {c.failed_count > 0 && (
                          <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="h-3 w-3" /> {c.failed_count}</span>
                        )}
                      </div>

                      {(c.status === "sending" || c.status === "paused") && (
                        <Progress value={progress} className="h-2" />
                      )}

                      <div className="flex items-center gap-1.5 justify-end">
                        {c.status === "sending" && (
                          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => handleCampaignAction(c.id, "pause")}>
                            <Pause className="h-3 w-3" /> Pausar
                          </Button>
                        )}
                        {c.status === "paused" && (
                          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => handleCampaignAction(c.id, "resume")}>
                            <Play className="h-3 w-3" /> Retomar
                          </Button>
                        )}
                        {(c.status === "sending" || c.status === "paused") && (
                          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 text-destructive" onClick={() => handleCampaignAction(c.id, "cancel")}>
                            <XCircle className="h-3 w-3" /> Cancelar
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1" onClick={() => viewCampaignDetail(c)}>
                          <Eye className="h-3 w-3" /> Detalhes
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1" onClick={() => cloneCampaign(c)}>
                          <Copy className="h-3 w-3" /> Clonar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Campaign Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground font-display tracking-wider flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" /> {detailCampaign?.name}
            </DialogTitle>
          </DialogHeader>

          {detailCampaign && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/30 rounded p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
                  <p className="text-xl font-display text-foreground">{detailCampaign.total_recipients}</p>
                </div>
                <div className="bg-muted/30 rounded p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Enviados</p>
                  <p className="text-xl font-display text-green-500">{detailCampaign.sent_count}</p>
                </div>
                <div className="bg-muted/30 rounded p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Falhas</p>
                  <p className="text-xl font-display text-destructive">{detailCampaign.failed_count}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Mensagem:</p>
                <div className="bg-muted/30 rounded p-3 text-xs text-foreground whitespace-pre-wrap font-mono">{detailCampaign.message}</div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-2">Destinatários ({detailRecipients.length}):</p>
                <div className="max-h-64 overflow-y-auto border border-border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-muted-foreground text-xs">Nome</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Telefone</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Status</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Enviado em</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailRecipients.map((r) => (
                        <TableRow key={r.id} className="border-border">
                          <TableCell className="text-foreground text-xs">{r.display_name || "—"}</TableCell>
                          <TableCell className="text-foreground text-xs">{r.phone}</TableCell>
                          <TableCell>
                            {r.status === "sent" && <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-500">✅ Enviado</Badge>}
                            {r.status === "failed" && (
                              <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive" title={r.error_message}>❌ Falhou</Badge>
                            )}
                            {r.status === "pending" && <Badge variant="outline" className="text-[10px] border-muted-foreground/30 text-muted-foreground">⏳ Pendente</Badge>}
                          </TableCell>
                          <TableCell className="text-foreground text-[10px]">
                            {r.sent_at ? format(new Date(r.sent_at), "dd/MM HH:mm:ss") : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
