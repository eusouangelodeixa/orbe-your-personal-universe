import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { useActivePredictions, useRunAnalysis, useResolvePrediction, RISK_META, Prediction } from "@/hooks/usePredictions";

const RISK_COLORS = {
  low: "border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-400",
  medium: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400",
  high: "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-400",
  critical: "border-red-600/50 bg-red-600/10 text-red-800 dark:text-red-300",
};

const RISK_BADGE = {
  low: "secondary" as const,
  medium: "default" as const,
  high: "destructive" as const,
  critical: "destructive" as const,
};

export function PredictionAlerts() {
  const { data: predictions = [], isLoading } = useActivePredictions();
  const runAnalysis = useRunAnalysis();
  const resolve = useResolvePrediction();

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            Alertas Preditivos
            {predictions.length > 0 && (
              <Badge variant="destructive" className="text-xs h-5 px-1.5">{predictions.length}</Badge>
            )}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => runAnalysis.mutate()}
            disabled={runAnalysis.isPending}
          >
            {runAnalysis.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            Analisar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <div className="animate-pulse h-16 rounded-lg bg-muted" />}
        {!isLoading && predictions.length === 0 && (
          <div className="text-center py-6 text-sm text-muted-foreground flex flex-col items-center gap-2">
            <CheckCircle className="h-6 w-6 text-emerald-500" />
            Nenhum risco detectado — tudo sob controle!
          </div>
        )}
        {predictions.map((p) => {
          const meta = RISK_META[p.prediction_type];
          return (
            <div
              key={p.id}
              className={`p-3 rounded-lg border ${RISK_COLORS[p.risk_level]}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">{meta.icon}</span>
                    <span className="text-xs font-medium">{meta.label}</span>
                    <Badge variant={RISK_BADGE[p.risk_level]} className="text-[10px] h-4 px-1">
                      {p.risk_level === "critical" ? "CRÍTICO" : p.risk_level === "high" ? "ALTO" : p.risk_level === "medium" ? "MÉDIO" : "BAIXO"}
                    </Badge>
                  </div>
                  <p className="text-xs">{p.title}</p>
                  {p.suggested_action && (
                    <p className="text-xs mt-1 opacity-75">💡 {p.suggested_action}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => resolve.mutate(p.id)}
                  title="Marcar como resolvido"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
