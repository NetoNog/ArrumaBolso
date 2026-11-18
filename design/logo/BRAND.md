# ArrumaBolso — Guia de Identidade Visual v1.0

Versão navegável: rota `/marca` do app.

## Conceito

Um bolso com as contas em ordem. O símbolo junta o nome (**arruma** + **bolso**) à promessa do produto: três barras alinhadas pela base, em ordem crescente, dentro de um bolso aberto. O que estava bagunçado agora está arrumado, e o próximo mês já está à vista.

Atributos: organizado, previsível, confiável, calmo, preciso.

## Construção

- Quadro de 256 × 256, módulo de 4.
- Bolso: "U" de fundo reto, traço 22, raio externo 52 e interno 30.
- Barras: largura 26, intervalo 10, raio 5, alturas 62 / 94 / 130, base comum em y = 170.
- **Versão reduzida (≤ 32 px):** traço 30, duas barras de 38. Usar em favicons, abas e ícones pequenos.
- Wordmark: Inter Bold (OFL) convertida em contornos, tracking −2,5%. "Arruma" em Tinta e "Bolso" em Azul Bolso.

## Arquivos

| Arquivo | Uso |
| --- | --- |
| `final/lockup-horizontal.svg` | Logo principal |
| `final/lockup-horizontal-on-dark.svg` | Sobre fundos escuros |
| `final/lockup-horizontal-black.svg` / `-white.svg` | Uma cor |
| `final/lockup-stacked.svg` | Espaços quadrados |
| `final/symbol.svg` / `symbol-small.svg` | Símbolo (completo / reduzido) |
| `final/app-icon.svg` / `app-icon-fullbleed.svg` | Ícone de app (cantos arredondados / quadrado para iOS) |
| `final/favicon.svg` | Favicon (versão reduzida em ladrilho) |
| `web/` | favicon.ico, PNGs 16–512, maskable, webmanifest |

Para regenerar após mudar a geometria: `python design/logo/build_brand.py design/logo/fonts/inter-latin-variable.woff2`. Depois, atualize `src/components/brand/brand-paths.ts` a partir de `final/paths.json`.

## Área de proteção e tamanhos mínimos

- Área de proteção = largura de uma barra + intervalo (x) em todos os lados.
- Horizontal: mínimo de 88 px de largura.
- Símbolo completo: mínimo de 24 px. Abaixo disso, usar a versão reduzida.

## Cores

| Nome | HEX | RGB | Papel | Contraste |
| --- | --- | --- | --- | --- |
| Azul Bolso | `#2563EB` | 37 99 235 | Marca, ações primárias | 5,17:1 sobre branco (AA) |
| Tinta | `#0F172A` | 15 23 42 | Texto, "Arruma" | 17,85:1 sobre branco |
| Noite | `#0B1B4D` | 11 27 77 | Fundos de marca | branco sobre ela: 16,4:1 |
| Névoa | `#F8FAFC` | 248 250 252 | Canvas | — |
| Borda | `#E2E8F0` | 226 232 240 | Linhas e cards | — |
| Azul claro (dark) | `#60A5FA` | 96 165 250 | Marca no tema escuro | 6,46:1 sobre Noite |

Semânticas (sinalizam estado, nunca decoram): Alívio `#10B981`, Atenção `#F59E0B`, Alerta `#E11D48`, Recorrência `#8B5CF6`.

Proporção: 80% neutros, 15% Azul Bolso, até 5% semânticas.

## Tipografia

- **Figtree:** interface e títulos, seguindo o design system [Astryx](https://github.com/meta/astryx) (tema neutral). Pesos 600 (títulos), 500 (rótulos) e 400 (texto).
- **Escala tipográfica Astryx:** base 14 px × 1,2 por degrau, alturas de linha em grade de 4 px. Em telas de toque abaixo de 1024 px a base sobe para 16 px (razão 1,1736). Tokens em `src/app/globals.css`.
- **Valores, datas e percentuais:** a própria Figtree com algarismos tabulares (classe `num`), para colunas alinhadas.
- **Logo:** o wordmark continua em Inter Bold (OFL) convertida em contornos; não depende de fonte instalada.

## Padrão gráfico

As três barras do símbolo repetidas em grade de 72 px (componente `BrandPattern`). Usar só em baixa opacidade, em capas e fundos de marca, nunca atrás de números ou tabelas.

## Usos proibidos

Não distorcer, não girar, não trocar cores, não aplicar sombra, contorno ou gradiente, e não recompor o wordmark com outra fonte.

## Voz

Clara, não técnica. Calma, não alarmista. Respeita o controle do usuário.

## Observações legais

A Inter é licenciada sob a SIL Open Font License, que permite uso em logo. Antes de registrar a marca, faça uma busca de anterioridade no INPI.
