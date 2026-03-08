import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/PhoneInput";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Bell, Phone, Mail, Loader2, Check, Camera } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

const profileSchema = z.object({
  display_name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome muito longo"),
  phone: z.string().regex(/^(\+\d{10,15})?$/, "Telefone inválido").optional().or(z.literal("")),
});

interface ProfileData {
  id: string;
  user_id: string;
  display_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  notifications_enabled: boolean;
  whatsapp_notifications: boolean;
  email_notifications: boolean;
}

export default function Profile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [form, setForm] = useState({
    display_name: "",
    phone: "",
    notifications_enabled: true,
    whatsapp_notifications: false,
    email_notifications: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      toast.error("Erro ao carregar perfil");
      setLoading(false);
      return;
    }

    if (data) {
      setProfile(data as any);
      setForm({
        display_name: (data as any).display_name || "",
        phone: (data as any).phone || "",
        notifications_enabled: (data as any).notifications_enabled ?? true,
        whatsapp_notifications: (data as any).whatsapp_notifications ?? false,
        email_notifications: (data as any).email_notifications ?? true,
      });
    } else {
      // Profile doesn't exist yet — create it
      const { data: newProfile, error: insertErr } = await supabase
        .from("profiles")
        .insert({ user_id: user.id, display_name: user.email?.split("@")[0] || "" } as any)
        .select()
        .single();
      if (!insertErr && newProfile) {
        setProfile(newProfile as any);
        setForm(f => ({ ...f, display_name: (newProfile as any).display_name || "" }));
      }
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user || !profile) return;

    // Validate
    const result = profileSchema.safeParse({
      display_name: form.display_name,
      phone: form.phone,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: form.display_name || null,
        phone: form.phone || null,
        notifications_enabled: form.notifications_enabled,
        whatsapp_notifications: form.whatsapp_notifications,
        email_notifications: form.email_notifications,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", profile.id);

    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar perfil");
    } else {
      toast.success("Perfil atualizado!");
      loadProfile();
    }
  };

  const initials = form.display_name
    ? form.display_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() || "?";

  if (loading) {
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
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-display">Perfil</h1>
          <p className="text-muted-foreground">Configurações gerais da sua conta</p>
        </div>

        {/* Avatar & Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informações Pessoais
            </CardTitle>
            <CardDescription>Dados usados em todos os módulos do ORBE</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="text-xl bg-primary/10 text-primary">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{form.display_name || "Seu nome"}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            <Separator />

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="display_name">Nome de exibição</Label>
              <Input
                id="display_name"
                value={form.display_name}
                onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                placeholder="Como você quer ser chamado"
              />
              {errors.display_name && <p className="text-xs text-destructive">{errors.display_name}</p>}
            </div>

            {/* Email (read-only) */}
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ""} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">O email não pode ser alterado</p>
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone (WhatsApp)</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+5511999999999"
              />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
              <p className="text-xs text-muted-foreground">
                Usado para receber lembretes via WhatsApp (provas, contas a vencer, etc.)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificações
            </CardTitle>
            <CardDescription>Configure como deseja receber alertas e lembretes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Notificações ativadas</Label>
                <p className="text-xs text-muted-foreground">Receber alertas no app</p>
              </div>
              <Switch
                checked={form.notifications_enabled}
                onCheckedChange={v => setForm(f => ({ ...f, notifications_enabled: v }))}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5 flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label>WhatsApp</Label>
                  <p className="text-xs text-muted-foreground">Lembretes via WhatsApp</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!form.phone && <Badge variant="outline" className="text-xs">Adicione seu telefone</Badge>}
                <Switch
                  checked={form.whatsapp_notifications}
                  onCheckedChange={v => setForm(f => ({ ...f, whatsapp_notifications: v }))}
                  disabled={!form.phone}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5 flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label>Email</Label>
                  <p className="text-xs text-muted-foreground">Resumos e alertas por email</p>
                </div>
              </div>
              <Switch
                checked={form.email_notifications}
                onCheckedChange={v => setForm(f => ({ ...f, email_notifications: v }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">
              💡 Essas configurações são globais e afetam todos os módulos: <strong>Financeiro</strong>, <strong>Estudos</strong>, <strong>Fit</strong> e <strong>Tarefas</strong>.
              Configurações específicas de cada módulo são feitas dentro do próprio módulo.
            </p>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            Salvar alterações
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
