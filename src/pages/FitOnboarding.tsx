import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dumbbell, ArrowRight, ArrowLeft, Check, Loader2, User, Target, MapPin,
  Utensils, AlertTriangle, DollarSign, Sparkles
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STEPS = [
  { id: "physical", label: "Perfil Físico", icon: User },
  { id: "goals", label: "Objetivos", icon: Target },
  { id: "training", label: "Treino", icon: MapPin },
  { id: "diet", label: "Alimentação", icon: Utensils },
  { id: "health", label: "Saúde", icon: AlertTriangle },
  { id: "budget", label: "Orçamento", icon: DollarSign },
];

const GOALS = [
  { value: "perda_gordura", label: "Perda de gordura", emoji: "🔥" },
  { value: "ganho_massa", label: "Ganho de massa muscular", emoji: "💪" },
  { value: "hipertrofia", label: "Hipertrofia", emoji: "🏋️" },
  { value: "manutencao", label: "Manutenção", emoji: "⚖️" },
  { value: "condicionamento", label: "Condicionamento físico", emoji: "🏃" },
  { value: "saude_geral", label: "Saúde geral", emoji: "❤️" },
];

const DIET_TYPES = [
  { value: "onivoro", label: "Onívoro", desc: "Come de tudo" },
  { value: "vegetariano", label: "Vegetariano", desc: "Exclui carnes" },
  { value: "vegetariano_estrito", label: "Vegetariano estrito", desc: "Exclui todos os produtos animais na dieta" },
  { value: "vegano", label: "Vegano", desc: "Estilo de vida completo, sem produtos animais" },
  { value: "pescetariano", label: "Pescetariano", desc: "Sem carne vermelha/aves, consome peixe" },
  { value: "flexitariano", label: "Flexitariano", desc: "Base vegetal, carne ocasional" },
];

const DAYS = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"];
const DAY_LABELS: Record<string, string> = {
  segunda: "Seg", terca: "Ter", quarta: "Qua", quinta: "Qui", sexta: "Sex", sabado: "Sáb", domingo: "Dom"
};

const EQUIPMENT_OPTIONS = [
  "Halteres", "Barra", "Anilhas", "Elásticos", "Barra fixa", "Banco",
  "Kettlebell", "Corda", "Colchonete", "Rolo de espuma", "TRX"
];

const COMMON_ALLERGIES = ["Lactose", "Glúten", "Amendoim", "Frutos do mar", "Ovos", "Soja", "Nozes"];
const COMMON_CONDITIONS = ["Diabetes", "Hipertensão", "Colesterol alto", "Hipotireoidismo", "Asma"];

interface FitFormData {
  age: string;
  sex: string;
  weight: string;
  height: string;
  goal: string;
  experience_level: string;
  weekly_days: string[];
  training_location: string;
  available_equipment: string[];
  diet_type: string;
  nutritional_program: string;
  food_allergies: string[];
  food_intolerances: string[];
  medical_conditions: string[];
  supplements: string[];
  has_nutritionist: boolean;
  monthly_food_budget: string;
  custom_allergy: string;
  custom_intolerance: string;
  custom_condition: string;
  custom_supplement: string;
}

