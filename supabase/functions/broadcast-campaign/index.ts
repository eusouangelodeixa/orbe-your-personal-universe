import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Verify admin
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "send";
    const body = await req.json().catch(() => ({}));

    // ACTION: generate-content - AI content generation
    if (action === "generate-content") {
      const { objective } = body;
      if (!objective) return jsonResp({ error: "objective é obrigatório" }, 400);

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) return jsonResp({ error: "LOVABLE_API_KEY não configurada" }, 500);

      const systemPrompt = `Você é um copywriter especialista em mensagens de WhatsApp para engajamento de usuários de uma plataforma chamada ORBE (gestão financeira, estudos e fitness).

Regras:
- Use emojis estratégicos para aumentar taxa de leitura
- Mantenha mensagens curtas (máx 500 caracteres cada)
- Inclua chamada para ação clara
- Use formatação WhatsApp: *negrito*, _itálico_, ~tachado~
- Nunca use links genéricos, use "apporbe.lovable.app"
- Personalize com {nome} como placeholder

Retorne EXATAMENTE um JSON com esta estrutura:
{
  "variations": [
    { "tone": "formal", "message": "...", "estimated_open_rate": 65 },
    { "tone": "amigável", "message": "...", "estimated_open_rate": 78 },
    { "tone": "urgente", "message": "...", "estimated_open_rate": 72 }
  ]
}`;

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Objetivo do aviso: ${objective}` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "generate_variations",
              description: "Generate message variations for WhatsApp broadcast",
              parameters: {
                type: "object",
                properties: {
                  variations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        tone: { type: "string" },
                        message: { type: "string" },
                        estimated_open_rate: { type: "number" },
                      },
                      required: ["tone", "message", "estimated_open_rate"],
                    },
                  },
                },
                required: ["variations"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "generate_variations" } },
        }),
      });

      if (!aiResp.ok) {
        const errText = await aiResp.text();
        console.error("AI error:", aiResp.status, errText);
        return jsonResp({ error: "Erro ao gerar conteúdo com IA" }, 500);
      }

      const aiData = await aiResp.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const parsed = JSON.parse(toolCall.function.arguments);
        return jsonResp({ variations: parsed.variations });
      }

      return jsonResp({ error: "Resposta inesperada da IA" }, 500);
    }

    // ACTION: create - Create campaign with recipients
    if (action === "create") {
      const { name, message, recipient_ids, sending_config, scheduled_at } = body;
      if (!name || !message || !recipient_ids?.length) {
        return jsonResp({ error: "name, message e recipient_ids são obrigatórios" }, 400);
      }

      // Get recipient details
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, phone, display_name")
        .in("user_id", recipient_ids)
        .eq("phone_verified", true)
        .not("phone", "is", null);

      if (!profiles?.length) return jsonResp({ error: "Nenhum destinatário com telefone verificado" }, 400);

      const status = scheduled_at ? "scheduled" : "draft";
      const { data: campaign, error: campErr } = await supabase
        .from("broadcast_campaigns")
        .insert({
          name,
          message,
          status,
          scheduled_at: scheduled_at || null,
          sending_config: sending_config || { min_delay: 8, max_delay: 45, hourly_limit: 80 },
          total_recipients: profiles.length,
        })
        .select()
        .single();

      if (campErr) throw campErr;

      const recipients = profiles.map((p: any) => ({
        campaign_id: campaign.id,
        user_id: p.user_id,
        phone: p.phone,
        display_name: p.display_name,
      }));

      const { error: recErr } = await supabase.from("broadcast_recipients").insert(recipients);
      if (recErr) throw recErr;

      return jsonResp({ campaign, recipients_count: profiles.length });
    }

    // ACTION: send - Execute campaign sending
    if (action === "send") {
      const { campaign_id } = body;
      if (!campaign_id) return jsonResp({ error: "campaign_id é obrigatório" }, 400);

      const UAZAPI_URL = Deno.env.get("UAZAPI_URL")!;
      const UAZAPI_TOKEN = Deno.env.get("UAZAPI_TOKEN")!;

      const { data: campaign } = await supabase
        .from("broadcast_campaigns")
        .select("*")
        .eq("id", campaign_id)
        .single();

      if (!campaign) return jsonResp({ error: "Campanha não encontrada" }, 404);

      // Mark as sending
      await supabase.from("broadcast_campaigns").update({ status: "sending", updated_at: new Date().toISOString() }).eq("id", campaign_id);

      const config = campaign.sending_config as any;
      const minDelay = config?.min_delay || 8;
      const maxDelay = config?.max_delay || 45;

      const { data: recipients } = await supabase
        .from("broadcast_recipients")
        .select("*")
        .eq("campaign_id", campaign_id)
        .eq("status", "pending")
        .order("created_at");

      let sentCount = campaign.sent_count || 0;
      let failedCount = campaign.failed_count || 0;

      for (const recipient of (recipients || [])) {
        // Check if campaign was paused/canceled
        const { data: currentCampaign } = await supabase
          .from("broadcast_campaigns")
          .select("status")
          .eq("id", campaign_id)
          .single();

        if (currentCampaign?.status === "paused" || currentCampaign?.status === "canceled") {
          console.log(`Campaign ${campaign_id} was ${currentCampaign.status}, stopping.`);
          break;
        }

        // Personalize message
        const personalizedMsg = campaign.message.replace(/\{nome\}/gi, recipient.display_name || "");

        try {
          const response = await fetch(`${UAZAPI_URL}/send/text`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "token": UAZAPI_TOKEN },
            body: JSON.stringify({ number: recipient.phone, text: personalizedMsg }),
          });

          if (response.ok) {
            sentCount++;
            await supabase.from("broadcast_recipients").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", recipient.id);
            console.log(`✅ Sent to ${recipient.display_name || recipient.phone}`);
          } else {
            failedCount++;
            const err = await response.text();
            await supabase.from("broadcast_recipients").update({ status: "failed", error_message: err.slice(0, 500) }).eq("id", recipient.id);
            console.error(`❌ Failed: ${recipient.phone}: ${err}`);
          }
        } catch (e) {
          failedCount++;
          const errMsg = e instanceof Error ? e.message : "unknown";
          await supabase.from("broadcast_recipients").update({ status: "failed", error_message: errMsg }).eq("id", recipient.id);
        }

        // Update campaign counts
        await supabase.from("broadcast_campaigns").update({ sent_count: sentCount, failed_count: failedCount, updated_at: new Date().toISOString() }).eq("id", campaign_id);

        // Randomized delay with non-linear distribution (bias toward longer delays)
        const random = Math.pow(Math.random(), 0.7); // skew toward higher values
        const delay = Math.floor(minDelay + random * (maxDelay - minDelay));
        await new Promise(r => setTimeout(r, delay * 1000));
      }

      // Mark completed
      const finalStatus = sentCount + failedCount >= (campaign.total_recipients || 0) ? "completed" : "paused";
      await supabase.from("broadcast_campaigns").update({
        status: finalStatus,
        sent_count: sentCount,
        failed_count: failedCount,
        completed_at: finalStatus === "completed" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq("id", campaign_id);

      return jsonResp({ success: true, sent: sentCount, failed: failedCount });
    }

    // ACTION: pause/resume/cancel
    if (["pause", "resume", "cancel"].includes(action)) {
      const { campaign_id } = body;
      const statusMap: Record<string, string> = { pause: "paused", resume: "sending", cancel: "canceled" };
      await supabase.from("broadcast_campaigns").update({ status: statusMap[action], updated_at: new Date().toISOString() }).eq("id", campaign_id);
      return jsonResp({ success: true, status: statusMap[action] });
    }

    // ACTION: list - Get campaigns
    if (action === "list") {
      const { data: campaigns } = await supabase
        .from("broadcast_campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return jsonResp({ campaigns });
    }

    // ACTION: recipients - Get campaign recipients
    if (action === "recipients") {
      const { campaign_id } = body;
      const { data: recs } = await supabase
        .from("broadcast_recipients")
        .select("*")
        .eq("campaign_id", campaign_id)
        .order("sent_at", { ascending: false });
      return jsonResp({ recipients: recs });
    }

    // ACTION: users - Get all users with verified phones
    if (action === "users") {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, phone, display_name, phone_verified, created_at")
        .not("phone", "is", null)
        .order("created_at", { ascending: false });
      return jsonResp({ users: profiles });
    }

    return jsonResp({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("broadcast-campaign error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  function jsonResp(data: any, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
