/**
 * Automatic categorisation engine for imported and existing expenses:
 *   1. User categorisation rules (checked by caller)
 *   2. User's own transaction history (learns from previously categorised merchants)
 *   3. User's own category names (matches custom categories like "Barbearia" or "Café")
 *   4. Built-in Brazilian merchant dictionary (expanded presets)
 *   5. Bank-provided category column (e.g. Inter "Categoria")
 *
 * When a preset matches and the user has no matching category yet, it returns a
 * virtual `preset:<key>` id that is materialised into a real category on confirm.
 */
import { extractInstallment } from "@/lib/categorization";
import { normalizeText } from "@/lib/import/issuers";
import type { Category, CategoryNature, PetExpenseKind, Transaction } from "@/lib/domain/types";

export type PresetKey =
  | "alimentacao"
  | "cafe_padaria"
  | "bares_bebidas"
  | "mercado"
  | "transporte"
  | "combustivel"
  | "manutencao_carro"
  | "videogame"
  | "esportes"
  | "lazer"
  | "musica_shows"
  | "compras"
  | "eletronicos"
  | "assinaturas"
  | "saude"
  | "terapia_bem_estar"
  | "casa"
  | "casa_decoracao"
  | "vestuario"
  | "cuidados"
  | "educacao"
  | "viagem"
  | "pets"
  | "presentes"
  | "trabalho"
  | "seguros_impostos"
  | "investimentos"
  | "transferencias"
  | "servicos"
  | "outros";

export type CategorySuggestionSource = "rule" | "history" | "user_category" | "dictionary" | "bank" | null;

export interface CategoryPreset {
  key: PresetKey;
  name: string;
  icon: string;
  color: string;
  /** Other category names the user may already use for the same thing. */
  aliases: readonly string[];
  /**
   * Merchant keywords, matched as whole words on the normalised title. A trailing
   * `*` matches any word starting with the stem (`farma*` → "farmacia").
   */
  keywords: readonly string[];
}

