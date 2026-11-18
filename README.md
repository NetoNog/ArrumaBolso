# ArrumaBolso

Painel de inteligência financeira pessoal: faturas do Nubank, parcelas, assinaturas, orçamento por categoria e projeção de 12 meses.

## Rodando

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

O app exige login: sem sessão, qualquer rota redireciona para `/login`. Toda conta nova começa vazia — o usuário cadastra categorias, lançamentos e importa as próprias faturas.

## Verificação

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## Supabase (obrigatório)

1. Execute `supabase/schema.sql` no SQL Editor (tabelas, índices, RLS por `auth.uid()`).
2. Copie `.env.example` para `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Crie uma conta em `/login`.

## Entradas, saídas e salário

- **Entradas & Saídas** (`/fluxo`): entradas = receitas do mês; saídas = despesas de qualquer forma de pagamento. Pagamentos de fatura não contam (seriam contados em dobro, já que os gastos do cartão estão nas saídas). A competência é a mesma do resto do app: o ciclo da fatura.
- **Salário & Renda** (`/renda`): fontes de renda (`income_sources`) com valor líquido e dia de pagamento. Cada recebimento vira uma receita vinculada à fonte (`transactions.income_source_id`). A soma das fontes ativas é a renda esperada da Projeção; sem fontes, vale a renda manual.

## Arquitetura

| Camada | Local |
| --- | --- |
| Tipos de domínio | `src/lib/domain/types.ts` |
| Operações de CRUD (funções puras) | `src/lib/domain/operations.ts` |
| Motor de importação/conciliação do CSV | `src/lib/nubank-parser.ts` |
| Métricas, alertas, projeção, entradas/saídas e renda | `src/lib/finance/metrics.ts` |
| Repositório (Supabase) | `src/lib/data/repository.ts` |
| Proteção de rotas (redirect para `/login`) | `src/proxy.ts` |
| Store React | `src/lib/store/finance-store.tsx` |
| Telas | `src/components/views/*`, rotas em `src/app/(app)/*` |

### Matriz de reimportação

| Situação do `unique_hash` | Resultado |
| --- | --- |
| Novo e fora da lista de bloqueio | Inserido (`source: csv`), com regras aplicadas e parcelas futuras projetadas |
| Já existe e foi editado pelo usuário | Protegido: nada é sobrescrito |
| Já existe e não foi editado | Ignorado (sem duplicar) |
| Na lista `deleted_csv_hashes` | Ignorado; pode ser restaurado na pré-visualização |
| Lançamento manual | Nunca é tocado |

`hash = SHA256(data | título bruto | valor com 2 casas | índice de ocorrência no mesmo dia)`.
