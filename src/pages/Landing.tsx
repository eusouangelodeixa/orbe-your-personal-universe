import { useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { OrbeIcon } from "@/components/OrbeIcon";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Wallet,
  GraduationCap,
  Dumbbell,
  CheckSquare,
  MessageSquare,
  Camera,
  BarChart3,
  Bell,
  Target,
  CreditCard,
  TrendingUp,
  Shield,
  ChevronDown,
  Clock,
  Zap,
  Smartphone,
  Star,
  Check,
  Lock,
  Bot,
  Utensils,
  Brain,
} from "lucide-react";

/* ─── Fade-in animation wrapper ─── */
const FadeIn = ({
  children,
  delay = 0,
  className = "",
  direction = "up",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  direction?: "up" | "down" | "left" | "right";
}) => {
  const dirs = { up: [30, 0], down: [-30, 0], left: [0, 30], right: [0, -30] };
  const [y, x] = dirs[direction] || [30, 0];
  return (
    <motion.div
      initial={{ opacity: 0, y: direction === "up" || direction === "down" ? y : 0, x: direction === "left" || direction === "right" ? x : 0 }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/* ─── Marquee features ─── */
const marqueeItems = [
  { icon: MessageSquare, label: "WhatsApp Nativo" },
  { icon: Camera, label: "Leitura de Recibos" },
  { icon: BarChart3, label: "Gráficos Detalhados" },
  { icon: Bell, label: "Alertas Inteligentes" },
  { icon: Target, label: "Metas de Poupança" },
  { icon: CreditCard, label: "Carteiras Múltiplas" },
  { icon: TrendingUp, label: "Análise de Gastos" },
  { icon: Shield, label: "Dados Seguros" },
  { icon: GraduationCap, label: "Gestão Acadêmica" },
  { icon: Dumbbell, label: "Treino com IA" },
  { icon: Utensils, label: "Plano Alimentar" },
  { icon: Brain, label: "Consultor IA 24h" },
];

/* ─── Features data ─── */
const features = [
  {
    icon: MessageSquare,
    title: "WHATSAPP NATIVO",
    desc: "Envie texto, áudio ou foto. ORBE extrai os dados automaticamente. Sem apps extras.",
  },
  {
    icon: CheckSquare,
    title: "TAREFAS INTELIGENTES",
    desc: "Crie tarefas por texto ou voz. Receba lembretes automáticos. Nunca mais esqueça nada!",
  },
  {
    icon: Camera,
    title: "LEITURA DE RECIBOS",
    desc: "Tire foto do recibo. A IA extrai valor, data, categoria e estabelecimento em segundos.",
  },
  {
    icon: Bell,
    title: "ALERTAS INTELIGENTES",
    desc: "Defina limites diários ou por categoria. ORBE te avisa antes de estourar o orçamento.",
  },
  {
    icon: Target,
    title: "METAS DE POUPANÇA",
    desc: "Crie metas pelo WhatsApp. Acompanhe o progresso. Receba motivação automática.",
  },
  {
    icon: BarChart3,
    title: "ANÁLISE COMPLETA",
    desc: "Dashboard com gráficos claros. Veja gastos por categoria, evolução e padrões.",
  },
  {
    icon: Bot,
    title: "CONSULTOR IA 24H",
    desc: "Pergunte qualquer coisa sobre finanças, estudos ou saúde. ORBE responde com base nos seus dados.",
  },
  {
    icon: GraduationCap,
    title: "GESTÃO ACADÊMICA",
    desc: "Agenda de provas, chatbot por disciplina, pomodoro e lembretes acadêmicos integrados.",
  },
];

/* ─── Testimonials ─── */
const testimonials = [
  {
    initials: "MS",
    name: "Maria Santos",
    role: "Empreendedora • Maputo",
    quote: "Antes perdia horas a organizar recibos. Com ORBE, tiro foto e está feito. Já poupei 5.000 MT em 2 meses!",
    stat: "5.000 MT POUPADOS",
  },
  {
    initials: "JM",
    name: "João Machava",
    role: "Engenheiro • Matola",
    quote: "O WhatsApp integrado mudou tudo. Registro gastos na hora, sem esquecer nada. Minha organização financeira está 100%.",
    stat: "45 DIAS DE SEQUÊNCIA",
  },
  {
    initials: "AT",
    name: "Ana Tembe",
    role: "Professora • Beira",
    quote: "Os alertas de limite são fantásticos! Agora sei exactamente quando parar de gastar. Atingi minha meta de poupança em 60 dias.",
    stat: "META ATINGIDA",
  },
  {
    initials: "CM",
    name: "Carlos Mondlane",
    role: "Freelancer • Nampula",
    quote: "Como freelancer, precisava controlar rendimentos variáveis. ORBE me mostra padrões que eu não via. Recomendo a todos!",
    stat: "+40% ECONOMIA",
  },
];

/* ─── FAQ ─── */
const faqs = [
  {
    q: "O que é o ORBE?",
    a: "ORBE é um super-assistente pessoal que centraliza finanças, estudos, fitness e tarefas. Funciona via WhatsApp e dashboard web, usando IA para automatizar sua organização.",
  },
  {
    q: "Como funciona a leitura de recibos?",
    a: "Basta tirar uma foto do recibo e enviar pelo WhatsApp. A IA extrai automaticamente valor, data, categoria e estabelecimento em segundos.",
  },
  {
    q: "É diferente de apps como Excel ou Notion?",
    a: "Sim! ORBE é conversacional — você fala com ele pelo WhatsApp como se fosse um assistente pessoal. Não precisa abrir planilhas nem configurar nada.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim, sem burocracia. Cancele a qualquer momento direto pelo painel. Garantia de 7 dias com reembolso total.",
  },
  {
    q: "Meus dados estão seguros?",
    a: "Absolutamente. Usamos criptografia de ponta e infraestrutura segura. Seus dados são privados e nunca compartilhados.",
  },
];

/* ─── Chat mockup messages ─── */
const chatMessages = [
  { type: "user", text: "Gastei 450mt eMola supermercado", time: "09:30" },
  {
    type: "bot",
    text: "✅ Registado!\n🛒 Compras: 450 MT\n📅 Hoje\n\n💡 Já gastaste 1.200 MT hoje. Estás perto do limite diário de 1.500 MT!",
    time: "09:30",
  },
  { type: "user", text: "Quanto gastei este mês?", time: "14:20" },
  {
    type: "bot",
    text: "📊 Resumo de Janeiro:\n\n💸 Total: 15.400 MT\n🍽️ Alimentação: 6.200 MT\n🚗 Transporte: 3.800 MT\n🛒 Compras: 5.400 MT\n\n📈 Estás 12% abaixo do mês passado. Bom trabalho! 💪",
    time: "14:20",
  },
];

/* ─── Pricing plans ─── */
const pricingPlans = [
  { id: "monthly", label: "Mensal", price: "29,90", period: "/mês", billing: "Cobrado mensalmente", badge: null },
  { id: "quarterly", label: "Trimestral", price: "24,90", period: "/mês", billing: "Cobrado R$ 74,70 a cada 3 meses", badge: "17% OFF" },
  { id: "annual", label: "Anual", price: "19,90", period: "/mês", billing: "Cobrado R$ 238,80 por ano", badge: "33% OFF" },
];

const planFeatures = [
  "Transações ilimitadas via WhatsApp",
  "Tarefas e lembretes inteligentes",
  "Leitura IA de recibos",
  "Alertas de limite em tempo real",
  "Dashboard com gráficos completos",
  "Metas de poupança ilimitadas",
  "Gestão acadêmica completa",
  "Treino e alimentação com IA",
  "Suporte prioritário",
];

/* ─── Main component ─── */
export default function Landing() {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState("annual");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const currentPlan = pricingPlans.find((p) => p.id === selectedPlan)!;

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ─── NAVBAR ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <OrbeIcon size={32} />
            <span className="text-xl font-bold font-display tracking-tight">ORBE</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Funcionalidades</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Preços</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
              Login
            </Button>
            <Button size="sm" onClick={() => navigate("/auth")} className="gap-1.5">
              Começar Agora <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="relative pt-32 pb-20 px-6">
        {/* Background effects */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-primary/5 blur-[150px]" />
          <div className="absolute top-40 left-1/4 w-[400px] h-[400px] rounded-full bg-accent/5 blur-[120px]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <FadeIn>
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-8">
                <span className="text-xs font-medium text-primary uppercase tracking-wider">
                  Super-Assistente Pessoal com IA
                </span>
              </div>
            </FadeIn>

            <FadeIn delay={0.1}>
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold font-display tracking-tight leading-[0.95] mb-6">
                SEU UNIVERSO,
                <br />
                <span className="bg-gradient-primary bg-clip-text text-transparent">
                  ORGANIZADO.
                </span>
              </h1>
            </FadeIn>

            <FadeIn delay={0.2}>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
                ORBE é seu assistente via WhatsApp: regista gastos, organiza tarefas,
                gerencia estudos, acompanha treinos e te ajuda a evoluir sem esforço.
              </p>
            </FadeIn>

            <FadeIn delay={0.3}>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
                <Button
                  size="lg"
                  onClick={() => navigate("/auth")}
                  className="gap-2 text-base px-8 h-14 rounded-2xl shadow-glow-md"
                >
                  COMEÇAR AGORA <ArrowRight className="h-5 w-5" />
                </Button>
              </div>
              <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-primary" /> Setup 2 min</span>
                <span className="flex items-center gap-1.5"><Zap className="h-4 w-4 text-primary" /> Acesso imediato</span>
                <span className="flex items-center gap-1.5"><Smartphone className="h-4 w-4 text-primary" /> 100% WhatsApp</span>
              </div>
            </FadeIn>
          </div>

          {/* Chat mockup */}
          <FadeIn delay={0.4} className="mt-16 max-w-md mx-auto">
            <div className="rounded-3xl border border-border bg-card shadow-2xl overflow-hidden">
              {/* Phone header */}
              <div className="bg-primary px-5 py-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                  <OrbeIcon size={24} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-primary-foreground">ORBE</p>
                  <p className="text-xs text-primary-foreground/70">online</p>
                </div>
              </div>
              {/* Messages */}
              <div className="p-4 space-y-3 max-h-[420px] overflow-y-auto bg-background/50">
                {chatMessages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 + i * 0.15 }}
                    className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        msg.type === "user"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-card border border-border rounded-bl-md"
                      }`}
                    >
                      <p className="whitespace-pre-line">{msg.text}</p>
                      <p className={`text-[10px] mt-1 ${msg.type === "user" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        {msg.time}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── MARQUEE ─── */}
      <section className="py-8 border-y border-border/50 overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap">
          {[...marqueeItems, ...marqueeItems, ...marqueeItems].map((item, i) => (
            <div key={i} className="inline-flex items-center gap-2 mx-6 text-muted-foreground">
              <item.icon className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ─── MODULES ─── */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="text-center mb-16">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary mb-3 block">Arsenal Completo</span>
            <h2 className="text-4xl md:text-5xl font-bold font-display tracking-tight mb-4">
              FINANÇAS + ESTUDOS + FIT + TAREFAS
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              ORBE organiza todas as áreas da sua vida. Você controla tudo num só lugar.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Wallet, title: "Financeiro", desc: "Controle gastos, planilha doméstica e consultor financeiro com IA.", color: "text-emerald-500" },
              { icon: GraduationCap, title: "Estudos", desc: "Agenda acadêmica, chatbots por disciplina e lembretes inteligentes.", color: "text-blue-500" },
              { icon: Dumbbell, title: "Fit", desc: "Plano de treino e alimentação personalizado com IA nutricionista.", color: "text-orange-500" },
              { icon: CheckSquare, title: "Tarefas", desc: "Gestão de tarefas integrada a todos os módulos do ORBE.", color: "text-purple-500" },
            ].map((mod, i) => (
              <FadeIn key={mod.title} delay={i * 0.1}>
                <div className="group relative rounded-2xl border border-border bg-card p-6 hover:border-primary/30 transition-all duration-300 hover:shadow-glow-sm h-full">
                  <mod.icon className={`h-10 w-10 ${mod.color} mb-4`} />
                  <h3 className="font-display font-semibold text-lg mb-2">{mod.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{mod.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES GRID ─── */}
      <section id="features" className="py-24 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="text-center mb-16">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary mb-3 block">Funcionalidades</span>
            <h2 className="text-4xl md:text-5xl font-bold font-display tracking-tight mb-4">
              TUDO QUE VOCÊ PRECISA
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Cada recurso foi pensado para simplificar sua vida.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f, i) => (
              <FadeIn key={f.title} delay={i * 0.05}>
                <div className="group rounded-2xl border border-border bg-card p-6 hover:border-primary/30 transition-all duration-300 hover:shadow-glow-sm h-full flex flex-col">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <f.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-display font-semibold text-sm mb-2 tracking-wide">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1">{f.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="text-center mb-16">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary mb-3 block">Utilizadores</span>
            <h2 className="text-4xl md:text-5xl font-bold font-display tracking-tight mb-4">
              QUEM USA ORBE,
              <br />
              <span className="bg-gradient-primary bg-clip-text text-transparent">DOMINA A VIDA.</span>
            </h2>
            <p className="text-lg text-muted-foreground">Resultados reais. Pessoas reais. Controle real.</p>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {testimonials.map((t, i) => (
              <FadeIn key={t.name} delay={i * 0.1}>
                <div className="rounded-2xl border border-border bg-card p-6 hover:border-primary/20 transition-all duration-300">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center text-sm font-bold text-white">
                      {t.initials}
                    </div>
                    <div>
                      <p className="font-display font-semibold">{t.name}</p>
                      <p className="text-sm text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                  <p className="text-muted-foreground leading-relaxed mb-4 italic">"{t.quote}"</p>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, j) => (
                        <Star key={j} className="h-4 w-4 fill-primary text-primary" />
                      ))}
                    </div>
                    <span className="text-xs font-semibold text-primary ml-auto bg-primary/10 px-3 py-1 rounded-full">
                      {t.stat}
                    </span>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="pricing" className="py-24 px-6 bg-muted/30">
        <div className="max-w-3xl mx-auto">
          <FadeIn className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold font-display tracking-tight mb-4">
              ESCOLHA SEU PLANO.
              <br />
              <span className="bg-gradient-primary bg-clip-text text-transparent">COMECE A EVOLUIR.</span>
            </h2>
            <p className="text-lg text-muted-foreground">Quanto mais tempo, maior o desconto. Cancele quando quiser.</p>
          </FadeIn>

          {/* Plan toggle */}
          <FadeIn delay={0.1} className="flex justify-center mb-10">
            <div className="inline-flex bg-card border border-border rounded-2xl p-1.5 gap-1">
              {pricingPlans.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlan(p.id)}
                  className={`relative px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    selectedPlan === p.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                  {p.badge && (
                    <span className="absolute -top-2 -right-2 bg-accent text-accent-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {p.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </FadeIn>

          {/* Price card */}
          <FadeIn delay={0.2}>
            <div className="rounded-3xl border-2 border-primary/30 bg-card p-8 md:p-10 text-center shadow-glow-sm">
              {currentPlan.id !== "monthly" && (
                <p className="text-sm text-muted-foreground line-through mb-1">De R$ 29,90/mês</p>
              )}
              <div className="flex items-baseline justify-center gap-1 mb-2">
                <span className="text-5xl md:text-6xl font-bold font-display">R${currentPlan.price}</span>
                <span className="text-lg text-muted-foreground">{currentPlan.period}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-8">{currentPlan.billing}</p>

              {currentPlan.id === "annual" && (
                <p className="text-sm text-primary font-medium mb-6">
                  💰 R$ 0,66/dia = Menos que um café!
                </p>
              )}

              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="w-full max-w-sm mx-auto gap-2 text-base h-14 rounded-2xl shadow-glow-md mb-8"
              >
                COMEÇAR AGORA <ArrowRight className="h-5 w-5" />
              </Button>

              <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground mb-8">
                <span className="flex items-center gap-1"><Lock className="h-3.5 w-3.5" /> Compra Segura</span>
                <span className="flex items-center gap-1"><Zap className="h-3.5 w-3.5" /> Acesso Imediato</span>
              </div>

              <div className="border-t border-border pt-6">
                <p className="font-display font-semibold text-sm mb-4">Acesso Completo</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-lg mx-auto">
                  {planFeatures.map((f) => (
                    <div key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="mt-8 text-xs text-muted-foreground">
                🔒 Garantia de 7 dias. Se não gostar, devolvemos 100% do seu dinheiro.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <FadeIn className="text-center mb-12">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary mb-3 block">Dúvidas Frequentes</span>
            <h2 className="text-4xl font-bold font-display tracking-tight">Perguntas Frequentes</h2>
          </FadeIn>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <FadeIn key={i} delay={i * 0.05}>
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-5 text-left font-display font-medium hover:bg-muted/50 transition-colors"
                  >
                    {faq.q}
                    <ChevronDown
                      className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform duration-200 ${
                        openFaq === i ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <motion.div
                    initial={false}
                    animate={{ height: openFaq === i ? "auto" : 0, opacity: openFaq === i ? 1 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <p className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                  </motion.div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[150px]" />
        </div>

        <FadeIn className="relative z-10 text-center max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold font-display tracking-tight mb-6">
            PRONTO PARA ORGANIZAR
            <br />
            <span className="bg-gradient-primary bg-clip-text text-transparent">SUA VIDA INTEIRA?</span>
          </h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
            Junte-se a quem já organiza finanças, estudos e saúde pelo WhatsApp.
            <br />
            Comece agora.
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/auth")}
            className="gap-2 text-base px-10 h-14 rounded-2xl shadow-glow-md"
          >
            COMEÇAR AGORA <ArrowRight className="h-5 w-5" />
          </Button>
        </FadeIn>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-border px-6 py-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <OrbeIcon size={24} />
            <span className="font-display font-semibold">ORBE</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Funcionalidades</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Preços</a>
            <a href="/auth" className="hover:text-foreground transition-colors">Entrar</a>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} ORBE • Seu universo organizado
          </p>
        </div>
      </footer>
    </div>
  );
}