export const CATEGORY_PRESETS: readonly CategoryPreset[] = [
  {
    key: "alimentacao",
    name: "Alimentação",
    icon: "utensils",
    color: "#F97316",
    aliases: ["comida", "restaurantes", "restaurante", "delivery", "refeicao", "refeicoes", "alimentos"],
    keywords: [
      "ifood", "ifd", "ifd food", "rappi", "99food", "uber eats", "aiqfome",
      "restaura*", "lanchonete", "lanches", "lanche", "pizzaria", "pizza*", "hamburg*", "burger*",
      "mc donalds", "mcdonalds", "mcdonald s", "burger king", "bk", "subway", "habibs", "habib s", "outback", "madero",
      "churrasc*", "sushi*", "temaki", "bistr*", "cantina", "pastel*", "esfiha*", "salgad*", "convenienc*",
      "food", "foods", "spoleto", "giraffas", "china in box",
      "bob s", "bobs", "popeyes", "kfc", "coco bambu", "ragazzo", "jeronimo", "bullguer", "domino s", "dominos",
    ],
  },
  {
    key: "cafe_padaria",
    name: "Café & Padaria",
    icon: "coffee",
    color: "#B45309",
    aliases: ["cafe", "padaria", "cafeteria", "doceria", "confeitaria"],
    keywords: [
      "padaria", "padoc*", "panific*", "starbucks", "cafeteria", "cafe*", "coffee", "sorvete*", "acai",
      "doceria", "confeitaria", "confeit*", "cacau show", "kopenhagen", "bacio di latte", "chiquinho",
    ],
  },
  {
    key: "bares_bebidas",
    name: "Bares & Bebidas",
    icon: "wine",
    color: "#9333EA",
    aliases: ["bares", "bar", "bebidas", "balada", "happy hour"],
    keywords: [
      "ze delivery", "bar", "boteco", "pub", "cervej*", "chopp*", "adega", "vinicola", "bebidas", "distribuidora de bebidas",
    ],
  },
  {
    key: "mercado",
    name: "Mercado",
    icon: "shopping-cart",
    color: "#16A34A",
    aliases: ["supermercado", "supermercados", "mercados", "feira"],
    keywords: [
      "supermerc*", "mercado", "mercadinho", "minimercado", "mini mercado", "mercear*", "hipermerc*", "atacad*", "atacarejo",
      "assai", "carrefour", "pao de acucar", "extra", "dia", "supermercado dia",
      "bretas", "guanabara", "mundial", "zona sul", "sams club", "sam s club", "makro", "tenda", "fort atacadista",
      "hortifruti", "hortifrut*", "sacolao", "acougue", "peixaria", "frigorif*", "quitanda", "armazem",
      "emporio", "oba", "st marche", "savegnago", "condor", "angeloni", "zaffari", "muffato", "bh supermercados",
    ],
  },
  {
    key: "transporte",
    name: "Transporte",
    icon: "car",
    color: "#0EA5E9",
    aliases: ["mobilidade", "uber", "transporte publico", "corridas"],
    keywords: [
      "uber", "99", "99app", "99 app", "99pop", "99 pop", "cabify", "indrive", "taxi",
      "estacion*", "estapar", "sem parar", "conectcar", "veloe", "taggy",
      "move mais", "pedagio", "metro", "bilhete unico", "riocard", "sptrans", "cptm", "onibus", "buser", "clickbus",
      "localiza", "movida", "unidas",
    ],
  },
  {
    key: "combustivel",
    name: "Combustível",
    icon: "fuel",
    color: "#0284C7",
    aliases: ["gasolina", "posto", "abastecimento", "etanol"],
    keywords: [
      "posto*", "auto posto", "shell", "shell box", "ipiranga", "abastece ai", "petrobras", "br mania", "ale",
      "combustiv*", "gasolin*", "etanol", "diesel", "gnv",
    ],
  },
  {
    key: "manutencao_carro",
    name: "Manutenção de Carro",
    icon: "wrench",
    color: "#475569",
    aliases: ["carro", "veiculo", "automovel", "oficina", "mecanico", "mecanica", "manutencao veiculo"],
    keywords: [
      "oficina", "autopecas", "auto pecas", "auto center", "autocenter", "pneu*", "mecan*", "borrach*", "lavajato", "lava jato",
      "estetica automotiva", "funilar*", "lanternagem", "alinhamento", "balanceamento", "troca de oleo", "revisao",
      "dpaschoal", "impacto prime", "porto auto", "detran", "ipva", "licenciamento", "bateria automotiva", "concessionaria",
      "centro automotivo", "escapamento", "vidros automotivos",
    ],
  },
  {
    key: "videogame",
    name: "Video Game",
    icon: "gamepad-2",
    color: "#7C3AED",
    aliases: ["video game", "videogame", "games", "jogos", "gaming", "console"],
    keywords: [
      "steam", "steampowered", "playstation", "psn", "ps store", "playstation plus", "xbox", "xbox game pass", "game pass",
      "nintendo", "eshop", "epic games", "riot", "riot games", "valorant", "league of legends", "blizzard", "battle net",
      "nuuvem", "twitch", "ubisoft", "ea play", "electronic arts", "rockstar", "valve", "roblox", "genshin", "mihoyo",
      "video game", "videogame", "game*", "jogos",
    ],
  },
  {
    key: "esportes",
    name: "Esporte",
    icon: "dumbbell",
    color: "#0891B2",
    aliases: ["esportes", "academia", "fitness", "saude fisica", "suplementos", "futebol", "corrida"],
    keywords: [
      "smart fit", "smartfit", "bluefit", "bodytech", "selfit", "totalpass", "gympass", "wellhub", "academia", "crossfit",
      "decathlon", "centauro", "netshoes", "pilates", "natacao", "jiu jitsu", "muay thai", "beach tennis", "padel",
      "quadra", "society", "futebol", "corrida", "maratona", "strava", "ciclismo", "bicicleta", "bike*",
      "suplement*", "growth", "integralmedica", "max titanium", "whey", "creatina", "esporte*",
    ],
  },
  {
    key: "lazer",
    name: "Lazer",
    icon: "clapperboard",
    color: "#EAB308",
    aliases: ["entretenimento", "diversao", "cinema"],
    keywords: [
      "cinema", "cinemark", "kinoplex", "cinepolis", "uci", "teatro", "parque", "museu", "boliche", "bilheteria",
    ],
  },
  {
    key: "musica_shows",
    name: "Música & Shows",
    icon: "music",
    color: "#A855F7",
    aliases: ["shows", "musica", "festivais", "ingressos", "eventos"],
    keywords: [
      "ingresso*", "sympla", "eventim", "ticketmaster", "show", "festival", "lollapalooza", "rock in rio", "instrumento*",
    ],
  },
  {
    key: "compras",
    name: "Compras",
    icon: "shopping-bag",
    color: "#EC4899",
    aliases: ["compras online", "shopping", "e commerce", "ecommerce", "lojas", "marketplace"],
    keywords: [
      "shopee", "mercadolivre", "mercado livre", "meli", "amazon", "amazon br", "amazon marketplace", "aliexpress",
      "ali express", "shein", "temu", "magalu", "magazine luiza", "americanas", "casas bahia", "ponto frio", "pichau",
      "submarino", "carrefour com", "olx", "enjoei", "elo7", "wish", "kalunga", "havan", "pernambucanas", "daiso", "miniso",
    ],
  },
  {
    key: "eletronicos",
    name: "Eletrônicos & Tech",
    icon: "laptop",
    color: "#3B82F6",
    aliases: ["eletronicos", "tecnologia", "tech", "informatica", "gadgets"],
    keywords: [
      "kabum", "terabyte", "fast shop", "apple store", "samsung", "dell", "xiaomi", "logitech",
      "hardware", "notebook", "smartphone", "celular", "assistencia tecnica", "monitor", "headset", "teclado",
    ],
  },
  {
    key: "assinaturas",
    name: "Assinaturas",
    icon: "repeat",
    color: "#8B5CF6",
    aliases: ["streaming", "servicos digitais", "apps", "aplicativos"],
    keywords: [
      "netflix", "spotify", "disney", "disney plus", "hbo", "hbomax", "hbo max", "max", "prime video", "amazon prime",
      "primevideo", "youtube", "youtube premium", "google one", "google storage", "apple com", "apple com bill", "icloud",
      "deezer", "globoplay", "crunchyroll", "paramount", "star plus", "tidal", "chatgpt", "openai", "claude", "anthropic",
      "cursor", "github", "vercel", "supabase", "cloudflare", "aws", "figma",
      "microsoft", "office 365", "canva", "adobe", "dropbox", "notion",
      "linkedin", "tinder", "duolingo", "kindle unlimited", "audible", "mubi", "telecine", "meli mais",
    ],
  },
  {
    key: "saude",
    name: "Saúde",
    icon: "heart-pulse",
    color: "#E11D48",
    aliases: ["farmacia", "medicamentos", "medico", "saude e bem estar"],
    keywords: [
      "farma*", "drog*", "droga raia", "drogasil", "raia", "pague menos", "panvel", "pacheco", "araujo", "nissei", "sao joao",
      "hospital", "clinica", "consultorio", "laborat*", "lab", "odonto*", "dentista", "medic*", "unimed", "amil", "hapvida",
      "sulamerica", "bradesco saude", "vacin*", "otica", "oticas", "exame*", "dr consulta",
    ],
  },
  {
    key: "terapia_bem_estar",
    name: "Terapia & Bem-Estar",
    icon: "sparkles",
    color: "#14B8A6",
    aliases: ["terapia", "psicologo", "bem estar", "nutricionista", "fisioterapia"],
    keywords: [
      "psicolog*", "psiquiatr*", "terap*", "nutric*", "fisioterap*", "acupuntur*", "quiroprax*", "yoga", "zenklub", "vittude",
    ],
  },
  {
    key: "casa",
    name: "Casa e contas",
    icon: "house",
    color: "#64748B",
    aliases: ["casa", "moradia", "contas", "contas da casa", "utilidades"],
    keywords: [
      "enel", "sabesp", "cemig", "copel", "light", "eletropaulo", "celpe", "coelba", "cosern", "neoenergia", "equatorial",
      "cedae", "copasa", "embasa", "comgas", "naturgy", "claro", "vivo", "tim", "oi", "net", "sky", "nio", "algar", "starlink",
      "telefonica", "condomin*", "aluguel", "quintoandar", "iptu",
    ],
  },
  {
    key: "casa_decoracao",
    name: "Casa & Decoração",
    icon: "sofa",
    color: "#D97706",
    aliases: ["decoracao", "moveis", "reforma", "construcao"],
    keywords: [
      "leroy merlin", "telhanorte", "tok stok", "tokstok", "camicado", "etna", "mobly", "madeiramadeira", "madeira madeira",
      "material de construcao", "sodimac", "ferreira costa", "decorac*", "moveis", "marcenar*", "colch*",
    ],
  },
  {
    key: "vestuario",
    name: "Vestuário",
    icon: "shirt",
    color: "#DB2777",
    aliases: ["roupas", "moda", "calcados", "roupa"],
    keywords: [
      "renner", "riachuelo", "c a", "cea", "zara", "hering", "marisa", "youcom", "farm", "reserva", "lupo", "track field",
      "nike", "adidas", "puma", "vans", "arezzo", "schutz", "centauro outlet", "dafiti", "zattini", "calcad*", "sapat*", "insider",
    ],
  },
  {
    key: "cuidados",
    name: "Cuidados Pessoais",
    icon: "scissors",
    color: "#EC4899",
    aliases: ["beleza", "barbearia", "salao", "estetica", "cosmeticos"],
    keywords: [
      "barbear*", "salao", "cabeleir*", "estetic*", "manicur*", "depil*", "spa", "massagem",
      "boticario", "o boticario", "natura", "sephora", "beleza na web", "epoca cosmet*", "perfum*", "cosmet*",
    ],
  },
  {
    key: "educacao",
    name: "Educação",
    icon: "graduation-cap",
    color: "#10B981",
    aliases: ["cursos", "estudos", "escola", "faculdade"],
    keywords: [
      "udemy", "alura", "coursera", "rocketseat", "domestika", "hotmart", "eduzz", "kiwify", "escola", "colegio", "faculdade",
      "universidade", "curso*", "livraria*", "saraiva", "amazon kindle", "kindle", "papelaria", "estacio", "anhanguera",
      "unopar", "cogna", "fiap", "puc", "mackenzie", "usp",
    ],
  },
  {
    key: "viagem",
    name: "Viagem",
    icon: "plane",
    color: "#2563EB",
    aliases: ["viagens", "turismo", "ferias", "hospedagem"],
    keywords: [
      "airbnb", "booking", "booking com", "hotel", "hoteis", "pousada", "hostel", "latam", "gol", "gol linhas", "azul",
      "azul linhas", "decolar", "123milhas", "maxmilhas", "cvc", "hurb", "expedia", "trivago", "smiles", "livelo",
      "tudoazul", "aeroporto", "passagem", "passagens", "ibis", "accor", "marriott",
    ],
  },
  {
    key: "pets",
    name: "Pets",
    icon: "paw-print",
    color: "#F59E0B",
    aliases: ["pet", "meu pet", "animais", "cachorro", "cachorros", "gato", "gatos"],
    keywords: [
      "petz", "cobasi", "petlove", "petland", "pet shop", "petshop", "veterinar*", "agropet", "racao", "banho e tosa",
      "tosa", "zee dog", "zeedog", "royal canin", "bravecto", "simparic", "nexgard", "petisco*", "creche pet", "hotel pet",
      "clinica vet*", "hospital vet*", "meu pet", "dog hero", "doghero", "pet anjo", "petanjo",
    ],
  },
  {
    key: "presentes",
    name: "Presentes & Doações",
    icon: "gift",
    color: "#F43F5E",
    aliases: ["presentes", "doacoes", "doacao", "flores", "brinquedos"],
    keywords: [
      "floricultura", "giuliana flores", "presente*", "ri happy", "pbkids", "brinqued*", "doacao", "ong", "vaquinha", "vakinha",
    ],
  },
  {
    key: "trabalho",
    name: "Trabalho & Negócios",
    icon: "briefcase",
    color: "#0F766E",
    aliases: ["trabalho", "negocios", "escritorio", "pj", "empresa"],
    keywords: [
      "coworking", "wework", "contabilizei", "contabilidade", "certificado digital", "registro br", "godaddy", "hostinger",
      "escritorio", "reuniao",
    ],
  },
  {
    key: "seguros_impostos",
    name: "Seguros & Impostos",
    icon: "shield",
    color: "#334155",
    aliases: ["seguros", "seguro", "impostos", "tributos"],
    keywords: [
      "porto seguro", "tokio marine", "azul seguros", "bradesco seguros", "seguro*", "darf", "receita federal", "cartorio",
    ],
  },
  {
    key: "investimentos",
    name: "Investimentos & Reserva",
    icon: "trending-up",
    color: "#059669",
    aliases: ["investimentos", "reserva", "poupanca", "patrimonio", "acoes"],
    keywords: [
      "tesouro direto", "xp investimentos", "nuinvest", "rico corretora", "clear corretora", "btg pactual",
      "binance", "mercado bitcoin", "cripto", "previdencia", "aporte", "cdb",
    ],
  },
  {
    key: "transferencias",
    name: "Transferências / Pix",
    icon: "arrow-left-right",
    color: "#2563EB",
    aliases: ["pix", "transferencia", "transferencias", "pagamentos digitais"],
    keywords: [
      "pix no credito", "pix enviado", "pix transfer*", "transferencia", "picpay", "recargapay", "pagbank",
      "ted enviada", "doc enviado",
    ],
  },
  {
    key: "servicos",
    name: "Serviços & Tarifas",
    icon: "zap",
    color: "#64748B",
    aliases: ["servicos", "tarifas", "taxas"],
    keywords: [
      "iof", "anuidade", "tarifa", "encargos", "juros", "correios", "sedex", "lavander*", "tinturar*",
      "despachante", "chaveiro",
    ],
  },
  {
    key: "outros",
    name: "Outros",
    icon: "shapes",
    color: "#64748B",
    aliases: ["outro", "geral", "diversos", "variados"],
    keywords: [],
  },
];

