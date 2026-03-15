import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Uses open.er-api.com — free, no API key, supports BRL
const BASE_URL = "https://open.er-api.com/v6/latest";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { base = "BRL", symbols } = await req.json();

    const url = `${BASE_URL}/${base}`;
    console.log("Fetching exchange rates from:", url);

    const resp = await fetch(url);
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Exchange rate API error [${resp.status}]: ${body}`);
    }

    const data = await resp.json();
    if (data.result !== "success") {
      throw new Error(`Exchange rate API returned: ${JSON.stringify(data)}`);
    }

    // data.rates contains all rates, filter if symbols specified
    let rates = data.rates as Record<string, number>;
    if (symbols) {
      const wanted = symbols.split(",").map((s: string) => s.trim().toUpperCase());
      const filtered: Record<string, number> = {};
      for (const sym of wanted) {
        if (rates[sym] !== undefined) {
          filtered[sym] = rates[sym];
        }
      }
      rates = filtered;
    }

    console.log("Exchange rates fetched successfully:", { base, date: data.time_last_update_utc, rateCount: Object.keys(rates).length });

    return new Response(JSON.stringify({
      base: base,
      date: data.time_last_update_utc,
      rates,
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
