import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendWhatsApp(phone: string, message: string) {
  const UAZAPI_URL = Deno.env.get("UAZAPI_URL");
  const UAZAPI_TOKEN = Deno.env.get("UAZAPI_TOKEN");
  if (!UAZAPI_URL || !UAZAPI_TOKEN) {
    console.log("[LOJOU-WEBHOOK] WhatsApp not configured, skipping");
    return;
  }
  try {
    const res = await fetch(`${UAZAPI_URL}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "token": UAZAPI_TOKEN },
      body: JSON.stringify({ number: phone, text: message }),
    });
    const data = await res.json();
    console.log("[LOJOU-WEBHOOK] WhatsApp sent:", res.status, JSON.stringify(data));
  } catch (e) {
    console.error("[LOJOU-WEBHOOK] WhatsApp send error:", e);
  }
}

function mapLojouPlan(planName: string): string | null {
  const n = (planName || "").toLowerCase().trim();
  if (n.includes("basic")) return "basic";
  if (n.includes("student") || n.includes("estudante")) return "student";
  if (n.includes("full") || n.includes("completo")) return "full";
  if (n.includes("fit")) return "fit";
  return null;
}

function mapLojouPeriod(planType: string, planName?: string): string {
  const t = (planType || "").toLowerCase();
  const n = (planName || "").toLowerCase();
  if (t.includes("year") || t.includes("anual") || t.includes("yearly") || n.includes("anual")) return "anual";
  if (t.includes("quarter") || t.includes("trimest") || n.includes("trimestral")) return "trimestral";
  return "mensal";
}

async function scheduleRenewalReminders(
  supabase: any,
  subscriptionId: string,
  userId: string,
  phone: string,
  customerName: string,
  planName: string,
  endsAt: string
) {
  const endDate = new Date(endsAt);
  const reminders = [3, 2, 1, 0]; // days before expiry

  for (const daysBefore of reminders) {
    const sendDate = new Date(endDate);
    sendDate.setDate(sendDate.getDate() - daysBefore);
    const sendDateStr = sendDate.toISOString().split("T")[0];

    await supabase.from("subscription_reminders").insert({
      subscription_id: subscriptionId,
      user_id: userId,
      phone,
      customer_name: customerName,
      plan_name: planName,
      days_before: daysBefore,
      send_date: sendDateStr,
    });
  }

  console.log("[LOJOU-WEBHOOK] Scheduled 4 renewal reminders for:", phone, "plan:", planName);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const payload = await req.json();
    console.log("[LOJOU-WEBHOOK] Received:", JSON.stringify(payload));

    const orderType = payload.order_type;
    const status = payload.status;
    const customerEmail = payload.customer?.email?.toLowerCase()?.trim();
    const customerName = payload.customer?.name || "";
    const customerPhone = payload.customer?.mobile_number || "";
    const planSub = payload.plan_subscriber;
    const planDisplayName = planSub?.plan_name || "";

    if (!customerEmail) {
      console.log("[LOJOU-WEBHOOK] No customer email");
      return new Response(JSON.stringify({ ok: true, skipped: "no_email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For cancelled/abandoned orders, send WhatsApp even if user not in system
    if (orderType === "order_cancelled" || status === "cancelled") {
      if (customerPhone) {
        const firstName = customerName.split(" ")[0] || "Olá";
        const msg = `Olá ${firstName}! 👋\n\nVimos que você tentou assinar o plano "${planDisplayName}" do *Orbe* mas infelizmente não chegou a concluir o pagamento.\n\nTente mais uma vez pelo link: https://pay.lojou.app/p/iGdxz\n\nQualquer dúvida estamos por aqui! 💜`;
        await sendWhatsApp(customerPhone, msg);
        console.log("[LOJOU-WEBHOOK] Abandonment WhatsApp sent to:", customerPhone);
      }

      // Find user to cancel subscription if exists
      const { data: users } = await supabase.auth.admin.listUsers();
      const user = users?.users?.find((u: any) => u.email?.toLowerCase() === customerEmail);
      if (user) {
        await supabase
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("user_id", user.id)
          .eq("provider", "lojou")
          .eq("status", "active");
      }

      return new Response(JSON.stringify({ ok: true, action: "order_cancelled_notified" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find user by email
    const { data: users, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) throw new Error(`listUsers error: ${listErr.message}`);

    const user = users.users.find(
      (u: any) => u.email?.toLowerCase() === customerEmail
    );

    if (!user) {
      console.log("[LOJOU-WEBHOOK] User not found for email:", customerEmail);
      return new Response(JSON.stringify({ ok: true, skipped: "user_not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // Handle approved orders
    if (
      (orderType === "order_approved" || orderType === "subscription_active") &&
      status === "approved" &&
      planSub
    ) {
      const plan = mapLojouPlan(planSub.plan_name);
      const period = mapLojouPeriod(planSub.plan_type, planSub.plan_name);

      if (!plan) {
        console.log("[LOJOU-WEBHOOK] Could not map plan:", planSub.plan_name);
        return new Response(JSON.stringify({ ok: true, skipped: "unknown_plan" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const endsAt = planSub.end_date
        ? new Date(planSub.end_date).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const startsAt = planSub.start_date
        ? new Date(planSub.start_date).toISOString()
        : new Date().toISOString();

      // Deactivate old subs
      await supabase
        .from("subscriptions")
        .update({ status: "inactive" })
        .eq("user_id", userId)
        .eq("provider", "lojou");

      const { data: insertedSub, error: insertErr } = await supabase
        .from("subscriptions")
        .insert({
          user_id: userId,
          provider: "lojou",
          plan,
          plan_period: period,
          status: "active",
          starts_at: startsAt,
          ends_at: endsAt,
          order_number: payload.order_number || null,
          transaction_id: payload.transaction_id || null,
          portal_url: planSub.portal_url || null,
          raw_payload: payload,
        })
        .select("id")
        .single();

      if (insertErr) {
        console.error("[LOJOU-WEBHOOK] Insert error:", insertErr);
        throw new Error(insertErr.message);
      }

      // Set currency to MZN
      await supabase
        .from("profiles")
        .update({ currency: "MZN" })
        .eq("user_id", userId);

      // Schedule renewal reminders (3, 2, 1, 0 days before expiry)
      if (customerPhone && insertedSub?.id) {
        await scheduleRenewalReminders(
          supabase,
          insertedSub.id,
          userId,
          customerPhone,
          customerName,
          planDisplayName,
          endsAt
        );
      }

      // Send congratulations WhatsApp
      if (customerPhone) {
        const firstName = customerName.split(" ")[0] || "Olá";
        const msg = `Parabéns ${firstName}! 🎉🚀\n\nSua assinatura do plano *${planDisplayName}* do *Orbe* foi ativada com sucesso!\n\nAgora você tem acesso completo a todas as funcionalidades do seu plano. Aproveite ao máximo! 💜\n\nAcesse: https://orbe.lovable.app`;
        await sendWhatsApp(customerPhone, msg);
        console.log("[LOJOU-WEBHOOK] Congratulations WhatsApp sent to:", customerPhone);
      }

      console.log("[LOJOU-WEBHOOK] Subscription activated:", { userId, plan, period, endsAt });

      return new Response(JSON.stringify({ ok: true, action: "subscription_activated", plan, period }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle subscription cancellation
    if (
      orderType === "subscription_canceled" ||
      (planSub && planSub.cancelled_at)
    ) {
      await supabase
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("user_id", userId)
        .eq("provider", "lojou")
        .eq("status", "active");

      console.log("[LOJOU-WEBHOOK] Subscription canceled for:", userId);

      return new Response(JSON.stringify({ ok: true, action: "subscription_canceled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[LOJOU-WEBHOOK] Unhandled event:", orderType, status);
    return new Response(JSON.stringify({ ok: true, skipped: "unhandled_event" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[LOJOU-WEBHOOK] ERROR:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});