const PRESETS_BY_KEY = new Map(CATEGORY_PRESETS.map((preset) => [preset.key, preset]));

export const PRESET_CATEGORY_PREFIX = "preset:";

export function presetCategoryId(key: PresetKey): string {
  return `${PRESET_CATEGORY_PREFIX}${key}`;
}

export function presetFromCategoryId(id: string | null | undefined): CategoryPreset | null {
  if (!id?.startsWith(PRESET_CATEGORY_PREFIX)) return null;
  return PRESETS_BY_KEY.get(id.slice(PRESET_CATEGORY_PREFIX.length) as PresetKey) ?? null;
}

function matchLength(text: string, keyword: string): number {
  const padded = ` ${text} `;
  if (keyword.endsWith("*")) {
    const stem = keyword.slice(0, -1);
    return padded.includes(` ${stem}`) ? stem.length : 0;
  }
  return padded.includes(` ${keyword} `) ? keyword.length : 0;
}

/** Returns the preset whose longest keyword appears in the text (e.g. "uber eats" beats "uber"). */
export function matchPreset(text: string): CategoryPreset | null {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  let best: { preset: CategoryPreset; length: number } | null = null;
  for (const preset of CATEGORY_PRESETS) {
    for (const keyword of preset.keywords) {
      const length = matchLength(normalized, keyword);
      if (length > 0 && (!best || length > best.length)) best = { preset, length };
    }
  }
  return best?.preset ?? null;
}

