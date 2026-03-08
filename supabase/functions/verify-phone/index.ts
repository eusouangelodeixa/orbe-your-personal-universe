import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const { action, phone, code } = await req.json();

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    if (action === "send") {
      // Generate 6-digit code
      if (!phone) {
        return new Response(JSON.stringify({ error: "Telefone é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

      // Invalidate previous codes for this user
      await adminClient
        .from("phone_verifications")
        .delete()
        .eq("user_id", userId)
        .eq("verified", false);

      // Store the code
      const { error: insertErr } = await adminClient
        .from("phone_verifications")
        .insert({
          user_id: userId,
          phone,
          code: verificationCode,
          expires_at: expiresAt,
        });

      if (insertErr) {
        console.error("Insert error:", insertErr);
        throw new Error("Erro ao gerar código de verificação");
      }

      // Send code via WhatsApp
      const UAZAPI_URL = Deno.env.get("UAZAPI_URL");
      const UAZAPI_TOKEN = Deno.env.get("UAZAPI_TOKEN");

      if (!UAZAPI_URL || !UAZAPI_TOKEN) {
        throw new Error("Configuração do WhatsApp não encontrada");
      }

      const phoneNumber = phone.replace("+", "");
      const whatsappRes = await fetch(`${UAZAPI_URL}/send/text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "token": UAZAPI_TOKEN,
        },
        body: JSON.stringify({
          number: phoneNumber,
          text: `🔐 *ORBE - Verificação de Telefone*\n\nSeu código de verificação é: *${verificationCode}*\n\nEste código expira em 10 minutos.\n\n⚠️ Não compartilhe este código com ninguém.`,
        }),
      });

      const whatsappData = await whatsappRes.json();
      if (!whatsappRes.ok) {
        console.error("WhatsApp send error:", whatsappRes.status, JSON.stringify(whatsappData));
        throw new Error("Erro ao enviar código via WhatsApp");
      }

      return new Response(JSON.stringify({ success: true, message: "Código enviado via WhatsApp" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify") {
      if (!code || !phone) {
        return new Response(JSON.stringify({ error: "Código e telefone são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check code
      const { data: verification, error: fetchErr } = await adminClient
        .from("phone_verifications")
        .select("*")
        .eq("user_id", userId)
        .eq("phone", phone)
        .eq("code", code)
        .eq("verified", false)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchErr || !verification) {
        return new Response(JSON.stringify({ error: "Código inválido ou expirado" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mark as verified
      await adminClient
        .from("phone_verifications")
        .update({ verified: true })
        .eq("id", verification.id);

      // Update profile: set phone and phone_verified
      await adminClient
        .from("profiles")
        .update({ phone, phone_verified: true, updated_at: new Date().toISOString() })
        .eq("user_id", userId);

      return new Response(JSON.stringify({ success: true, message: "Telefone verificado com sucesso!" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida. Use 'send' ou 'verify'" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("verify-phone error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
