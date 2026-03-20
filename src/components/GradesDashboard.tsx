import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useSubjects, useAcademicEvents } from "@/hooks/useStudies";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";

export function GradesDashboard() {
  const { data: subjects = [] } = useSubjects();
  const { data: events = [] } = useAcademicEvents();

  const subjectGrades = subjects.map(sub => {
    const subEvents = events.filter(e => e.subject_id === sub.id && e.grade != null);
    const weightedEvents = subEvents.filter(e => e.weight != null && e.weight > 0);

    let average = 0;
    if (weightedEvents.length > 0) {
      const totalWeight = weightedEvents.reduce((a, e) => a + (e.weight || 0), 0);
      const weightedSum = weightedEvents.reduce((a, e) => a + (e.grade || 0) * (e.weight || 0), 0);
      average = totalWeight > 0 ? weightedSum / totalWeight : 0;
    } else if (subEvents.length > 0) {
      average = subEvents.reduce((a, e) => a + (e.grade || 0), 0) / subEvents.length;
    }

    const allSubEvents = events.filter(e => e.subject_id === sub.id);
    const totalEvents = allSubEvents.length;
    const pendingEvents = allSubEvents.filter(e => e.status === "pendente" || e.status === "em_andamento").length;
    const completedEvents = allSubEvents.filter(e => e.grade != null).length;

    // Calculate minimum grade needed
    const pendingWithWeight = allSubEvents.filter(e => e.grade == null && e.weight != null && e.weight > 0);
    const remainingWeight = pendingWithWeight.reduce((a, e) => a + (e.weight || 0), 0);
    const currentWeightedSum = weightedEvents.reduce((a, e) => a + (e.grade || 0) * (e.weight || 0), 0);
    const currentWeight = weightedEvents.reduce((a, e) => a + (e.weight || 0), 0);
    const totalPossibleWeight = currentWeight + remainingWeight;
    const neededForPass = totalPossibleWeight > 0 && remainingWeight > 0
      ? Math.max(0, (6.0 * totalPossibleWeight - currentWeightedSum) / remainingWeight)
      : null;

    return {
      id: sub.id,
      name: sub.name,
      color: sub.color,
      average: Math.round(average * 100) / 100,
      totalEvents,
      pendingEvents,
      completedEvents,
      status: average >= 6 ? "aprovado" : average > 0 ? "risco" : "sem_nota",
      neededForPass: neededForPass !== null ? Math.round(neededForPass * 100) / 100 : null,
      grades: subEvents.map(e => ({ name: e.title, nota: e.grade || 0, peso: e.weight || 1 })),
    };
  }).filter(s => s.totalEvents > 0);

  const chartData = subjectGrades
    .filter(s => s.average > 0)
    .map(s => ({ name: s.name.length > 12 ? s.name.slice(0, 12) + "…" : s.name, media: s.average }));

  return (
    <div className="space-y-4">
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Médias por Disciplina
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                  <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 10]} className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="media" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Média" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {subjectGrades.map(sub => (
          <Card key={sub.id} className="overflow-hidden">
            <div className="h-1" style={{ backgroundColor: sub.color || "hsl(var(--primary))" }} />
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{sub.name}</span>
                <Badge variant={sub.status === "aprovado" ? "default" : sub.status === "risco" ? "destructive" : "secondary"} className="text-xs">
                  {sub.status === "aprovado" ? "✅ Aprovado" : sub.status === "risco" ? "⚠️ Em risco" : "Sem notas"}
                </Badge>
              </div>

              {sub.average > 0 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Média: <span className={`font-semibold ${sub.average >= 6 ? "text-emerald-400" : "text-red-400"}`}>{sub.average.toFixed(1)}</span></span>
                    <span>{sub.completedEvents}/{sub.totalEvents} avaliações</span>
                  </div>
                  <Progress value={Math.min(100, sub.average * 10)} className="h-2" />
                </div>
              )}

              {sub.neededForPass !== null && sub.neededForPass > 0 && sub.status === "risco" && (
                <p className="text-xs text-amber-400">
                  📌 Precisa de no mínimo <span className="font-bold">{sub.neededForPass.toFixed(1)}</span> nas próximas avaliações para aprovação
                </p>
              )}

              {sub.grades.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {sub.grades.map((g, i) => (
                    <span key={i} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${g.nota >= 6 ? "border-emerald-500/30 text-emerald-400" : "border-red-500/30 text-red-400"}`}>
                      {g.name.slice(0, 15)}: {g.nota.toFixed(1)}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {subjectGrades.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma nota registrada ainda</p>
            <p className="text-xs">Registre notas nos eventos acadêmicos para ver seu desempenho</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
