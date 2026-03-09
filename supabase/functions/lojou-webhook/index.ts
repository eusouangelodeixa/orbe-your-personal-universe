import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map Lojou plan names to ORBE plan keys
function mapLojouPlan(planName: string): string | null {
  const n = (planName || "").toLowerCase().trim();
  if (n.includes("basic")) return "basic";
  if (n.includes("student") || n.includes("estudante")) return "student";
  if (n.includes("full") || n.includes("completo")) return "full";
  if (n.includes("fit")) return "fit";
  return null;
}

function mapLojouPeriod(planType: string): string {
  const t = (planType || "").toLowerCase();
  if (t.includes("year") || t.includes("anual") || t.includes("yearly")) return "anual";
  if (t.includes("quarter") || t.includes("trimest")) return "trimestral";
  return "mensal";
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
    const planSub = payload.plan_subscriber;

    if (!customerEmail) {
      console.log("[LOJOU-WEBHOOK] No customer email");
      return new Response(JSON.stringify({ ok: true, skipped: "no_email" }), {
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

    // Handle approved orders and subscription events
    if (
      (orderType === "order_approved" || orderType === "subscription_active") &&
      status === "approved" &&
      planSub
    ) {
      const plan = mapLojouPlan(planSub.plan_name);
      const period = mapLojouPeriod(planSub.plan_type);

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

      // Upsert subscription — deactivate old ones first
      await supabase
        .from("subscriptions")
        .update({ status: "inactive" })
        .eq("user_id", userId)
        .eq("provider", "lojou");

      const { error: insertErr } = await supabase
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
        });

      if (insertErr) {
        console.error("[LOJOU-WEBHOOK] Insert error:", insertErr);
        throw new Error(insertErr.message);
      }

      // Set user currency to MZN
      await supabase
        .from("profiles")
        .update({ currency: "MZN" })
        .eq("user_id", userId);

      console.log("[LOJOU-WEBHOOK] Subscription activated:", { userId, plan, period, endsAt });

      return new Response(JSON.stringify({ ok: true, action: "subscription_activated", plan, period }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle cancellation
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
