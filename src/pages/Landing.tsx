import { motion } from "framer-motion";
import { OrbeIcon } from "@/components/OrbeIcon";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Wallet, GraduationCap, Dumbbell, CheckSquare } from "lucide-react";

const features = [
  {
    icon: Wallet,
    title: "Financeiro",
    desc: "Controle de gastos, planilha doméstica e consultor financeiro com IA.",
    available: true,
  },
  {
    icon: GraduationCap,
    title: "Estudos",
    desc: "Agenda acadêmica, chatbots por disciplina e lembretes inteligentes.",
    available: false,
  },
  {
    icon: Dumbbell,
    title: "Fit",
    desc: "Plano de treino e alimentação personalizado com IA nutricionista.",
    available: false,
  },
  {
    icon: CheckSquare,
    title: "Tarefas",
    desc: "Gestão de tarefas integrada a todos os módulos do seu ORBE.",
    available: false,
  },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 flex flex-col items-center"
        >
          <OrbeIcon size={80} className="mb-8 animate-float" />

          <h1 className="text-5xl md:text-7xl font-bold font-display tracking-tight mb-4">
            ORBE
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-lg mb-8">
            Seu universo pessoal organizado.
            <br />
            Finanças, estudos e saúde num só lugar.
          </p>

          <div className="flex gap-3">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="gap-2 font-display"
            >
              Começar agora <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/auth")}
              className="font-display"
            >
              Entrar
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 max-w-5xl mx-auto w-full">
        <motion.h2
          className="text-3xl font-bold font-display text-center mb-12"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          Tudo no seu ORBE
        </motion.h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative rounded-xl border border-border bg-card p-6 flex flex-col"
            >
              {!f.available && (
                <span className="absolute top-3 right-3 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  Em breve
                </span>
              )}
              <f.icon className="h-8 w-8 text-primary mb-4" />
              <h3 className="font-display font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} ORBE. Seu mundo organizado.
      </footer>
    </div>
  );
}
