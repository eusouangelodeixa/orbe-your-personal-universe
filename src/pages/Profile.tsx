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
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Bell, Phone, Mail, Loader2, Check, Camera, ShieldCheck, Pencil, Send, Coins } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency, SUPPORTED_CURRENCIES } from "@/contexts/CurrencyContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

const profileSchema = z.object({
  display_name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome muito longo"),
});

interface ProfileData {
  id: string;
  user_id: string;
  display_name: string | null;
  phone: string | null;
  phone_verified: boolean;
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

  // Phone verification state
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [savedPhone, setSavedPhone] = useState("");
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [verificationStep, setVerificationStep] = useState<"idle" | "sending" | "code" | "verifying">("idle");
  const [otpCode, setOtpCode] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!user) return;
    loadProfile();
  }, [user]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

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
      const d = data as any;
      setProfile(d);
      setForm({
        display_name: d.display_name || "",
        phone: d.phone || "",
        notifications_enabled: d.notifications_enabled ?? true,
        whatsapp_notifications: d.whatsapp_notifications ?? false,
        email_notifications: d.email_notifications ?? true,
      });
      setPhoneVerified(d.phone_verified ?? false);
      setSavedPhone(d.phone || "");
      setIsEditingPhone(!d.phone);
    } else {
      const { data: newProfile, error: insertErr } = await supabase
        .from("profiles")
        .insert({ user_id: user.id, display_name: user.email?.split("@")[0] || "" } as any)
        .select()
        .single();
      if (!insertErr && newProfile) {
        setProfile(newProfile as any);
        setForm(f => ({ ...f, display_name: (newProfile as any).display_name || "" }));
        setIsEditingPhone(true);
      }
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user || !profile) return;

    const result = profileSchema.safeParse({ display_name: form.display_name });
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

  const handleSendCode = async () => {
    if (!form.phone || form.phone.length < 10) {
      toast.error("Informe um número de telefone válido");
      return;
    }

    setVerificationStep("sending");
    try {
      const { data, error } = await supabase.functions.invoke("verify-phone", {
        body: { action: "send", phone: form.phone },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setVerificationStep("code");
      setOtpCode("");
      setCooldown(60);
      toast.success("Código enviado para seu WhatsApp!");
    } catch (err: any) {
      console.error("Send code error:", err);
      toast.error(err.message || "Erro ao enviar código");
      setVerificationStep("idle");
    }
  };

  const handleVerifyCode = async () => {
    if (otpCode.length !== 6) {
      toast.error("Digite o código de 6 dígitos");
      return;
    }

    setVerificationStep("verifying");
    try {
      const { data, error } = await supabase.functions.invoke("verify-phone", {
        body: { action: "verify", phone: form.phone, code: otpCode },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setPhoneVerified(true);
      setSavedPhone(form.phone);
      setIsEditingPhone(false);
      setVerificationStep("idle");
      setOtpCode("");
      toast.success("Telefone verificado com sucesso! ✅");
      loadProfile();
    } catch (err: any) {
      console.error("Verify code error:", err);
      toast.error(err.message || "Código inválido ou expirado");
      setVerificationStep("code");
    }
  };

  const handleChangePhone = () => {
    setIsEditingPhone(true);
    setPhoneVerified(false);
    setVerificationStep("idle");
    setOtpCode("");
  };

  const handleCancelEdit = () => {
    setForm(f => ({ ...f, phone: savedPhone }));
    setIsEditingPhone(false);
    setPhoneVerified(profile?.phone_verified ?? false);
    setVerificationStep("idle");
    setOtpCode("");
  };

  const phoneChanged = form.phone !== savedPhone;

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

            {/* Phone with verification */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="phone">Telefone (WhatsApp)</Label>
                {phoneVerified && !isEditingPhone && (
                  <Badge variant="default" className="gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    Verificado
                  </Badge>
                )}
              </div>

              {/* Verified phone display */}
              {!isEditingPhone && savedPhone ? (
                <div className="flex items-center gap-3">
                  <div className="flex-1 flex items-center gap-2 rounded-md border bg-muted px-3 py-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{savedPhone}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleChangePhone} className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" />
                    Trocar
                  </Button>
                </div>
              ) : (
                <>
                  {/* Phone input */}
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <PhoneInput
                        id="phone"
                        value={form.phone}
                        onChange={(phone) => {
                          setForm(f => ({ ...f, phone }));
                          // Reset verification when number changes
                          if (verificationStep === "code") {
                            setVerificationStep("idle");
                            setOtpCode("");
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Action buttons for phone */}
                  {verificationStep === "idle" && (
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSendCode}
                        disabled={!form.phone || form.phone.length < 10}
                        size="sm"
                        className="gap-1.5"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Enviar código de verificação
                      </Button>
                      {savedPhone && (
                        <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                          Cancelar
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Sending state */}
                  {verificationStep === "sending" && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando código via WhatsApp...
                    </div>
                  )}

                  {/* OTP input */}
                  {(verificationStep === "code" || verificationStep === "verifying") && (
                    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                      <p className="text-sm font-medium">
                        📱 Código enviado para <strong>{form.phone}</strong>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Digite o código de 6 dígitos recebido no WhatsApp
                      </p>

                      <div className="flex justify-center py-2">
                        <InputOTP
                          maxLength={6}
                          value={otpCode}
                          onChange={setOtpCode}
                          disabled={verificationStep === "verifying"}
                        >
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>

                      <div className="flex items-center justify-between">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleSendCode}
                          disabled={cooldown > 0 || verificationStep === "verifying"}
                        >
                          {cooldown > 0 ? `Reenviar em ${cooldown}s` : "Reenviar código"}
                        </Button>

                        <Button
                          onClick={handleVerifyCode}
                          disabled={otpCode.length !== 6 || verificationStep === "verifying"}
                          size="sm"
                          className="gap-1.5"
                        >
                          {verificationStep === "verifying" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ShieldCheck className="h-3.5 w-3.5" />
                          )}
                          Verificar
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}

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
                {!phoneVerified && (
                  <Badge variant="outline" className="text-xs">
                    {savedPhone ? "Verificação pendente" : "Adicione seu telefone"}
                  </Badge>
                )}
                <Switch
                  checked={form.whatsapp_notifications}
                  onCheckedChange={v => setForm(f => ({ ...f, whatsapp_notifications: v }))}
                  disabled={!phoneVerified}
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
