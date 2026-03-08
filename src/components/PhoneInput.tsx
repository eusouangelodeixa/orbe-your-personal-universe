import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { countries, type Country } from "@/data/countries";

function parsePhone(fullPhone: string): { dial: string; number: string } {
  if (!fullPhone) return { dial: "+55", number: "" };
  // Try to match known dial codes (longest first)
  const sorted = [...countries].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (fullPhone.startsWith(c.dial)) {
      return { dial: c.dial, number: fullPhone.slice(c.dial.length) };
    }
  }
  return { dial: "+55", number: fullPhone.replace(/^\+/, "") };
}

interface PhoneInputProps {
  value: string;
  onChange: (fullPhone: string) => void;
  id?: string;
}

export function PhoneInput({ value, onChange, id }: PhoneInputProps) {
  const parsed = parsePhone(value);
  const [dialCode, setDialCode] = useState(parsed.dial);
  const [number, setNumber] = useState(parsed.number);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Sync from external value
  useEffect(() => {
    const p = parsePhone(value);
    setDialCode(p.dial);
    setNumber(p.number);
  }, [value]);

  const selectedCountry = countries.find(c => c.dial === dialCode) || countries[0];

  const filtered = countries.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.dial.includes(search) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  const handleNumberChange = (num: string) => {
    const cleaned = num.replace(/\D/g, "");
    setNumber(cleaned);
    onChange(cleaned ? `${dialCode}${cleaned}` : "");
  };

  const handleSelectCountry = (country: Country) => {
    setDialCode(country.dial);
    setOpen(false);
    setSearch("");
    onChange(number ? `${country.dial}${number}` : "");
  };

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[110px] justify-between px-3 shrink-0"
          >
            <span className="flex items-center gap-1.5">
              <span className="text-lg leading-none">{selectedCountry.flag}</span>
              <span className="text-sm">{selectedCountry.dial}</span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-0" align="start">
          <div className="flex items-center border-b px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar país..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ScrollArea className="h-[220px]">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3">Nenhum país encontrado</p>
            ) : (
              filtered.map(c => (
                <button
                  key={c.code}
                  onClick={() => handleSelectCountry(c)}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors text-left",
                    c.dial === dialCode && "bg-accent/50 font-medium"
                  )}
                >
                  <span className="text-lg leading-none">{c.flag}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-muted-foreground text-xs">{c.dial}</span>
                </button>
              ))
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
      <Input
        id={id}
        value={number}
        onChange={e => handleNumberChange(e.target.value)}
        placeholder="11999999999"
        className="flex-1"
        inputMode="tel"
      />
    </div>
  );
}
