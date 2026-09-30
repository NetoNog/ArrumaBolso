export interface AvatarPreset {
  id: string;
  name: string;
  type: 'icon' | 'gradient';
  iconKey?: 'piggy' | 'investor' | 'target' | 'crypto' | 'shield' | 'sparkles';
  gradientClass: string;
  colorHex: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'preset:piggy', name: 'Cofrinho ArrumaBolso', type: 'icon', iconKey: 'piggy', gradientClass: 'from-emerald-500 to-teal-800', colorHex: '#10b981' },
  { id: 'preset:investor', name: 'Investidor Pro', type: 'icon', iconKey: 'investor', gradientClass: 'from-blue-600 to-indigo-900', colorHex: '#3b82f6' },
  { id: 'preset:target', name: 'Estrategista', type: 'icon', iconKey: 'target', gradientClass: 'from-purple-600 to-violet-900', colorHex: '#8b5cf6' },
  { id: 'preset:crypto', name: 'Ouro & Cripto', type: 'icon', iconKey: 'crypto', gradientClass: 'from-amber-400 to-orange-700', colorHex: '#f59e0b' },
  { id: 'preset:shield', name: 'Segurança Máxima', type: 'icon', iconKey: 'shield', gradientClass: 'from-cyan-500 to-teal-800', colorHex: '#06b6d4' },
  { id: 'preset:sparkles', name: 'Prestige Diamante', type: 'icon', iconKey: 'sparkles', gradientClass: 'from-rose-500 to-pink-800', colorHex: '#f43f5e' },
  { id: 'gradient:emerald', name: 'Iniciais Esmeralda', type: 'gradient', gradientClass: 'from-emerald-600 to-teal-900', colorHex: '#10b981' },
  { id: 'gradient:violet', name: 'Iniciais Violeta', type: 'gradient', gradientClass: 'from-purple-600 to-indigo-950', colorHex: '#8b5cf6' },
  { id: 'gradient:amber', name: 'Iniciais Ouro', type: 'gradient', gradientClass: 'from-amber-500 to-orange-950', colorHex: '#f59e0b' },
  { id: 'gradient:cobalt', name: 'Iniciais Cobalto', type: 'gradient', gradientClass: 'from-blue-600 to-cyan-950', colorHex: '#3b82f6' },
];
