import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Verify internal/admin access
    const authHeader = req.headers.get("authorization");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const UAZAPI_URL = Deno.env.get("UAZAPI_URL")!;
    const UAZAPI_TOKEN = Deno.env.get("UAZAPI_TOKEN")!;

    const supabase = createClient(supabaseUrl, serviceKey);

    const { message } = await req.json();
    if (!message) {
      return new Response(JSON.stringify({ error: "message é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all users with verified phones
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("phone, display_name")
      .eq("phone_verified", true)
      .not("phone", "is", null);

    if (error) throw error;

    console.log(`Found ${profiles?.length || 0} verified users to notify`);

    const results = { sent: 0, failed: 0, errors: [] as string[] };

    for (const profile of (profiles || [])) {
      try {
        const response = await fetch(`${UAZAPI_URL}/send/text`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "token": UAZAPI_TOKEN,
          },
          body: JSON.stringify({
            number: profile.phone,
            text: message,
          }),
        });

        if (response.ok) {
          results.sent++;
          console.log(`✅ Sent to ${profile.display_name || profile.phone}`);
        } else {
          results.failed++;
          const err = await response.text();
          results.errors.push(`${profile.phone}: ${err}`);
          console.error(`❌ Failed for ${profile.phone}: ${err}`);
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        results.failed++;
        results.errors.push(`${profile.phone}: ${e instanceof Error ? e.message : "unknown"}`);
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("broadcast error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
