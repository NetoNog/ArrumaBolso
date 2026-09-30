# 🚀 Plataforma de Gestão Financeira Pessoal & Previsibilidade (Nubank Pro)

Uma aplicação web moderna, modular e de alto padrão estético para Gerenciamento Financeiro Pessoal, desenvolvida para substituir de forma definitiva planilhas anuais, com foco em previsibilidade orçamentária, projeção de fluxo de caixa em 12 meses, indicador de "Burn Rate", motor de parcelamentos e módulo especializado de importação de faturas/extratos Nubank (CSV) com deduplicação e categorização inteligente.

---

## 1. Stack Tecnológica

- **Frontend / Fullstack Framework:** Next.js 14+ (App Router), TypeScript, Tailwind CSS.
- **UI Components & Estilo:** Design system refinado com suporte a Dark Mode / Light Mode, Lucide Icons, Framer Motion e Toasts elegantes via Sonner.
- **Visualização de Dados & Gráficos:** Recharts (Fluxo de caixa projetado 12 meses com barras empilhadas de parcelas, Rosca de despesas por categoria, Termômetro diário de consumo).
- **Backend as a Service & Banco de Dados:** Supabase (PostgreSQL, Row Level Security - RLS, Supabase Auth).
  - Inclui suporte a **Modo Demo & Fallback Local** com persistência no LocalStorage, permitindo testar e demonstrar todas as funcionalidades imediatamente mesmo sem configurar credenciais em nuvem.
- **Manipulação de CSV & Datas:** PapaParse e Date-fns (pt-BR).
- **Formulários & Validação:** React Hook Form + Zod.

---

## 2. Arquitetura do Banco de Dados (Supabase PostgreSQL + RLS)

O script completo DDL de migração está disponível em:
[`supabase/migrations/20240101000000_init_financial_platform.sql`](./supabase/migrations/20240101000000_init_financial_platform.sql)

### Tabelas Criadas:
1. `profiles`: dados do usuário, preferências regionais, salário mensal base e dia de recebimento.
2. `categories`: categorias com ícones, cores e tetos orçamentários mensais.
3. `accounts_and_cards`: contas correntes, investimentos e cartões de crédito (com dia de fechamento e vencimento de fatura).
4. `transactions`: transações com suporte a parcelas (`installment_current`, `installment_total`, `installment_group_id`), despesas fixas recorrentes e `csv_hash` determinístico para deduplicação.
5. `monthly_budgets`: orçamentos mensais estipulados por categoria com percentual de alerta.
6. `financial_goals`: metas de economia e reserva de emergência com prazos e aportes mensais.

---

## 3. Módulo Especializado de Importação Nubank (CSV)

O parser nativo (`src/lib/parsers/nubank-parser.ts`) implementa:
- **Detecção de Formato:** Suporta tanto **Fatura de Cartão de Crédito** (`date,category,title,amount`) quanto **Extrato NuConta** (`Data,Valor,Identificador,Descrição`).
- **Regex de Parcelamentos:** Extrai automaticamente dados de compras parceladas no título (ex: `"Mercado Livre - Parcela 2/6"` ou `"Loja (03/10)"`).
- **Detecção Anti-Duplicação:** Calcula um hash determinístico (`data + valor + titulo`) para sinalizar transações já importadas.
- **Categorização Preditiva:** Mapeia automaticamente nomes de estabelecimentos brasileiros (iFood, Carrefour, Uber, Netflix, Droga Raia, etc.) para categorias do sistema.
- **Conferência em Lote:** Permite selecionar, desmarcar duplicatas e alterar categorias em lote antes de persistir no banco.

Arquivos de teste para demonstração com 1 clique disponíveis em:
- `public/samples/nubank_fatura_exemplo.csv`
- `public/samples/nubank_conta_exemplo.csv`

---

## 4. Indicadores de Previsibilidade

### A. Projeção de Fluxo de Caixa (12 Meses)
O algoritmo preditivo (`src/lib/financial/projection-engine.ts`) projeta a evolução do seu patrimônio nos próximos 12 meses considerando:
- Receitas regulares fixas (salário base).
- Despesas fixas recorrentes (aluguel, condomínio, assinaturas).
- O decaimento real das parcelas de cartão de crédito mês a mês.
- A média ponderada de gastos variáveis e sazonais.

### B. Burn Rate (Ritmo Diário de Consumo)
O termômetro de ritmo diário (`src/lib/financial/burn-rate.ts`) calcula:
- **Limite Diário Seguro:** `Orçamento Restante / Dias Restantes no Mês`.
- **Média Real Gasta:** `Gasto Atual / Dias Decorridos`.
- Alerta visual imediato caso o ritmo atual ultrapasse o limite seguro diário.

---

## 5. Como Executar Localmente

```bash
# 1. Instalar dependências
npm install

# 2. Executar o servidor de desenvolvimento
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000) no seu navegador.
