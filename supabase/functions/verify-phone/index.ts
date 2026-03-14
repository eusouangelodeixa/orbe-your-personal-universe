import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Não autorizado" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("[verify-phone] Missing SUPABASE_URL or SUPABASE_ANON_KEY");
      return jsonResponse({ error: "Erro de configuração do servidor" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      console.error("[verify-phone] Auth error:", claimsErr?.message);
      return jsonResponse({ error: "Token inválido" }, 401);
    }
    const userId = claims.claims.sub as string;

    let body: { action?: string; phone?: string; code?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Body JSON inválido" }, 400);
    }

    const { action, phone, code } = body;
    console.log(`[verify-phone] action=${action}, phone=${phone ? phone.substring(0, 5) + "***" : "none"}, userId=${userId}`);

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceKey) {
      console.error("[verify-phone] Missing SUPABASE_SERVICE_ROLE_KEY");
      return jsonResponse({ error: "Erro de configuração do servidor" }, 500);
    }
    const adminClient = createClient(supabaseUrl, serviceKey);

    if (action === "send") {
      if (!phone) {
        return jsonResponse({ error: "Telefone é obrigatório" }, 400);
      }

      const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

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
        console.error("[verify-phone] Insert error:", JSON.stringify(insertErr));
        return jsonResponse({ error: "Erro ao gerar código de verificação" }, 500);
      }

      // Send code via WhatsApp
      const UAZAPI_URL = Deno.env.get("UAZAPI_URL");
      const UAZAPI_TOKEN = Deno.env.get("UAZAPI_TOKEN");

      if (!UAZAPI_URL || !UAZAPI_TOKEN) {
        console.error("[verify-phone] Missing UAZAPI_URL or UAZAPI_TOKEN");
        return jsonResponse({ error: "Configuração do WhatsApp não encontrada" }, 500);
      }

      // Clean the phone number: remove +, spaces, dashes
      const phoneNumber = phone.replace(/[^0-9]/g, "");
      console.log(`[verify-phone] Sending WhatsApp to: ${phoneNumber}`);

      try {
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

        const whatsappText = await whatsappRes.text();
        console.log(`[verify-phone] WhatsApp API response status: ${whatsappRes.status}, body: ${whatsappText.substring(0, 500)}`);

        if (!whatsappRes.ok) {
          console.error(`[verify-phone] WhatsApp API error: ${whatsappRes.status} - ${whatsappText}`);
          return jsonResponse({ error: "Erro ao enviar código via WhatsApp. Verifique se o número está correto e tem WhatsApp." }, 500);
        }
      } catch (fetchErr) {
        console.error("[verify-phone] WhatsApp fetch error:", fetchErr instanceof Error ? fetchErr.message : String(fetchErr));
        return jsonResponse({ error: "Erro de conexão ao enviar WhatsApp. Tente novamente." }, 500);
      }

      return jsonResponse({ success: true, message: "Código enviado via WhatsApp" });
    }

    if (action === "verify") {
      if (!code || !phone) {
        return jsonResponse({ error: "Código e telefone são obrigatórios" }, 400);
      }

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
        console.log("[verify-phone] Verification failed:", fetchErr?.message || "Code not found/expired");
        return jsonResponse({ error: "Código inválido ou expirado" }, 400);
      }

      // Mark as verified
      const { error: markErr } = await adminClient
        .from("phone_verifications")
        .update({ verified: true })
        .eq("id", verification.id);
      
      if (markErr) {
        console.error("[verify-phone] Error marking verification:", JSON.stringify(markErr));
      }

      // Update profile: set phone and phone_verified
      const { data: updatedRows, error: profileErr } = await adminClient
        .from("profiles")
        .update({ phone, phone_verified: true, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .select("id, user_id, phone_verified");

      if (profileErr) {
        console.error("[verify-phone] Error updating profile:", JSON.stringify(profileErr));
        return jsonResponse({ error: "Telefone verificado mas erro ao atualizar perfil. Tente recarregar." }, 500);
      }
      
      if (!updatedRows || updatedRows.length === 0) {
        console.error(`[verify-phone] Profile update matched 0 rows for user ${userId}. Creating profile.`);
        // Profile might not exist yet - create it
        const { error: insertErr } = await adminClient
          .from("profiles")
          .insert({ user_id: userId, phone, phone_verified: true });
        if (insertErr) {
          console.error("[verify-phone] Profile insert error:", JSON.stringify(insertErr));
          return jsonResponse({ error: "Erro ao criar perfil com telefone verificado." }, 500);
        }
        console.log(`[verify-phone] Created profile for user ${userId} with phone_verified=true`);
      } else {
        console.log(`[verify-phone] Profile updated for user ${userId}, rows=${updatedRows.length}, phone_verified=${updatedRows[0]?.phone_verified}`);

      return jsonResponse({ success: true, message: "Telefone verificado com sucesso!" });
    }

    return jsonResponse({ error: "Ação inválida. Use 'send' ou 'verify'" }, 400);
  } catch (e) {
    console.error("[verify-phone] Unhandled error:", e instanceof Error ? e.stack || e.message : String(e));
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});
