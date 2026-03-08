

# ORBE — Fase 1: Módulo Financeiro

## Visão Geral
Construir o módulo financeiro completo do ORBE: uma planilha doméstica interativa no Web App com dashboard de gastos, integração WhatsApp para registro rápido e consultor financeiro via IA.

---

## 1. Estrutura Base e Identidade Visual
- Página de landing com branding ORBE (conceito de esfera/totalidade)
- Layout com sidebar de navegação entre módulos (Financeiro ativo, demais como "Em breve")
- Design escuro/moderno com cores que remetem a finanças (tons de verde/azul)
- Login simples por email com Lovable Cloud (autenticação)

## 2. Banco de Dados (Lovable Cloud)
- Tabela de perfis de usuário
- Tabela de carteiras (múltiplas por usuário)
- Tabela de rendas (salário mensal, fontes de renda)
- Tabela de gastos (nome, categoria, valor, data de vencimento, status pago/pendente, tipo fixo/variável)
- Tabela de categorias (moradia, alimentação, transporte, lazer, etc.)
- Tabela de metas de poupança

## 3. Planilha Doméstica Interativa
- Interface estilo planilha no Web App para lançar gastos
- Campos: nome do gasto, categoria, valor, data de vencimento, tipo (fixo/variável)
- Cadastro de salário/renda mensal
- Desconto automático de cada gasto no saldo
- Saldo restante em tempo real com barra de progresso
- Agrupamento por categorias
- Distinção visual gastos pagos vs. pendentes
- Projeção do mês (quanto sobrará após pagar pendentes)
- Histórico mensal comparativo

## 4. Dashboard Financeiro
- Gráficos de gastos por categoria (pizza e barras)
- Comparativo mensal automático
- Indicadores: renda total, gastos totais, saldo, % comprometido
- Alertas visuais de saldo crítico
- Exportação em PDF

## 5. Integração WhatsApp (Twilio)
- Edge function para receber mensagens do WhatsApp via webhook Twilio
- Registro de gastos por texto ("gastei 50 reais no mercado")
- Leitura de fotos de recibos via IA (extração de valores)
- Alertas de limite e lembretes de vencimento enviados via WhatsApp
- Consultor financeiro IA via WhatsApp (responde com base nos dados do usuário)

## 6. Consultor Financeiro IA
- Chat no Web App com IA especializada em finanças pessoais
- IA tem acesso ao perfil financeiro completo do usuário
- Sugestões personalizadas de economia
- Análise de padrões de gasto
- Usando Lovable AI Gateway (Google Gemini)

---

## Fases Futuras (não incluídas agora)
- Módulo Estudos (calendário acadêmico, chatbots por disciplina)
- Módulo Fit (treinos, nutrição, chatbot fit)
- Módulo Tarefas Gerais
- Sistema de planos pagos (Basic, Student, Fit, Full)