/** Bank-provided categories (e.g. the Inter "Categoria" column) mapped to presets. */
const BANK_CATEGORY_HINTS: readonly [string, PresetKey][] = [
  ["restaurante", "alimentacao"],
  ["alimentacao", "alimentacao"],
  ["lanchonete", "alimentacao"],
  ["padaria", "cafe_padaria"],
  ["cafeteria", "cafe_padaria"],
  ["bar", "bares_bebidas"],
  ["supermercado", "mercado"],
  ["mercado", "mercado"],
  ["transporte", "transporte"],
  ["combustivel", "combustivel"],
  ["posto", "combustivel"],
  ["oficina", "manutencao_carro"],
  ["automotivo", "manutencao_carro"],
  ["veiculo", "manutencao_carro"],
  ["jogos", "videogame"],
  ["games", "videogame"],
  ["esporte", "esportes"],
  ["academia", "esportes"],
  ["saude", "saude"],
  ["farmacia", "saude"],
  ["drogaria", "saude"],
  ["vestuario", "vestuario"],
  ["educacao", "educacao"],
  ["viagem", "viagem"],
  ["turismo", "viagem"],
  ["hospedagem", "viagem"],
  ["entretenimento", "lazer"],
  ["lazer", "lazer"],
  ["musica", "musica_shows"],
  ["beleza", "cuidados"],
  ["estetica", "cuidados"],
  ["pet", "pets"],
  ["pix", "transferencias"],
  ["transferencia", "transferencias"],
  ["tarifa", "servicos"],
  ["seguro", "seguros_impostos"],
  ["imposto", "seguros_impostos"],
  ["investimento", "investimentos"],
  ["servicos", "casa"],
  ["telecom", "casa"],
  ["construcao", "casa_decoracao"],
  ["moveis", "casa_decoracao"],
  ["compras", "compras"],
  ["departamento", "compras"],
  ["eletronicos", "eletronicos"],
];

