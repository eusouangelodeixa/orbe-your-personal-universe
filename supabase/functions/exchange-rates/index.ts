import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPEN_ER_API = "https://open.er-api.com/v6/latest";
const AWESOME_API = "https://economia.awesomeapi.com.br/json/last";

function parseSymbols(symbols?: string): string[] {
  if (!symbols) return [];
  return symbols
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

/**
 * Primary provider for BRL base: AwesomeAPI (near real-time)
 * It returns bid as BRL per 1 foreign (e.g. USDBRL.bid = 5.24).
 * We normalize to keep app contract: rates[currency] = foreign per 1 BRL.
 */
async function fetchFromAwesome(symbols: string[]): Promise<Record<string, number>> {
  if (!symbols.length) return {};

  const pairs = symbols
    .filter((s) => s !== "BRL")
    .map((s) => `${s}-BRL`)
    .join(",");

  if (!pairs) return {};

  const resp = await fetch(`${AWESOME_API}/${pairs}`);
  if (!resp.ok) {
    throw new Error(`AwesomeAPI error [${resp.status}]: ${await resp.text()}`);
  }

  const data = await resp.json();
  const rates: Record<string, number> = {};

  for (const sym of symbols) {
    if (sym === "BRL") {
      rates.BRL = 1;
      continue;
    }

    const key = `${sym}BRL`;
    const bid = Number(data?.[key]?.bid);

    if (Number.isFinite(bid) && bid > 0) {
      // Keep frontend contract: 1 BRL = X foreign
      rates[sym] = 1 / bid;
    }
  }

  if (!Object.keys(rates).length) {
    throw new Error("AwesomeAPI returned no valid rates");
  }

  return rates;
}

/**
 * Fallback provider: open.er-api (free, broad support)
 * Returns rates in the same contract we already use: 1 base = X foreign.
 */
async function fetchFromOpenEr(base: string, symbols: string[]): Promise<{ date: string; rates: Record<string, number> }> {
  const resp = await fetch(`${OPEN_ER_API}/${base}`);
  if (!resp.ok) {
    throw new Error(`open.er-api error [${resp.status}]: ${await resp.text()}`);
  }

  const data = await resp.json();
  if (data.result !== "success") {
    throw new Error(`open.er-api result error: ${JSON.stringify(data)}`);
  }

  let rates = data.rates as Record<string, number>;
  if (symbols.length) {
    const filtered: Record<string, number> = {};
    for (const sym of symbols) {
      if (sym === base) {
        filtered[sym] = 1;
      } else if (rates[sym] !== undefined) {
        filtered[sym] = rates[sym];
      }
    }
    rates = filtered;
  }

  return {
    date: data.time_last_update_utc,
    rates,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { base = "BRL", symbols } = await req.json();
    const normalizedBase = String(base).toUpperCase();
    const symbolList = parseSymbols(symbols);

    let rates: Record<string, number> = {};
    let date = new Date().toISOString();
    let source = "open.er-api";

    // Prefer AwesomeAPI when consolidating to BRL (most up-to-date for BRL pairs)
    if (normalizedBase === "BRL" && symbolList.length > 0) {
      try {
        rates = await fetchFromAwesome(symbolList);
        source = "awesomeapi";
      } catch (awesomeErr) {
        console.warn("AwesomeAPI failed, falling back to open.er-api:", awesomeErr);
      }
    }

    if (!Object.keys(rates).length) {
      const fallback = await fetchFromOpenEr(normalizedBase, symbolList);
      rates = fallback.rates;
      date = fallback.date;
      source = "open.er-api";
    }

    console.log("Exchange rates fetched", {
      base: normalizedBase,
      source,
      symbols: symbolList,
      rateCount: Object.keys(rates).length,
    });

    return new Response(
      JSON.stringify({
        base: normalizedBase,
        date,
        source,
        rates,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Exchange rates error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
