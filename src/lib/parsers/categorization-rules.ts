export interface CategorizationRule {
  keywords: string[];
  categoryName: string;
  type: 'expense' | 'income' | 'investment';
  icon?: string;
  color?: string;
}

export const DEFAULT_CATEGORIZATION_RULES: CategorizationRule[] = [
  // Supermercado e Alimentação
  {
    keywords: ['ifood', 'rappi', 'burger king', 'mcdonald', 'mcdonalds', 'outback', 'starbucks', 'habib', 'subway', 'pizzaria', 'restaurante', 'churrascaria', 'padaria', 'panificadora', 'lanchonete', 'bar ', 'boteco'],
    categoryName: 'Alimentação & Supermercado',
    type: 'expense',
    icon: 'utensils',
    color: '#f97316'
  },
  {
    keywords: ['carrefour', 'pao de acucar', 'pão de açúcar', 'extra', 'assai', 'assaí', 'atacadao', 'atacadão', 'supermercado', 'hortifruti', 'oba hortifruti', 'dia%', 'mambo', 'zaffari', 'sonda'],
    categoryName: 'Alimentação & Supermercado',
    type: 'expense',
    icon: 'shopping-cart',
    color: '#f97316'
  },
  // Transporte
  {
    keywords: ['uber', '99app', '99 tecnologia', 'taxi', 'táxi', 'posto', 'shell', 'ipiranga', 'petrobras', 'combustivel', 'combustível', 'sem parar', 'veloe', 'conectcar', 'estapar', 'estacionamento', 'buser', 'azul linhas', 'gol linhas', 'latam'],
    categoryName: 'Transporte & Combustível',
    type: 'expense',
    icon: 'car',
    color: '#06b6d4'
  },
  // Assinaturas e Serviços Digitais
  {
    keywords: ['netflix', 'spotify', 'prime video', 'amazon prime', 'disney', 'hbo', 'max', 'youtube', 'apple.com', 'icloud', 'google storage', 'openai', 'chatgpt', 'notion', 'github', 'claro', 'vivo', 'tim celular'],
    categoryName: 'Assinaturas & Serviços',
    type: 'expense',
    icon: 'sparkles',
    color: '#8b5cf6'
  },
  // Moradia e Contas Fixas
  {
    keywords: ['enel', 'cpfl', 'sabesp', 'copasa', 'comgas', 'naturgy', 'aluguel', 'quintoandar', 'condominio', 'condomínio', 'iptu', 'leroy merlin', 'telhanorte', 'tok&stok', 'camicado', 'energia', 'agua e esgoto'],
    categoryName: 'Moradia & Contas',
    type: 'expense',
    icon: 'home',
    color: '#3b82f6'
  },
  // Saúde e Farmácia
  {
    keywords: ['drogasil', 'droga raia', 'pague menos', 'drogaria', 'farmacia', 'farmácia', 'panvel', 'consulta', 'clinica', 'clínica', 'hospital', 'laboratorio', 'laboratório', 'fleury', 'lavoisier', 'unimed', 'sulamerica', 'bradesco saude'],
    categoryName: 'Saúde & Farmácia',
    type: 'expense',
    icon: 'heart-pulse',
    color: '#ef4444'
  },
  // Lazer e Cultura
  {
    keywords: ['cinema', 'cinemark', 'kinoplex', 'uci', 'ingresso.com', 'sympla', 'eventim', 'steam', 'playstation', 'sony interactive', 'nintendo', 'xbox', 'show', 'teatro', 'parque'],
    categoryName: 'Lazer & Restaurantes',
    type: 'expense',
    icon: 'coffee',
    color: '#ec4899'
  },
  // Compras em Geral e E-commerce
  {
    keywords: ['amazon', 'mercado livre', 'mercadolivre', 'shopee', 'aliexpress', 'shein', 'magalu', 'magazine luiza', 'americanas', 'casas bahia', 'zara', 'renner', 'c&a', 'riachuelo', 'nike', 'adidas', 'centauro'],
    categoryName: 'Compras & Eletrônicos',
    type: 'expense',
    icon: 'shopping-bag',
    color: '#a855f7'
  },
  // Educação
  {
    keywords: ['udemy', 'coursera', 'alura', 'rocketseat', 'faculdade', 'escola', 'livraria', 'saraiva', 'cultura livraria', 'curso', 'ingles', 'idiomas'],
    categoryName: 'Educação & Cursos',
    type: 'expense',
    icon: 'graduation-cap',
    color: '#14b8a6'
  },
  // Investimentos
  {
    keywords: ['nuinvest', 'rico corretora', 'xp investimentos', 'btg pactual', 'clear corretora', 'tesouro direto', 'binance', 'mercado bitcoin', 'b3', 'aporte', 'aplicação'],
    categoryName: 'Ações & Fundos Imobiliários',
    type: 'investment',
    icon: 'trending-up',
    color: '#059669'
  },
  // Receitas e Salários
  {
    keywords: ['salario', 'salário', 'folha de pagamento', 'remuneracao', 'remuneração', 'transferencia recebida', 'transferência recebida', 'pix recebido', 'provento', 'dividendo', 'jcp', 'reembolso'],
    categoryName: 'Salário & Remuneração',
    type: 'income',
    icon: 'briefcase',
    color: '#10b981'
  }
];

export function predictCategory(title: string, rawCategory?: string): { categoryName: string; type: 'expense' | 'income' | 'investment' } {
  const normalizedTitle = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normalizedCategory = (rawCategory || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // 1. Tenta casar por palavras-chave no título
  for (const rule of DEFAULT_CATEGORIZATION_RULES) {
    for (const kw of rule.keywords) {
      const normalizedKw = kw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (normalizedTitle.includes(normalizedKw)) {
        return { categoryName: rule.categoryName, type: rule.type };
      }
    }
  }

  // 2. Se o Nubank já enviou uma categoria na fatura (ex: "supermercado", "transporte", "serviços")
  if (normalizedCategory.includes('supermercado') || normalizedCategory.includes('restaurante') || normalizedCategory.includes('alimentacao')) {
    return { categoryName: 'Alimentação & Supermercado', type: 'expense' };
  }
  if (normalizedCategory.includes('transporte') || normalizedCategory.includes('viagem')) {
    return { categoryName: 'Transporte & Combustível', type: 'expense' };
  }
  if (normalizedCategory.includes('servico') || normalizedCategory.includes('servicos')) {
    return { categoryName: 'Assinaturas & Serviços', type: 'expense' };
  }
  if (normalizedCategory.includes('saude')) {
    return { categoryName: 'Saúde & Farmácia', type: 'expense' };
  }
  if (normalizedCategory.includes('lazer')) {
    return { categoryName: 'Lazer & Restaurantes', type: 'expense' };
  }
  if (normalizedCategory.includes('casa') || normalizedCategory.includes('moradia')) {
    return { categoryName: 'Moradia & Contas', type: 'expense' };
  }
  if (normalizedCategory.includes('eletronico') || normalizedCategory.includes('compras')) {
    return { categoryName: 'Compras & Eletrônicos', type: 'expense' };
  }

  // 3. Fallback padrão
  return { categoryName: 'Outros & Variados', type: 'expense' };
}