export function presetFromBankCategory(bankCategory: string | null | undefined): CategoryPreset | null {
  const normalized = normalizeText(bankCategory ?? "");
  if (!normalized) return null;
  const hint = BANK_CATEGORY_HINTS.find(([word]) => ` ${normalized} `.includes(` ${word}`));
  return hint ? (PRESETS_BY_KEY.get(hint[1]) ?? null) : null;
}

/** The user's category that corresponds to a preset (same name or alias), if any. */
export function findCategoryForPreset(categories: readonly Category[], preset: CategoryPreset): Category | null {
  const names = new Set([preset.name, ...preset.aliases].map(normalizeText));
  return categories.find((category) => names.has(normalizeText(category.name))) ?? null;
}

/**
 * Learns from the user's own previously categorised expenses: if the same
 * merchant (`clean_title` or base `raw_title`) was categorised before, returns
 * the most frequent (tie-break: most recent) category id.
 */
export function inferCategoryFromHistory(
  rawTitle: string,
  cleanTitleText: string,
  transactions: readonly Transaction[],
  categories: readonly Category[],
): string | null {
  const validIds = new Set(categories.map((cat) => cat.id));
  if (validIds.size === 0) return null;

  const targetClean = normalizeText(cleanTitleText);
  const targetRaw = normalizeText(extractInstallment(rawTitle)?.baseTitle ?? rawTitle);
  if (!targetClean && !targetRaw) return null;

  const scores = new Map<string, { count: number; latestDate: string }>();
  for (const tx of transactions) {
    if (tx.type !== "expense" || tx.is_ignored || !tx.category_id || !validIds.has(tx.category_id)) continue;
    const txClean = normalizeText(tx.clean_title);
    const txRaw = normalizeText(extractInstallment(tx.raw_title)?.baseTitle ?? tx.raw_title);
    const sameMerchant =
      (targetClean.length >= 3 && txClean === targetClean) ||
      (targetRaw.length >= 3 && txRaw === targetRaw);
    if (!sameMerchant) continue;

    const current = scores.get(tx.category_id);
    if (current) {
      current.count += 1;
      if (tx.date > current.latestDate) current.latestDate = tx.date;
    } else {
      scores.set(tx.category_id, { count: 1, latestDate: tx.date });
    }
  }

  let best: { id: string; count: number; latestDate: string } | null = null;
  for (const [id, info] of scores) {
    if (!best || info.count > best.count || (info.count === best.count && info.latestDate > best.latestDate)) {
      best = { id, ...info };
    }
  }
  return best?.id ?? null;
}

