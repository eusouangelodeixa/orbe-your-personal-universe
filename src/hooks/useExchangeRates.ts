import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ExchangeRates {
  base: string;
  date: string;
  rates: Record<string, number>;
}

/**
 * Fetches exchange rates relative to BRL.
 * Returns rates like { USD: 0.18, EUR: 0.16, MZN: 11.5 }
 * meaning 1 BRL = X foreign currency.
 * 
 * To convert foreign → BRL: amount / rate
 * To convert BRL → foreign: amount * rate
 */
export function useExchangeRates(currencies?: string[]) {
  return useQuery({
    queryKey: ["exchange_rates", currencies?.sort().join(",")],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("exchange-rates", {
        body: {
          base: "BRL",
          symbols: currencies?.join(","),
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data as ExchangeRates;
    },
    staleTime: 10 * 60 * 1000, // 10 min cache
    refetchInterval: 15 * 60 * 1000, // refresh every 15 min
  });
}

/**
 * Convert an amount from a foreign currency to BRL using the rates object.
 * rates are "1 BRL = X foreign", so foreign → BRL = amount / rate
 */
export function convertToBRL(amount: number, currency: string, rates?: Record<string, number>): number {
  if (currency === "BRL" || !rates) return amount;
  const rate = rates[currency];
  if (!rate || rate === 0) return amount; // fallback
  return amount / rate;
}

/**
 * Get the exchange rate from a foreign currency to BRL.
 * Returns how many BRL 1 unit of foreign currency is worth.
 */
export function getExchangeRateToBRL(currency: string, rates?: Record<string, number>): number | null {
  if (currency === "BRL") return 1;
  if (!rates) return null;
  const rate = rates[currency];
  if (!rate || rate === 0) return null;
  return 1 / rate; // 1 foreign = (1/rate) BRL
}
