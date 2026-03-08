import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

/* ═══════════════════════════════════════════════
   ORBE Landing Page — Faithful reproduction of orbe.html
   ═══════════════════════════════════════════════ */

/* ── Scroll fade-up observer hook ── */
function useFadeUp() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const els = ref.current.querySelectorAll(".fade-up");
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("visible"); }),
      { threshold: 0.1 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
  return ref;
}

/* ── Custom cursor ── */
function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mx = 0, my = 0, tx = 0, ty = 0;
    const onMove = (e: MouseEvent) => {
      mx = e.clientX; my = e.clientY;
      if (cursorRef.current) {
        cursorRef.current.style.left = mx - 6 + "px";
        cursorRef.current.style.top = my - 6 + "px";
      }
    };
    const onDown = () => { if (cursorRef.current) cursorRef.current.style.transform = "scale(2)"; };
    const onUp = () => { if (cursorRef.current) cursorRef.current.style.transform = "scale(1)"; };

    let raf: number;
    const animTrail = () => {
      tx += (mx - tx) * 0.15;
      ty += (my - ty) * 0.15;
      if (trailRef.current) {
        trailRef.current.style.left = tx - 18 + "px";
        trailRef.current.style.top = ty - 18 + "px";
      }
      raf = requestAnimationFrame(animTrail);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("mouseup", onUp);
    animTrail();

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("mouseup", onUp);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div ref={cursorRef} className="landing-cursor" />
      <div ref={trailRef} className="landing-cursor-trail" />
    </>
  );
}

/* ── FAQ toggle ── */
function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div className={`landing-faq-item ${open ? "open" : ""}`}>
      <button className="landing-faq-q" onClick={onToggle}>
        <span className="landing-faq-q-text">{q}</span>
        <span className="landing-faq-icon">+</span>
      </button>
      <div className="landing-faq-a">
        <p>{a}</p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   MAIN LANDING COMPONENT
   ══════════════════════════════════════════ */
