import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Uses frankfurter.app — free, no API key needed
const BASE_URL = "https://api.frankfurter.app";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { base = "BRL", symbols } = await req.json();

    // symbols: comma-separated list like "USD,EUR,MZN"
    const url = `${BASE_URL}/latest?from=${base}${symbols ? `&to=${symbols}` : ""}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Exchange rate API error [${resp.status}]: ${await resp.text()}`);
    }

    const data = await resp.json();
    // data.rates = { USD: 0.18, EUR: 0.16, ... }

    return new Response(JSON.stringify({
      base: data.base,
      date: data.date,
      rates: data.rates,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Exchange rates error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