export default function FitOnboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FitFormData>({
    age: "", sex: "", weight: "", height: "",
    goal: "", experience_level: "",
    weekly_days: [], training_location: "", available_equipment: [],
    diet_type: "", nutritional_program: "",
    food_allergies: [], food_intolerances: [],
    medical_conditions: [], supplements: [],
    has_nutritionist: false, monthly_food_budget: "",
    custom_allergy: "", custom_intolerance: "", custom_condition: "", custom_supplement: "",
  });

  useEffect(() => {
    if (!user) return;
    checkExistingProfile();
  }, [user]);

  const checkExistingProfile = async () => {
    const { data } = await supabase
      .from("fit_profiles" as any)
      .select("*")
      .eq("user_id", user!.id)
      .maybeSingle();
    if (data && (data as any).onboarding_completed) {
      navigate("/fit");
      return;
    }
    if (data) {
      // Pre-fill form with existing data
      const d = data as any;
      setForm(f => ({
        ...f,
        age: d.age?.toString() || "",
        sex: d.sex || "",
        weight: d.weight?.toString() || "",
        height: d.height?.toString() || "",
        goal: d.goal || "",
        experience_level: d.experience_level || "",
        weekly_days: (d.weekly_availability || []).map((a: any) => a.day),
        training_location: d.training_location || "",
        available_equipment: d.available_equipment || [],
        diet_type: d.diet_type || "",
        nutritional_program: d.nutritional_program || "",
        food_allergies: d.food_allergies || [],
        food_intolerances: d.food_intolerances || [],
        medical_conditions: d.medical_conditions || [],
        supplements: d.supplements || [],
        has_nutritionist: d.has_nutritionist || false,
        monthly_food_budget: d.monthly_food_budget?.toString() || "",
      }));
    }
    setLoading(false);
  };

  const bmi = form.weight && form.height
    ? (parseFloat(form.weight) / ((parseFloat(form.height) / 100) ** 2)).toFixed(1)
    : null;

  const bmiCategory = bmi
    ? parseFloat(bmi) < 18.5 ? "Abaixo do peso"
    : parseFloat(bmi) < 25 ? "Peso normal"
    : parseFloat(bmi) < 30 ? "Sobrepeso"
    : "Obesidade"
    : null;

  const bmiColor = bmi
    ? parseFloat(bmi) < 18.5 ? "text-blue-500"
    : parseFloat(bmi) < 25 ? "text-green-500"
    : parseFloat(bmi) < 30 ? "text-yellow-500"
    : "text-red-500"
    : "";

  const toggleArrayItem = (key: keyof FitFormData, value: string) => {
    setForm(f => {
      const arr = f[key] as string[];
      return { ...f, [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
    });
  };

  const addCustomItem = (listKey: keyof FitFormData, inputKey: keyof FitFormData) => {
    const val = (form[inputKey] as string).trim();
    if (!val) return;
    setForm(f => ({
      ...f,
      [listKey]: [...(f[listKey] as string[]), val],
      [inputKey]: "",
    }));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const payload = {
      user_id: user.id,
      age: form.age ? parseInt(form.age) : null,
      sex: form.sex || null,
      weight: form.weight ? parseFloat(form.weight) : null,
      height: form.height ? parseFloat(form.height) : null,
      goal: form.goal || null,
      experience_level: form.experience_level || null,
      weekly_availability: form.weekly_days.map(day => ({ day })),
      training_location: form.training_location || null,
      available_equipment: form.available_equipment,
      diet_type: form.diet_type || null,
      nutritional_program: form.nutritional_program || null,
      food_allergies: form.food_allergies,
      food_intolerances: form.food_intolerances,
      medical_conditions: form.medical_conditions,
      supplements: form.supplements,
      has_nutritionist: form.has_nutritionist,
      monthly_food_budget: form.monthly_food_budget ? parseFloat(form.monthly_food_budget) : null,
      onboarding_completed: true,
    };

    const { error } = await supabase
      .from("fit_profiles" as any)
      .upsert(payload as any, { onConflict: "user_id" });

    setSaving(false);
    if (error) {
      console.error("Save error:", error);
      toast.error("Erro ao salvar perfil fit");
    } else {
      toast.success("Perfil Fit criado com sucesso! 🎉");
      navigate("/fit");
    }
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Dumbbell className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold font-display">Configurar Fit</h1>
          </div>
          <p className="text-muted-foreground">Vamos conhecer você para criar planos personalizados</p>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Passo {step + 1} de {STEPS.length}</span>
            <span>{STEPS[step].label}</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex gap-1">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setStep(i)}
                className={`flex-1 h-1.5 rounded-full transition-colors ${
                  i <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step Content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {(() => { const Icon = STEPS[step].icon; return <Icon className="h-5 w-5" />; })()}
              {STEPS[step].label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 0: Physical Profile */}
            {step === 0 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Idade</Label>
                    <Input
                      type="number"
                      value={form.age}
                      onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                      placeholder="25"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sexo</Label>
                    <Select value={form.sex} onValueChange={v => setForm(f => ({ ...f, sex: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="feminino">Feminino</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Peso (kg)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={form.weight}
                      onChange={e => setForm(f => ({ ...f, weight: e.target.value }))}
                      placeholder="70.0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Altura (cm)</Label>
                    <Input
                      type="number"
                      value={form.height}
                      onChange={e => setForm(f => ({ ...f, height: e.target.value }))}
                      placeholder="175"
                    />
                  </div>
                </div>
                {bmi && (
                  <div className="rounded-lg border bg-muted/30 p-4 text-center space-y-1">
                    <p className="text-sm text-muted-foreground">Seu IMC</p>
                    <p className={`text-3xl font-bold ${bmiColor}`}>{bmi}</p>
                    <Badge variant="outline" className={bmiColor}>{bmiCategory}</Badge>
                  </div>
                )}
              </>
            )}

            {/* Step 1: Goals */}
            {step === 1 && (
              <>
                <p className="text-sm text-muted-foreground">Qual é seu objetivo principal?</p>
                <div className="grid grid-cols-2 gap-3">
                  {GOALS.map(g => (
                    <button
                      key={g.value}
                      onClick={() => setForm(f => ({ ...f, goal: g.value }))}
                      className={`p-4 rounded-lg border text-left transition-all ${
                        form.goal === g.value
                          ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                          : "hover:border-primary/50"
                      }`}
                    >
                      <span className="text-2xl">{g.emoji}</span>
                      <p className="font-medium mt-1 text-sm">{g.label}</p>
                    </button>
                  ))}
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Nível de experiência</Label>
                  <Select value={form.experience_level} onValueChange={v => setForm(f => ({ ...f, experience_level: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione seu nível" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="iniciante">🌱 Iniciante</SelectItem>
                      <SelectItem value="intermediario">💪 Intermediário</SelectItem>
                      <SelectItem value="avancado">🔥 Avançado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Step 2: Training */}
            {step === 2 && (
              <>
                <div className="space-y-3">
                  <Label>Dias disponíveis para treinar</Label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map(day => (
                      <button
                        key={day}
                        onClick={() => toggleArrayItem("weekly_days", day)}
                        className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                          form.weekly_days.includes(day)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "hover:border-primary/50"
                        }`}
                      >
                        {DAY_LABELS[day]}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {form.weekly_days.length} dia(s) selecionado(s)
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Onde você treina?</Label>
                  <Select value={form.training_location} onValueChange={v => setForm(f => ({ ...f, training_location: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="academia">🏢 Academia</SelectItem>
                      <SelectItem value="casa">🏠 Em casa</SelectItem>
                      <SelectItem value="ar_livre">🌳 Ao ar livre</SelectItem>
                      <SelectItem value="misto">🔄 Misto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(form.training_location === "casa" || form.training_location === "misto") && (
                  <div className="space-y-3">
                    <Label>Equipamentos disponíveis em casa</Label>
                    <div className="flex flex-wrap gap-2">
                      {EQUIPMENT_OPTIONS.map(eq => (
                        <button
                          key={eq}
                          onClick={() => toggleArrayItem("available_equipment", eq)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            form.available_equipment.includes(eq)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "hover:border-primary/50"
                          }`}
                        >
                          {eq}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Step 3: Diet */}
            {step === 3 && (
              <>
                <p className="text-sm text-muted-foreground">Qual é seu grupo alimentar / estilo de vida?</p>
                <div className="space-y-2">
                  {DIET_TYPES.map(d => (
                    <button
                      key={d.value}
                      onClick={() => setForm(f => ({ ...f, diet_type: d.value }))}
                      className={`w-full p-3 rounded-lg border text-left transition-all ${
                        form.diet_type === d.value
                          ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                          : "hover:border-primary/50"
                      }`}
                    >
                      <p className="font-medium text-sm">{d.label}</p>
                      <p className="text-xs text-muted-foreground">{d.desc}</p>
                    </button>
                  ))}
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Programa nutricional específico (opcional)</Label>
                  <Input
                    value={form.nutritional_program}
                    onChange={e => setForm(f => ({ ...f, nutritional_program: e.target.value }))}
                    placeholder="Ex: Afya, etc."
                  />
                </div>
              </>
            )}

            {/* Step 4: Health */}
            {step === 4 && (
              <>
                <div className="space-y-3">
                  <Label>Alergias alimentares</Label>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_ALLERGIES.map(a => (
                      <button
                        key={a}
                        onClick={() => toggleArrayItem("food_allergies", a)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          form.food_allergies.includes(a)
                            ? "bg-destructive text-destructive-foreground border-destructive"
                            : "hover:border-destructive/50"
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={form.custom_allergy}
                      onChange={e => setForm(f => ({ ...f, custom_allergy: e.target.value }))}
                      placeholder="Outra alergia..."
                      className="flex-1"
                      onKeyDown={e => e.key === "Enter" && addCustomItem("food_allergies", "custom_allergy")}
                    />
                    <Button variant="outline" size="sm" onClick={() => addCustomItem("food_allergies", "custom_allergy")}>+</Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label>Condições médicas relevantes</Label>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_CONDITIONS.map(c => (
                      <button
                        key={c}
                        onClick={() => toggleArrayItem("medical_conditions", c)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          form.medical_conditions.includes(c)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "hover:border-primary/50"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={form.custom_condition}
                      onChange={e => setForm(f => ({ ...f, custom_condition: e.target.value }))}
                      placeholder="Outra condição..."
                      className="flex-1"
                      onKeyDown={e => e.key === "Enter" && addCustomItem("medical_conditions", "custom_condition")}
                    />
                    <Button variant="outline" size="sm" onClick={() => addCustomItem("medical_conditions", "custom_condition")}>+</Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label>Suplementação</Label>
                  <div className="flex gap-2">
                    <Input
                      value={form.custom_supplement}
                      onChange={e => setForm(f => ({ ...f, custom_supplement: e.target.value }))}
                      placeholder="Ex: Whey Protein, Creatina..."
                      className="flex-1"
                      onKeyDown={e => e.key === "Enter" && addCustomItem("supplements", "custom_supplement")}
                    />
                    <Button variant="outline" size="sm" onClick={() => addCustomItem("supplements", "custom_supplement")}>+</Button>
                  </div>
                  {form.supplements.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {form.supplements.map(s => (
                        <Badge key={s} variant="secondary" className="cursor-pointer" onClick={() => toggleArrayItem("supplements", s)}>
                          {s} ×
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Faz acompanhamento com nutricionista?</Label>
                    <p className="text-xs text-muted-foreground">Se sim, pode subir seu plano depois</p>
                  </div>
                  <Switch
                    checked={form.has_nutritionist}
                    onCheckedChange={v => setForm(f => ({ ...f, has_nutritionist: v }))}
                  />
                </div>
              </>
            )}

            {/* Step 5: Budget */}
            {step === 5 && (
              <>
                <div className="space-y-2">
                  <Label>Orçamento mensal para alimentação (R$)</Label>
                  <Input
                    type="number"
                    value={form.monthly_food_budget}
                    onChange={e => setForm(f => ({ ...f, monthly_food_budget: e.target.value }))}
                    placeholder="800"
                  />
                  <p className="text-xs text-muted-foreground">
                    A IA usará esse valor para montar um plano alimentar dentro do seu orçamento
                  </p>
                </div>

                <Separator />

                {/* Summary */}
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <p className="font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Resumo do seu perfil
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {form.age && <div><span className="text-muted-foreground">Idade:</span> {form.age} anos</div>}
                    {form.sex && <div><span className="text-muted-foreground">Sexo:</span> {form.sex}</div>}
                    {form.weight && <div><span className="text-muted-foreground">Peso:</span> {form.weight}kg</div>}
                    {form.height && <div><span className="text-muted-foreground">Altura:</span> {form.height}cm</div>}
                    {bmi && <div><span className="text-muted-foreground">IMC:</span> {bmi}</div>}
                    {form.goal && <div><span className="text-muted-foreground">Objetivo:</span> {GOALS.find(g => g.value === form.goal)?.label}</div>}
                    {form.experience_level && <div><span className="text-muted-foreground">Nível:</span> {form.experience_level}</div>}
                    {form.training_location && <div><span className="text-muted-foreground">Local:</span> {form.training_location}</div>}
                    {form.diet_type && <div><span className="text-muted-foreground">Dieta:</span> {DIET_TYPES.find(d => d.value === form.diet_type)?.label}</div>}
                    {form.weekly_days.length > 0 && <div><span className="text-muted-foreground">Dias:</span> {form.weekly_days.length}x/semana</div>}
                  </div>
                  {form.food_allergies.length > 0 && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Alergias:</span>{" "}
                      {form.food_allergies.join(", ")}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>

          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(s => s + 1)}>
              Próximo
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Concluir e criar perfil
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
