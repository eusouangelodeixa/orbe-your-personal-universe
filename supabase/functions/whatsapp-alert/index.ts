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

    // Debug: try multiple endpoints
    if (body.debug === true) {
      const endpoints = [
        "/message/sendText",
        "/message/send-text",
        "/message/text",
        "/sendText",
        "/send-text",
        "/send/text",
        "/chat/sendText",
      ];
      
      const results: Record<string, any> = {};
      
      for (const ep of endpoints) {
        try {
          const res = await fetch(`${UAZAPI_URL}${ep}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "token": UAZAPI_TOKEN,
            },
            body: JSON.stringify({
              number: "553498925759",
              text: "teste endpoint",
            }),
          });
          const data = await res.json();
          results[ep] = { status: res.status, data };
          // If we get a success, stop trying
          if (res.ok) break;
        } catch (err) {
          results[ep] = { error: String(err) };
        }
      }
      
      return new Response(JSON.stringify(results), {
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