/** Matches custom user category names directly against the transaction title (e.g. category "Barbearia" → "Barbearia Centro"). */
export function matchUserCategoryByName(
  rawTitle: string,
  cleanTitleText: string,
  categories: readonly Category[],
): Category | null {
  const haystack = ` ${normalizeText(`${rawTitle} ${cleanTitleText}`)} `;
  if (haystack.trim() === "") return null;
  let best: { category: Category; length: number } | null = null;
  for (const category of categories) {
    const normalized = normalizeText(category.name);
    if (normalized.length < 4) continue;
    if (haystack.includes(` ${normalized} `) && (!best || normalized.length > best.length)) {
      best = { category, length: normalized.length };
    }
  }
  return best?.category ?? null;
}

/**
 * Suggests a category id for an imported row: the merchant dictionary first, then
 * the bank's own category. Returns an existing category id, a virtual
 * `preset:<key>` id when the user has no matching category, or `null`.
 */
export function suggestCategoryId(
  rawTitle: string,
  bankCategory: string | null,
  categories: readonly Category[],
): string | null {
  const preset = matchPreset(rawTitle) ?? presetFromBankCategory(bankCategory);
  if (!preset) return null;
  return findCategoryForPreset(categories, preset)?.id ?? presetCategoryId(preset.key);
}

