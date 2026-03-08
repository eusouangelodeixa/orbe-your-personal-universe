import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const UAZAPI_URL = Deno.env.get("UAZAPI_URL");
    const UAZAPI_TOKEN = Deno.env.get("UAZAPI_TOKEN");

    if (!UAZAPI_URL) throw new Error("UAZAPI_URL não configurada");
    if (!UAZAPI_TOKEN) throw new Error("UAZAPI_TOKEN não configurado");

    const body = await req.json();

    // Debug mode: check instance status
    if (body.debug === true) {
      const statusRes = await fetch(`${UAZAPI_URL}/instance/status`, {
        method: "GET",
        headers: { "token": UAZAPI_TOKEN },
      });
      const statusData = await statusRes.json();
      return new Response(JSON.stringify({ status: statusRes.status, data: statusData }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { phone, message } = body;

    if (!phone || !message) {
      return new Response(JSON.stringify({ error: "phone e message são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // uazapi v2: POST /message/sendText with header 'token'
    const response = await fetch(`${UAZAPI_URL}/message/sendText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "token": UAZAPI_TOKEN,
      },
      body: JSON.stringify({
        number: phone,
        text: message,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("uazapi error:", response.status, JSON.stringify(data));
      throw new Error(`uazapi error [${response.status}]: ${JSON.stringify(data)}`);
    }

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("whatsapp-alert error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
