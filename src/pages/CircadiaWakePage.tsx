import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sun, Loader2, CheckCircle } from "lucide-react";
import { useConfirmWake, useTodaySession } from "@/hooks/useCircadia";
import { useAuth } from "@/contexts/AuthContext";

export default function CircadiaWakePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const { data: todaySession, isLoading } = useTodaySession();
  const confirmWake = useConfirmWake();

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-50 to-white dark:from-gray-900 dark:to-gray-950">
      <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
    </div>
  );

  const session = todaySession;
  const alreadyConfirmed = session?.wake_confirmed;
  const targetId = sessionId || session?.id;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-50 to-white dark:from-gray-900 dark:to-gray-950 p-4">
      <Card className="w-full max-w-sm text-center">
        <CardContent className="py-8 space-y-6">
          {alreadyConfirmed ? (
            <>
              <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto" />
              <div>
                <h2 className="text-xl font-bold">Despertar confirmado!</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Score: {session?.score}/100 · Desvio: {session?.deviation_minutes! > 0 ? "+" : ""}{session?.deviation_minutes}min
                </p>
              </div>
              <p className="text-sm text-muted-foreground">Bom dia! Que seu dia seja produtivo.</p>
            </>
          ) : (
            <>
              <Sun className="h-16 w-16 text-amber-500 mx-auto animate-pulse" />
              <div>
                <h2 className="text-xl font-bold">Prove que você acordou</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Clique no botão abaixo para confirmar seu despertar
                </p>
              </div>
              <Button
                size="lg"
                className="w-full text-lg py-6"
                onClick={() => targetId && confirmWake.mutate({ sessionId: targetId })}
                disabled={!targetId || confirmWake.isPending}
              >
                {confirmWake.isPending ? (
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                ) : (
                  <Sun className="h-6 w-6 mr-2" />
                )}
                Bom dia! Estou acordado
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