export default function Landing() {
  const navigate = useNavigate();
  const containerRef = useFadeUp();
  const [pricePeriod, setPricePeriod] = useState<"mensal" | "trimestral" | "anual">("mensal");
  const [openFaq, setOpenFaq] = useState(0);

  const toggleFaq = useCallback((i: number) => {
    setOpenFaq((prev) => (prev === i ? -1 : i));
  }, []);

  const prices: Record<string, { basic: number; student: number; full: number; fit: number }> = {
    mensal: { basic: 19, student: 29, full: 44, fit: 24 },
    trimestral: { basic: 16, student: 24, full: 37, fit: 20 },
    anual: { basic: 13, student: 19, full: 29, fit: 16 },
  };

  const currentPrices = prices[pricePeriod];

  return (
    <div ref={containerRef} className="landing-root">
      <CustomCursor />

      {/* ══ NAVBAR ══ */}
      <nav className="landing-nav">
        <div className="landing-nav-logo">ORBE<span>.</span></div>
        <ul className="landing-nav-links">
          <li><a href="#modules">Módulos</a></li>
          <li><a href="#estudos">Estudos</a></li>
          <li><a href="#fit">Fit</a></li>
          <li><a href="#pricing">Preços</a></li>
          <li><a href="#faq">FAQ</a></li>
        </ul>
        <div className="landing-nav-cta">
          <button className="landing-btn-nav-ghost" onClick={() => navigate("/auth")}>Entrar</button>
          <button className="landing-btn-nav" onClick={() => navigate("/auth")}>Começar Agora</button>
        </div>
      </nav>

      {/* ══ HERO ══ */}
      <section id="hero" className="landing-hero">
        <div className="landing-hero-bg" />
        <div className="landing-hero-left">
          <div className="landing-hero-badge">
            <div className="landing-hero-badge-dot" />
            <span>Seu universo pessoal, organizado</span>
          </div>
          <h1 className="landing-hero-title">
            <span className="line1">SEU <span className="accent">ORBE</span></span>
            <span className="line2">FINANCEIRO</span>
            <span className="line2">ACADÊMICO</span>
            <span className="line1">& FIT</span>
          </h1>
          <p className="landing-hero-sub">
            Um super-assistente que organiza finanças domésticas, estudos e saúde numa única plataforma. Via WhatsApp e Web. Com IA especializada em cada área.
          </p>
          <div className="landing-hero-actions">
            <button className="landing-btn-primary" onClick={() => navigate("/auth")}>
              Começar Agora — Grátis 7 dias
            </button>
            <button className="landing-btn-secondary">
              <span>Ver Demo</span>
              <span>↗</span>
            </button>
          </div>
          <div className="landing-hero-stats">
            <div className="landing-stat">
              <div className="landing-stat-num">4</div>
              <div className="landing-stat-label">Módulos Integrados</div>
            </div>
            <div className="landing-stat">
              <div className="landing-stat-num">100%</div>
              <div className="landing-stat-label">Via WhatsApp</div>
            </div>
            <div className="landing-stat">
              <div className="landing-stat-num">24h</div>
              <div className="landing-stat-label">IA Disponível</div>
            </div>
          </div>
        </div>

        <div className="landing-hero-right">
          {/* WhatsApp Card */}
          <div className="landing-float-card landing-card-whatsapp">
            <div className="landing-card-header">
              <div className="landing-card-avatar">O</div>
              <div>
                <div className="landing-card-name">ORBE Assistant</div>
              </div>
              <div className="landing-online-dot" />
            </div>
            <div className="landing-msg-bubble">
              Gastei R$450 no supermercado 🛒
              <div className="landing-msg-time">09:30</div>
            </div>
            <div className="landing-msg-bubble reply">
              ✅ Registado! Alimentação: R$450<br />
              ⚠️ Restam R$320 no orçamento de compras.
              <div className="landing-msg-time">09:30</div>
            </div>
            <div className="landing-msg-bubble">
              Prova de Cálculo na sexta!
              <div className="landing-msg-time">14:00</div>
            </div>
            <div className="landing-msg-bubble reply">
              📚 Adicionado! Lembrete em 3 dias e 1 dia antes. Quer que eu crie um plano de revisão?
              <div className="landing-msg-time">14:00</div>
            </div>
          </div>

          {/* Finance Card */}
          <div className="landing-float-card landing-card-finance" style={{ animationDelay: "-2s" }}>
            <div className="landing-finance-label">Saldo do Mês</div>
            <div className="landing-finance-value">R$1.840</div>
            <div className="landing-finance-bar">
              <div className="landing-finance-fill" />
            </div>
            <div className="landing-finance-sub">62% do salário comprometido</div>
          </div>

          {/* Study Card */}
          <div className="landing-float-card landing-card-study" style={{ animationDelay: "-4s" }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" as const, color: "var(--amber)", marginBottom: "12px" }}>Agenda de Hoje</div>
            <div className="landing-study-row">
              <div className="landing-study-dot" style={{ background: "#60a5fa" }} />
              <div className="landing-study-info">
                <div className="landing-study-subject">Cálculo II</div>
                <div className="landing-study-time">08:00 — 10:00</div>
              </div>
              <div className="landing-study-badge">AULA</div>
            </div>
            <div className="landing-study-row">
              <div className="landing-study-dot" style={{ background: "#f87171" }} />
              <div className="landing-study-info">
                <div className="landing-study-subject">Anatomia</div>
                <div className="landing-study-time">Prova em 3 dias</div>
              </div>
              <div className="landing-study-badge" style={{ background: "rgba(248,113,113,0.15)", color: "#f87171", borderColor: "rgba(248,113,113,0.2)" }}>PROVA</div>
            </div>
            <div className="landing-study-row">
              <div className="landing-study-dot" style={{ background: "#4ade80" }} />
              <div className="landing-study-info">
                <div className="landing-study-subject">Treino — PUSH</div>
                <div className="landing-study-time">19:00 — 20:30</div>
              </div>
              <div className="landing-study-badge" style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80", borderColor: "rgba(74,222,128,0.2)" }}>FIT</div>
            </div>
          </div>

          {/* Fit Card */}
          <div className="landing-float-card landing-card-fit" style={{ animationDelay: "-1s" }}>
            <div className="landing-fit-ring">
              <div className="landing-fit-ring-fill" />
              <div className="landing-fit-pct">78%</div>
            </div>
            <div className="landing-fit-label">Meta Semanal</div>
            <div className="landing-fit-sub">5/7 treinos realizados</div>
          </div>
        </div>
      </section>

      {/* ══ MARQUEE ══ */}
      <div className="landing-marquee-section">
        <div className="landing-marquee-track">
          {[...Array(2)].map((_, rep) => (
            <span key={rep} style={{ display: "contents" }}>
              {["Finanças Domésticas", "Planilha Inteligente", "IA Especialista por Matéria", "Plano Alimentar Personalizado", "Lembretes de Provas", "Nutricionista IA", "100% WhatsApp", "Alertas de Orçamento", "Metas de Poupança", "Treinos Personalizados", "Controle de IMC", "Agenda Acadêmica"].map((item) => (
                <span key={`${rep}-${item}`} className="landing-marquee-item">
                  <span className="dot" />
                  {item}
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ══ MODULES ══ */}
      <section id="modules" className="landing-section landing-modules">
        <div className="landing-modules-header fade-up">
          <div>
            <div className="landing-section-label">Arsenal Completo</div>
            <div className="landing-section-title">QUATRO<br />MÓDULOS</div>
          </div>
          <div>
            <p className="landing-section-sub">ORBE integra finanças domésticas, organização acadêmica, saúde física e tarefas gerais num único ecossistema inteligente. Tudo conectado. Tudo via WhatsApp.</p>
          </div>
        </div>

        <div className="landing-modules-grid">
          {[
            { num: "01", emoji: "💰", name: "Financeiro", desc: "Planilha doméstica inteligente que desconta gastos do salário em tempo real. Registro via WhatsApp, leitura de recibos por IA, alertas de limite e metas de poupança.", features: ["Planilha doméstica com saldo em tempo real", "Registro por texto, áudio ou foto", "Alertas de vencimento e limite", "Dashboard com gráficos e histórico", "Consultor financeiro IA 24h"] },
            { num: "02", emoji: "📚", name: "Estudos", desc: "Agenda acadêmica completa com lembretes de provas, trabalhos e aulas. Cada disciplina tem seu próprio chatbot IA especialista na área.", features: ["Calendário por disciplina e horários", "Lembretes de provas, trabalhos e atividades", "IA especialista por matéria", "Simulados e correção automática", "Upload de materiais para a IA analisar"] },
            { num: "03", emoji: "💪", name: "Fit", desc: "Plano de treino e alimentação 100% personalizado combinando seu objetivo, IMC, orçamento e estilo alimentar. Nutricionista IA disponível 24h.", features: ["Plano alimentar por orçamento e objetivo", "Suporte a veganos, vegetarianos e mais", "Lembretes de treino e refeições", "Acompanhamento de IMC e evolução", "Nutricionista pessoal IA"] },
            { num: "04", emoji: "✅", name: "Tarefas", desc: "Criação de tarefas por texto ou voz via WhatsApp. Lembretes automáticos. Integrado com agenda de estudos, finanças e treinos.", features: ["Criação por voz, texto ou foto", "Lembretes automáticos configuráveis", "Integração com todos os módulos", "Prioridade e categorização automática"] },
          ].map((m, i) => (
            <div key={m.num} className={`landing-module-card fade-up ${i > 0 ? `fade-up-delay-${i}` : ""}`}>
              <div className="landing-module-num">{m.num}</div>
              <div className="landing-module-icon">{m.emoji}</div>
              <div className="landing-module-name">{m.name}</div>
              <p className="landing-module-desc">{m.desc}</p>
              <div className="landing-module-features">
                {m.features.map((f) => (
                  <div key={f} className="landing-module-feature">{f}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ PLANILHA DEMO ══ */}
      <section id="planilha" className="landing-section landing-planilha">
        <div className="landing-planilha-wrapper">
          <div className="landing-planilha-preview fade-up">
            <div className="landing-planilha-topbar">
              <div className="landing-planilha-title">Planilha Doméstica</div>
              <div className="landing-planilha-month">Janeiro 2026</div>
            </div>
            <div className="landing-planilha-salary">
              <div><div className="landing-salary-label">Salário Recebido</div></div>
              <div className="landing-salary-value">R$ 4.800</div>
            </div>
            <div className="landing-planilha-table">
              <div className="landing-pt-head">
                <span>Gasto</span>
                <span>Categoria</span>
                <span style={{ textAlign: "right" }}>Valor</span>
                <span style={{ textAlign: "right" }}>Status</span>
              </div>
              {[
                { name: "Aluguel", cat: "Moradia", val: "-R$1.200", status: "pago" },
                { name: "Conta de Luz", cat: "Utilities", val: "-R$180", status: "pago" },
                { name: "Alimentação", cat: "Comida", val: "-R$850", status: "pago" },
                { name: "Internet", cat: "Utilities", val: "-R$120", status: "pend", statusText: "⏳ Vence dia 15" },
                { name: "Academia", cat: "Saúde", val: "-R$80", status: "pend", statusText: "⏳ Pendente" },
                { name: "Transporte", cat: "Mobilidade", val: "-R$370", status: "pago" },
              ].map((row) => (
                <div key={row.name} className="landing-pt-row">
                  <div className="landing-pt-name">{row.name}</div>
                  <div className="landing-pt-cat">{row.cat}</div>
                  <div className="landing-pt-val">{row.val}</div>
                  <div className={`landing-pt-status ${row.status === "pago" ? "status-pago" : "status-pend"}`}>
                    {row.status === "pago" ? "✓ Pago" : row.statusText}
                  </div>
                </div>
              ))}
            </div>
            <div className="landing-planilha-saldo">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" as const, color: "var(--grey)" }}>Saldo Restante</div>
                <div className="landing-saldo-restante">R$ 2.000</div>
              </div>
              <div className="landing-saldo-bar-bg"><div className="landing-saldo-bar-fill" /></div>
              <div className="landing-saldo-info">
                <span>Comprometido: R$2.800 (58%)</span>
                <span>Projeção final: R$1.800</span>
              </div>
            </div>
          </div>
          <div className="fade-up fade-up-delay-1">
            <div className="landing-section-label">Módulo Financeiro</div>
            <div className="landing-section-title">PLANILHA<br /><span style={{ color: "var(--amber)" }}>DOMES-<br />TICA</span></div>
            <p className="landing-section-sub">Cadastre seu salário e seus gastos fixos e variáveis. O ORBE desconta automaticamente cada despesa e mostra quanto você ainda tem disponível — com alertas antes do dinheiro acabar.</p>
            <div className="landing-planilha-features" style={{ marginTop: "32px" }}>
              {["Desconto automático do salário", "Alertas de vencimento em tempo real", "Categorias e status de pagamento", "Projeção de saldo no fim do mês"].map((f) => (
                <div key={f} className="landing-module-feature">{f}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ ESTUDOS ══ */}
      <section id="estudos" className="landing-section landing-estudos">
        <div className="landing-estudos-wrapper">
          <div className="landing-estudos-content fade-up">
            <div className="landing-section-label">Módulo de Estudos</div>
            <div className="landing-section-title">AGENDA<br /><span style={{ color: "var(--amber)" }}>ACADÊ-<br />MICA</span></div>
            <p className="landing-section-sub" style={{ marginBottom: "40px" }}>Cada disciplina tem sua IA especialista. Agenda de provas, trabalhos e aulas com lembretes automáticos. Crie simulados, tire dúvidas e receba correções — 24h por dia.</p>
            <div className="landing-agenda-preview">
              {[
                { day: "15", month: "Jan", subject: "Cálculo II — P2", detail: "Integrais Duplas • Sala 405", type: "Prova", typeClass: "type-prova" },
                { day: "17", month: "Jan", subject: "Entrega TCC — Capítulo 2", detail: "Metodologia • Via Plataforma até 23:59", type: "Trabalho", typeClass: "type-trabalho" },
                { day: "20", month: "Jan", subject: "Revisão — Cálculo II", detail: "Integrais • Agendado pelo ORBE", type: "Revisão", typeClass: "type-revisao" },
                { day: "22", month: "Jan", subject: "Direito Constitucional", detail: "Aula 08:00 • Direitos Fundamentais", type: "Aula", typeClass: "type-aula" },
              ].map((item) => (
                <div key={item.subject} className="landing-agenda-item">
                  <div className="landing-agenda-date">
                    <div className="landing-agenda-day">{item.day}</div>
                    <div className="landing-agenda-month">{item.month}</div>
                  </div>
                  <div className="landing-agenda-info">
                    <div className="landing-agenda-subject">{item.subject}</div>
                    <div className="landing-agenda-detail">{item.detail}</div>
                  </div>
                  <div className={`landing-agenda-type ${item.typeClass}`}>{item.type}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="landing-chat-preview fade-up fade-up-delay-1">
            <div className="landing-chat-topbar">
              <div className="landing-chat-subject-icon">∫</div>
              <div>
                <div className="landing-chat-subject-name">Cálculo II</div>
                <div className="landing-chat-role">Professor Especialista em Matemática</div>
              </div>
              <div className="landing-online-dot" />
            </div>
            <div className="landing-chat-messages">
              <div className="landing-chat-msg user">
                <div className="sender">Você</div>
                Não entendo como resolver integrais por partes. Pode me explicar com um exemplo?
              </div>
              <div className="landing-chat-msg ai">
                <div className="sender">IA — Prof. Cálculo</div>
                Claro! Integração por partes usa a fórmula ∫u dv = uv − ∫v du. Vamos resolver ∫x·eˣ dx juntos: escolhemos u=x (simples de derivar) e dv=eˣ dx (simples de integrar)...
              </div>
              <div className="landing-chat-msg user">
                <div className="sender">Você</div>
                Pode criar 5 questões para eu treinar?
              </div>
              <div className="landing-chat-msg ai">
                <div className="sender">IA — Prof. Cálculo</div>
                Com certeza! Questão 1: Calcule ∫x·cos(x)dx. Questão 2: ∫ln(x)dx. Questão 3: ∫x²·eˣ dx...
              </div>
            </div>
            <div className="landing-chat-input-area">
              <div className="landing-chat-input-fake">Pergunte qualquer coisa sobre Cálculo II...</div>
              <div className="landing-chat-send">→</div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FIT ══ */}
      <section id="fit" className="landing-section landing-fit">
        <div className="landing-fit-wrapper">
          <div className="landing-fit-content fade-up">
            <div className="landing-section-label">Módulo Fit</div>
            <div className="landing-section-title">CORPO<br /><span style={{ color: "var(--amber)" }}>TREINO</span><br />& DIETA</div>
            <p className="landing-section-sub" style={{ marginBottom: "40px" }}>IA que cria seu plano alimentar e de treino combinando objetivo, IMC, orçamento e estilo de vida. Suporte completo para veganos, vegetarianos, pescetarianos e mais.</p>
            <div className="landing-fit-features">
              {[
                { title: "🎯 Objetivo Personalizado", desc: "Perda de gordura, hipertrofia, ganho de massa ou condicionamento" },
                { title: "🥗 Plano Alimentar IA", desc: "Gerado com base no seu orçamento, restrições e estilo alimentar" },
                { title: "🏋️ Treino Adaptado", desc: "Academia, casa ou ar livre. Com o que você tem disponível" },
                { title: "🧬 Restrições Alimentares", desc: "Alergias, intolerâncias, grupos nutricionais e condições médicas" },
                { title: "👩‍⚕️ Nutricionista IA 24h", desc: "Reporte avanços, peça ajustes, tire dúvidas a qualquer momento" },
                { title: "🔔 Lembretes de Treino", desc: "Notificações de treino, refeições e hidratação via WhatsApp" },
              ].map((f) => (
                <div key={f.title} className="landing-fit-feat">
                  <div className="landing-fit-feat-title">{f.title}</div>
                  <div className="landing-fit-feat-desc">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="landing-fit-preview-section fade-up fade-up-delay-1">
            <div className="landing-fit-card-main">
              <div className="landing-fit-header">
                <div>
                  <div className="landing-fit-header-title">João Silva — Hipertrofia</div>
                  <div className="landing-fit-header-sub">78kg · 1,78m · IMC 24.6</div>
                </div>
                <div className="landing-imc-badge">IMC Normal</div>
              </div>
              <div className="landing-fit-rings">
                {[
                  { val: "72%", color: "var(--amber)", pct: 72 },
                  { val: "58%", color: "#60a5fa", pct: 58 },
                  { val: "85%", color: "#4ade80", pct: 85 },
                ].map((ring, idx) => (
                  <div key={idx} className="landing-fit-ring-item">
                    <div className="landing-ring-outer">
                      <div className="landing-ring-bg" />
                      <div className="landing-ring-prog" style={{ background: `conic-gradient(${ring.color} 0% ${ring.pct}%, transparent ${ring.pct}%)` }} />
                      <div className="landing-ring-val" style={{ color: ring.color }}>{ring.val}</div>
                    </div>
                    <div className="landing-ring-name">{["Meta", "Treinos", "Dieta"][idx]}</div>
                    <div className="landing-ring-goal">{["Hipertrofia", "Esta semana", "Aderência"][idx]}</div>
                  </div>
                ))}
              </div>
              <div className="landing-fit-macros">
                <div className="landing-macro-item">
                  <div className="landing-macro-val macro-p">156g</div>
                  <div className="landing-macro-label">Proteína</div>
                </div>
                <div className="landing-macro-item">
                  <div className="landing-macro-val macro-c">240g</div>
                  <div className="landing-macro-label">Carboidrato</div>
                </div>
                <div className="landing-macro-item">
                  <div className="landing-macro-val macro-g">65g</div>
                  <div className="landing-macro-label">Gordura</div>
                </div>
              </div>
              <div className="landing-fit-treino">
                <div className="landing-treino-title">Divisão Semanal</div>
                <div className="landing-treino-days">
                  {[
                    { day: "SEG", split: "PUSH", cls: "active" },
                    { day: "TER", split: "PULL", cls: "active" },
                    { day: "QUA", split: "LEGS", cls: "active" },
                    { day: "QUI", split: "PUSH", cls: "today" },
                    { day: "SEX", split: "PULL", cls: "" },
                    { day: "SAB", split: "LEGS", cls: "" },
                    { day: "DOM", split: "REST", cls: "" },
                  ].map((d) => (
                    <div key={d.day} className={`landing-treino-day ${d.cls}`}>
                      {d.day}<br /><small>{d.split}</small>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FEATURES ══ */}
      <section id="features" className="landing-section landing-features">
        <div className="fade-up">
          <div className="landing-section-label">Funcionalidades</div>
          <div className="landing-section-title">ARSENAL<br />COMPLETO</div>
        </div>
        <div className="landing-features-grid">
          {[
            { emoji: "📱", name: "WhatsApp Nativo", desc: "Texto, áudio ou foto. O ORBE extrai os dados automaticamente. Sem apps extras para baixar." },
            { emoji: "📸", name: "Leitura de Recibos", desc: "Tire foto do recibo. A IA extrai valor, data, categoria e estabelecimento em segundos." },
            { emoji: "🔔", name: "Alertas Inteligentes", desc: "Limites financeiros, vencimentos, provas, treinos e refeições. Tudo com antecedência configurável." },
            { emoji: "🧠", name: "IA Especialista", desc: "Cada módulo tem sua IA especializada: financeiro, professor, nutricionista e personal trainer." },
            { emoji: "📊", name: "Gráficos Completos", desc: "Dashboard com evolução financeira, progresso físico e desempenho acadêmico em um só lugar." },
            { emoji: "🎯", name: "Metas & Progresso", desc: "Defina metas financeiras, físicas e acadêmicas. O ORBE acompanha e te motiva automaticamente." },
            { emoji: "🌿", name: "Dietas Especiais", desc: "Vegetariano, vegano, pescetariano, flexitariano. Plano alimentar adaptado ao seu estilo de vida." },
            { emoji: "🔒", name: "Dados Seguros", desc: "Encriptação de ponta a ponta. Seus dados financeiros, acadêmicos e de saúde protegidos." },
          ].map((f, i) => (
            <div key={f.name} className={`landing-feat-card fade-up ${i > 0 ? `fade-up-delay-${(i % 4)}` : ""}`}>
              <div className="landing-feat-num">{String(i + 1).padStart(2, "0")}</div>
              <span className="landing-feat-icon">{f.emoji}</span>
              <div className="landing-feat-name">{f.name}</div>
              <p className="landing-feat-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ TESTIMONIALS ══ */}
      <section id="testimonials" className="landing-section landing-testimonials">
        <div className="landing-test-header fade-up">
          <div className="landing-section-label" style={{ justifyContent: "center" }}>Usuários</div>
          <div className="landing-section-title" style={{ textAlign: "center" }}>
            QUEM USA ORBE<br /><span style={{ color: "var(--amber)" }}>DOMINA A VIDA</span>
          </div>
        </div>
        <div className="landing-test-grid">
          {[
            { initials: "MS", name: "Maria Santos", role: "Empreendedora · São Paulo", text: "A planilha doméstica mudou tudo. Agora sei exatamente quanto tenho, quanto gastei e quanto vai sobrar. Paguei todas as contas em dia pelo primeiro mês.", stat: "R$620", statLabel: "ECONOMIZADOS EM 30 DIAS" },
            { initials: "JM", name: "João Machava", role: "Estudante de Medicina · BH", text: "O chatbot de Anatomia é incrível. É como ter um professor disponível 24h. Passei na prova que achei que ia reprovar com a ajuda do ORBE.", stat: "9.2", statLabel: "NOTA NA PROVA DE ANATOMIA" },
            { initials: "AT", name: "Ana Tembe", role: "Professora · Belo Horizonte", text: "Sou vegana e sempre tive dificuldade de montar dietas com orçamento limitado. O ORBE criou um plano perfeito respeitando tudo. Perdi 6kg em 2 meses.", stat: "-6kg", statLabel: "EM 60 DIAS COM PLANO VEGANO" },
            { initials: "CM", name: "Carlos Mondlane", role: "Freelancer · Rio de Janeiro", text: "Como freelancer com renda variável, o módulo financeiro me ajudou a criar uma reserva pelo primeiro mês da minha vida. O consultor IA é sensacional.", stat: "+40%", statLabel: "DE ECONOMIA VERSUS ANO PASSADO" },
          ].map((t, i) => (
            <div key={t.name} className={`landing-test-card fade-up ${i > 0 ? `fade-up-delay-${i}` : ""}`}>
              <div className="landing-test-quote">"</div>
              <p className="landing-test-text">{t.text}</p>
              <div className="landing-test-stat">{t.stat}</div>
              <div className="landing-test-stat-label">{t.statLabel}</div>
              <div className="landing-test-author">
                <div className="landing-test-avatar">{t.initials}</div>
                <div>
                  <div className="landing-test-name">{t.name}</div>
                  <div className="landing-test-role">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ PRICING ══ */}
      <section id="pricing" className="landing-section landing-pricing">
        <div className="landing-pricing-header fade-up">
          <div className="landing-section-label" style={{ justifyContent: "center" }}>Planos</div>
          <div className="landing-section-title" style={{ textAlign: "center" }}>
            ESCOLHA<br />SEU <span style={{ color: "var(--amber)" }}>ORBE</span>
          </div>
          <p className="landing-section-sub" style={{ margin: "0 auto", textAlign: "center" }}>Quanto mais tempo, maior o desconto. Acesso imediato. Cancele quando quiser.</p>
        </div>

        <div className="landing-pricing-toggle fade-up">
          <button className={`landing-toggle-btn ${pricePeriod === "mensal" ? "active" : ""}`} onClick={() => setPricePeriod("mensal")}>Mensal</button>
          <button className={`landing-toggle-btn ${pricePeriod === "trimestral" ? "active" : ""}`} onClick={() => setPricePeriod("trimestral")}>Trimestral <span className="landing-toggle-badge">-17%</span></button>
          <button className={`landing-toggle-btn ${pricePeriod === "anual" ? "active" : ""}`} onClick={() => setPricePeriod("anual")}>Anual <span className="landing-toggle-badge">-33%</span></button>
        </div>

        <div className="landing-pricing-grid fade-up">
          {[
            { plan: "Basic", price: currentPrices.basic, period: "Módulo Financeiro", features: ["Planilha doméstica inteligente", "Registro via WhatsApp", "Alertas de vencimento", "Dashboard financeiro"], disabled: ["Módulo de Estudos", "Módulo Fit"], featured: false },
            { plan: "Student", price: currentPrices.student, period: "Financeiro + Estudos", features: ["Tudo do Basic", "Agenda acadêmica completa", "IA especialista por matéria", "Lembretes de provas e trabalhos", "Simulados com correção IA"], disabled: ["Módulo Fit"], featured: false },
            { plan: "Full", price: currentPrices.full, period: "Todos os Módulos", features: ["Tudo do Student", "Plano alimentar IA personalizado", "Plano de treino adaptado", "Nutricionista IA 24h", "Lembretes de treino e dieta", "Suporte prioritário"], disabled: [], featured: true },
            { plan: "Fit Only", price: currentPrices.fit, period: "Financeiro + Fit", features: ["Tudo do Basic", "Plano alimentar personalizado", "Divisão de treinos IA", "Nutricionista pessoal IA", "Acompanhamento de IMC"], disabled: ["Módulo de Estudos"], featured: false },
          ].map((p) => (
            <div key={p.plan} className={`landing-price-card ${p.featured ? "featured" : ""}`}>
              {p.featured && <div className="landing-price-popular">Mais Popular</div>}
              <div className="landing-price-plan">{p.plan}</div>
              <div className="landing-price-val"><sup>R$</sup>{p.price}</div>
              <div className="landing-price-period">/mês · {p.period}</div>
              <div className="landing-price-divider" />
              <div className="landing-price-features">
                {p.features.map((f) => (
                  <div key={f} className="landing-pf-item">{f}</div>
                ))}
                {p.disabled.map((f) => (
                  <div key={f} className="landing-pf-item disabled">{f}</div>
                ))}
              </div>
              <button className={`landing-btn-price ${p.featured ? "featured-btn" : ""}`} onClick={() => navigate("/auth")}>
                {p.featured ? "Começar Agora" : "Começar"}
              </button>
            </div>
          ))}
        </div>

        <div className="landing-price-guarantee fade-up">
          🔒 <span>Garantia de 7 dias.</span> Se não gostar, devolvemos 100% do seu dinheiro. Sem perguntas.
        </div>
      </section>

      {/* ══ FAQ ══ */}
      <section id="faq" className="landing-section landing-faq">
        <div className="landing-faq-wrapper">
          <div className="fade-up">
            <div className="landing-section-label">Dúvidas</div>
            <div className="landing-section-title">PER-<br />GUN-<br />TAS</div>
          </div>
          <div className="landing-faq-list fade-up fade-up-delay-1">
            {[
              { q: "O que é o ORBE?", a: "ORBE é um super-assistente pessoal que organiza finanças domésticas, estudos e saúde numa única plataforma. Opera 100% via WhatsApp e tem um dashboard web. Com IA especializada em cada módulo, você controla tudo sem precisar de múltiplos apps." },
              { q: "Como funciona a planilha doméstica?", a: "Você cadastra seu salário e seus gastos fixos e variáveis. O ORBE desconta automaticamente cada despesa conforme são lançadas e mostra o saldo restante em tempo real. Você recebe alertas de vencimento e projeções do mês." },
              { q: "O chatbot de estudos funciona para qualquer matéria?", a: "Sim! Você cadastra suas disciplinas e o ORBE cria um assistente especialista para cada uma. Medicina, Direito, Engenharia, Matemática, História — a IA se adapta ao conteúdo e age como especialista da área." },
              { q: "O plano alimentar respeita restrições como veganismo?", a: "Completamente. O ORBE pergunta sobre seu grupo alimentar (vegano, vegetariano, pescetariano, flexitariano), alergias, intolerâncias e condições médicas. O plano gerado respeita todos esses critérios e ainda se adapta ao seu orçamento." },
              { q: "Posso cancelar quando quiser?", a: "Sim, sem multas ou burocracia. E se não gostar nos primeiros 7 dias, devolvemos 100% do valor pago. Sem perguntas." },
              { q: "Meus dados financeiros e de saúde estão seguros?", a: "Sim. O ORBE usa encriptação de ponta a ponta para todos os dados. Informações financeiras, acadêmicas e de saúde são tratadas com os mais altos padrões de segurança e privacidade." },
            ].map((item, i) => (
              <FaqItem key={i} q={item.q} a={item.a} open={openFaq === i} onToggle={() => toggleFaq(i)} />
            ))}
          </div>
        </div>
      </section>

      {/* ══ CTA FINAL ══ */}
      <section className="landing-section landing-cta-final">
        <div className="fade-up">
          <div className="landing-section-label" style={{ justifyContent: "center" }}>
            <span style={{ width: "30px", height: "1px", background: "var(--amber)", display: "block" }} />
            Pronto para começar
            <span style={{ width: "30px", height: "1px", background: "var(--amber)", display: "block" }} />
          </div>
          <div className="landing-cta-title">
            <span className="outline">SEU UNIVERSO</span><br />
            <span style={{ color: "var(--amber)" }}>ORGANIZADO.</span>
          </div>
          <p className="landing-cta-sub">Junte-se a quem já controla finanças, estudos e saúde num só lugar. Comece agora e sinta a diferença em 7 dias.</p>
          <div className="landing-cta-btns">
            <button className="landing-btn-primary" onClick={() => navigate("/auth")}>Começar Agora — 7 dias grátis</button>
            <button className="landing-btn-secondary">Ver todos os planos ↗</button>
          </div>
          <div className="landing-cta-guarantee">🔒 Sem cartão de crédito necessário · Cancele quando quiser</div>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="landing-footer">
        <div className="landing-footer-top">
          <div className="landing-footer-brand">
            <div className="landing-footer-logo">ORBE<span>.</span></div>
            <p className="landing-footer-tagline">Seu universo pessoal — finanças, estudos e saúde — organizado num só lugar, via WhatsApp.</p>
            <div className="landing-footer-social">
              {["𝕏", "in", "ig", "yt"].map((s) => (
                <div key={s} className="landing-social-btn">{s}</div>
              ))}
            </div>
          </div>
          {[
            { title: "Produto", links: ["Funcionalidades", "Módulo Financeiro", "Módulo Estudos", "Módulo Fit", "Preços"] },
            { title: "Empresa", links: ["Sobre nós", "Blog", "Carreiras", "Contato"] },
            { title: "Legal", links: ["Termos de Uso", "Privacidade", "Cookies", "LGPD"] },
          ].map((col) => (
            <div key={col.title} className="landing-footer-col">
              <h4>{col.title}</h4>
              <ul className="landing-footer-links">
                {col.links.map((link) => (
                  <li key={link}><a href="#">{link}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="landing-footer-bottom">
          <div className="landing-footer-copy">© 2026 <span>ORBE</span> — Todos os direitos reservados · Brasil</div>
          <div className="landing-footer-copy">Feito com ♥ para quem domina a própria vida</div>
        </div>
      </footer>
    </div>
  );
}