/** Full automatic categorisation cascade with source attribution. */
export function autoSuggestCategory(options: {
  rawTitle: string;
  cleanTitle: string;
  bankCategory: string | null;
  categories: readonly Category[];
  transactions: readonly Transaction[];
}): { categoryId: string | null; source: CategorySuggestionSource } {
  const fromHistory = inferCategoryFromHistory(
    options.rawTitle,
    options.cleanTitle,
    options.transactions,
    options.categories,
  );
  if (fromHistory) return { categoryId: fromHistory, source: "history" };

  const byName = matchUserCategoryByName(options.rawTitle, options.cleanTitle, options.categories);
  if (byName) return { categoryId: byName.id, source: "user_category" };

  const fromDict = matchPreset(options.rawTitle) ?? matchPreset(options.cleanTitle);
  if (fromDict) {
    return {
      categoryId: findCategoryForPreset(options.categories, fromDict)?.id ?? presetCategoryId(fromDict.key),
      source: "dictionary",
    };
  }

  const fromBank = presetFromBankCategory(options.bankCategory);
  if (fromBank) {
    return {
      categoryId: findCategoryForPreset(options.categories, fromBank)?.id ?? presetCategoryId(fromBank.key),
      source: "bank",
    };
  }

  return { categoryId: null, source: null };
}

const ESSENTIAL_PRESETS = new Set<PresetKey>([
  "mercado",
  "transporte",
  "combustivel",
  "manutencao_carro",
  "saude",
  "terapia_bem_estar",
  "casa",
  "educacao",
  "trabalho",
  "seguros_impostos",
]);

const FINANCIAL_PRESETS = new Set<PresetKey>(["investimentos"]);

export function defaultNatureForPreset(key: PresetKey): CategoryNature {
  if (FINANCIAL_PRESETS.has(key)) return "financial";
  return ESSENTIAL_PRESETS.has(key) ? "essential" : "lifestyle";
}

/** Guesses a pet expense subtype from a merchant/description string. */
export function inferPetExpenseKind(text: string): PetExpenseKind {
  const norm = ` ${normalizeText(text)} `;
  if (/(?:racao|petisco|sache|pate|aliment|comida|royal canin|premier|golden|farmina|granplus)/.test(norm)) return "food";
  if (/(?:banho|tosa|higienic|hidratac|unha|grooming)/.test(norm)) return "grooming";
  if (/(?:vacin|vermifug|antipulga|bravecto|simparic|nexgard|remedio|medicament|farmacia vet|pomada|colirio)/.test(norm)) return "meds";
  if (/(?:veterinar|clinica|hospital|consulta|exame|cirurg|castrac|raio x|ultrassom|vet )/.test(norm)) return "vet";
  if (/(?:creche|hotel|hosped|passeio|dog walker|doghero|dog hero|pet anjo|adestr)/.test(norm)) return "boarding";
  if (/(?:coleira|guia|peitoral|cama|brinqued|arranhador|areia|tapete|caixa de transporte|bebedouro|comedouro|roupinha|zee dog|zeedog)/.test(norm)) {
    return "accessories";
  }
  return "other";
}

/** Virtual categories shown in the import review for presets the user does not have yet. */
export function virtualPresetCategories(ids: Iterable<string | null>): Category[] {
  const seen = new Map<string, Category>();
  for (const id of ids) {
    const preset = presetFromCategoryId(id);
    if (!preset || !id || seen.has(id)) continue;
    seen.set(id, {
      id,
      name: preset.name,
      icon: preset.icon,
      color: preset.color,
      monthly_limit: 0,
      parent_id: null,
      nature: defaultNatureForPreset(preset.key),
    });
  }
  return Array.from(seen.values());
}
