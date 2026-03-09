import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  locale: string;
}

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: "BRL", symbol: "R$", name: "Real Brasileiro", locale: "pt-BR" },
  { code: "USD", symbol: "$", name: "Dólar Americano", locale: "en-US" },
  { code: "EUR", symbol: "€", name: "Euro", locale: "de-DE" },
  { code: "GBP", symbol: "£", name: "Libra Esterlina", locale: "en-GB" },
  { code: "MZN", symbol: "MT", name: "Metical Moçambicano", locale: "pt-MZ" },
  { code: "JPY", symbol: "¥", name: "Iene Japonês", locale: "ja-JP" },
];

interface CurrencyContextType {
  currency: CurrencyInfo;
  setCurrency: (code: string) => Promise<void>;
  formatMoney: (value: number) => string;
}

const defaultCurrency = SUPPORTED_CURRENCIES[0]; // BRL

const CurrencyContext = createContext<CurrencyContextType>({
  currency: defaultCurrency,
  setCurrency: async () => {},
  formatMoney: (v) => `R$ ${v.toFixed(2)}`,
});

export const useCurrency = () => useContext(CurrencyContext);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currency, setCurrencyState] = useState<CurrencyInfo>(defaultCurrency);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("currency")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.currency) {
          const found = SUPPORTED_CURRENCIES.find((c) => c.code === data.currency);
          if (found) setCurrencyState(found);
        }
      });
  }, [user]);

  const setCurrency = async (code: string) => {
    const found = SUPPORTED_CURRENCIES.find((c) => c.code === code);
    if (!found || !user) return;
    setCurrencyState(found);
    await supabase
      .from("profiles")
      .update({ currency: code, updated_at: new Date().toISOString() } as any)
      .eq("user_id", user.id);
  };

  const formatMoney = (value: number) => {
    return Number(value).toLocaleString(currency.locale, {
      style: "currency",
      currency: currency.code,
      minimumFractionDigits: currency.code === "JPY" ? 0 : 2,
    });
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatMoney }}>
      {children}
    </CurrencyContext.Provider>
  );
}
