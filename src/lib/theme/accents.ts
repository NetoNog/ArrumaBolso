export interface ThemeAccent {
  id: string;
  name: string;
  subtitle: string;
  primaryHsl: string;
  ringHsl: string;
  hex: string;
  previewBg: string;
}

export const THEME_ACCENTS: ThemeAccent[] = [
  {
    id: 'emerald',
    name: 'Esmeralda FinTech',
    subtitle: 'Padrão ArrumaBolso',
    primaryHsl: '158 75% 42%',
    ringHsl: '158 75% 45%',
    hex: '#10b981',
    previewBg: 'bg-emerald-500',
  },
  {
    id: 'violet',
    name: 'Roxo Nubank',
    subtitle: 'Moderno & Digital',
    primaryHsl: '262 83% 58%',
    ringHsl: '262 83% 62%',
    hex: '#8b5cf6',
    previewBg: 'bg-purple-500',
  },
  {
    id: 'cyan',
    name: 'Ciano Tech',
    subtitle: 'Futurista & Preciso',
    primaryHsl: '189 94% 43%',
    ringHsl: '189 94% 48%',
    hex: '#06b6d4',
    previewBg: 'bg-cyan-500',
  },
  {
    id: 'amber',
    name: 'Dourado Prestige',
    subtitle: 'Riqueza & Ouro',
    primaryHsl: '38 92% 50%',
    ringHsl: '38 92% 55%',
    hex: '#f59e0b',
    previewBg: 'bg-amber-500',
  },
  {
    id: 'cobalt',
    name: 'Azul Cobalto',
    subtitle: 'Solidez Institucional',
    primaryHsl: '217 91% 60%',
    ringHsl: '217 91% 65%',
    hex: '#3b82f6',
    previewBg: 'bg-blue-500',
  },
  {
    id: 'rose',
    name: 'Carmim Sunset',
    subtitle: 'Vibrante & Ousado',
    primaryHsl: '340 82% 52%',
    ringHsl: '340 82% 58%',
    hex: '#f43f5e',
    previewBg: 'bg-rose-500',
  },
];

export function applyThemeAccent(accentId: string) {
  if (typeof document === 'undefined') return;
  const accent = THEME_ACCENTS.find(a => a.id === accentId) || THEME_ACCENTS[0];
  document.documentElement.style.setProperty('--primary', accent.primaryHsl);
  document.documentElement.style.setProperty('--ring', accent.ringHsl);
}
