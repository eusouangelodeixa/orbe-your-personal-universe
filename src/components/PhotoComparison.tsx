import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeftRight } from "lucide-react";

interface ProgressPhoto {
  url: string;
  date: string;
  weight: number;
}

interface PhotoComparisonProps {
  photos: ProgressPhoto[];
}

export function PhotoComparison({ photos }: PhotoComparisonProps) {
  const [leftIdx, setLeftIdx] = useState(0);
  const [rightIdx, setRightIdx] = useState(Math.min(photos.length - 1, photos.length > 1 ? photos.length - 1 : 0));

  if (photos.length < 2) return null;

  const left = photos[leftIdx];
  const right = photos[rightIdx];
  const weightDiff = right ? (Number(right.weight) - Number(left.weight)).toFixed(1) : "0";
  const isLoss = Number(weightDiff) < 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4" /> Comparação lado a lado
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Select value={String(leftIdx)} onValueChange={(v) => setLeftIdx(Number(v))}>
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {photos.map((p, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {new Date(p.date).toLocaleDateString("pt-BR")} — {Number(p.weight).toFixed(1)}kg
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative rounded-lg overflow-hidden aspect-[3/4]">
              <img src={left.url} alt="Antes" className="w-full h-full object-cover" />
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1.5">
                <p className="text-white text-xs font-medium">{new Date(left.date).toLocaleDateString("pt-BR")}</p>
                <p className="text-white/80 text-xs">{Number(left.weight).toFixed(1)} kg</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Select value={String(rightIdx)} onValueChange={(v) => setRightIdx(Number(v))}>
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {photos.map((p, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {new Date(p.date).toLocaleDateString("pt-BR")} — {Number(p.weight).toFixed(1)}kg
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative rounded-lg overflow-hidden aspect-[3/4]">
              <img src={right.url} alt="Depois" className="w-full h-full object-cover" />
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1.5">
                <p className="text-white text-xs font-medium">{new Date(right.date).toLocaleDateString("pt-BR")}</p>
                <p className="text-white/80 text-xs">{Number(right.weight).toFixed(1)} kg</p>
              </div>
            </div>
          </div>
        </div>

        {left && right && (
          <div className={`text-center py-2 rounded-lg text-sm font-medium ${isLoss ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
            {isLoss ? "📉" : "📈"} {weightDiff} kg ({Math.abs(Number(weightDiff) / Number(left.weight) * 100).toFixed(1)}%)
          </div>
        )}
      </CardContent>
    </Card>
  );
}
