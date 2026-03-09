import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  const plans = [
    { product: "prod_U73CrhAJW5hnAY", amount: 4800, nickname: "Basic Trimestral" },
    { product: "prod_U73CVnib4ajQ4N", amount: 7200, nickname: "Student Trimestral" },
    { product: "prod_U73DsZWuSfdT22", amount: 11100, nickname: "Full Trimestral" },
    { product: "prod_U73DxXtdvzBmJe", amount: 6000, nickname: "Fit Trimestral" },
  ];

  const results = [];
  for (const p of plans) {
    const price = await stripe.prices.create({
      product: p.product,
      unit_amount: p.amount,
      currency: "brl",
      recurring: { interval: "month", interval_count: 3 },
      nickname: p.nickname,
    });
    results.push({ nickname: p.nickname, price_id: price.id, product: p.product });
  }

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
