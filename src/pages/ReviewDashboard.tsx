import { AppLayout } from "@/components/AppLayout";
import { WeeklyReviewCard, ReviewHistory } from "@/components/review/WeeklyReviewCard";
import { Star } from "lucide-react";

export default function ReviewDashboard() {
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-display flex items-center gap-2">
            <Star className="h-7 w-7 text-amber-500" /> Review Semanal
          </h1>
          <p className="text-muted-foreground">Reflexão automatizada do seu progresso</p>
        </div>
        <WeeklyReviewCard />
        <ReviewHistory />
      </div>
    </AppLayout>
  );
}
