# ArrumaBolso

Painel de inteligência financeira pessoal: faturas do Nubank, parcelas, assinaturas, orçamento por categoria e projeção de 12 meses.

## Rodando

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

No primeiro acesso, o app cria dados de exemplo (fatura Dez/2026 com 23 compras = R$ 1.154,97). Os dados ficam no `localStorage`.
Para testar a reimportação protegida, use `public/samples/Nubank_2026-12-09.csv` (mesma fatura com 2 linhas novas).

## Verificação

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## Supabase (opcional)

1. Execute `supabase/schema.sql` no SQL Editor (tabelas, índices, RLS por `auth.uid()`).
2. Copie `.env.example` para `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Entre em `/login`. Uma conta nova recebe os dados de exemplo gerados pelo mesmo motor de importação, então os `unique_hash` são idênticos aos de uma reimportação real.

## Arquitetura

| Camada | Local |
| --- | --- |
| Tipos de domínio | `src/lib/domain/types.ts` |
| Operações de CRUD (funções puras) | `src/lib/domain/operations.ts` |
| Motor de importação/conciliação do CSV | `src/lib/nubank-parser.ts` |
| Métricas, alertas e projeção | `src/lib/finance/metrics.ts` |
| Repositórios (localStorage / Supabase) | `src/lib/data/repository.ts` |
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
