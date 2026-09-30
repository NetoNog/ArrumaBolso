import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'hero';
  showTagline?: boolean;
  tagline?: string;
  className?: string;
  collapsed?: boolean;
  orientation?: 'horizontal' | 'vertical';
}

export function BrandLogo({
  size = 'md',
  showTagline = true,
  tagline = 'Suas finanças nos trinques',
  className = '',
  collapsed = false,
  orientation = 'horizontal',
}: BrandLogoProps) {
  // Dimensions for the icon
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
    '2xl': 'w-20 h-20',
    hero: 'w-24 h-24 sm:w-28 sm:h-28',
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
    xl: 'text-2xl',
    '2xl': 'text-3xl sm:text-4xl',
    hero: 'text-4xl sm:text-5xl',
  };

  const taglineSizes = {
    sm: 'text-[9px]',
    md: 'text-[10px]',
    lg: 'text-xs',
    xl: 'text-sm',
    '2xl': 'text-sm sm:text-base',
    hero: 'text-sm sm:text-base',
  };

  const isVertical = orientation === 'vertical';

  return (
    <div className={`flex ${isVertical ? 'flex-col items-center text-center gap-3.5' : 'items-center gap-3'} select-none ${className}`}>
      {/* Icon Badge */}
      <div
        className={`${iconSizes[size]} relative shrink-0 rounded-xl bg-gradient-to-b from-[#0F172A] to-[#06090F] border border-zinc-700/60 p-1.5 flex items-center justify-center shadow-lg shadow-black/70 group-hover:border-emerald-500/40 transition-all duration-300`}
      >
        {/* Subtle inner dark vignette */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none" />

        {/* Ultra-Minimalist Obsidian Wallet with Golden Coin Entering */}
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full relative z-10 transition-transform duration-300 group-hover:scale-[1.02]"
        >
          <defs>
            <linearGradient id="logoCoinGrad" x1="16" y1="3.5" x2="16" y2="15.5" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FEF08A"/>
              <stop offset="35%" stopColor="#FACC15"/>
              <stop offset="100%" stopColor="#D97706"/>
            </linearGradient>
            <linearGradient id="logoEmeraldGrad" x1="10" y1="18.2" x2="22" y2="18.2" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#34D399"/>
              <stop offset="100%" stopColor="#059669"/>
            </linearGradient>
            <linearGradient id="logoWalletBack" x1="3.5" y1="11.5" x2="28.5" y2="28" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1E293B"/>
              <stop offset="100%" stopColor="#0F172A"/>
            </linearGradient>
            <linearGradient id="logoWalletFront" x1="16" y1="15.2" x2="16" y2="28" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0F172A"/>
              <stop offset="100%" stopColor="#070A11"/>
            </linearGradient>
          </defs>

          {/* 1. Golden Concentric Coin entering wallet (with smooth glide) */}
          <g className="transition-transform duration-300 ease-out group-hover:translate-y-1">
            <circle cx="16" cy="9.5" r="5.8" fill="url(#logoCoinGrad)" />
            <circle cx="16" cy="9.5" r="3.4" stroke="#070A11" strokeWidth="1.2" fill="none" />
            <circle cx="16" cy="9.5" r="1.1" fill="#070A11" />
          </g>

          {/* 2. Obsidian Wallet Body (Back) */}
          <rect x="3.5" y="11.5" width="25" height="16.5" rx="3.5" fill="url(#logoWalletBack)" stroke="#334155" strokeWidth="1.1" />

          {/* 3. Front Pocket Slit (covers lower half of coin, showing it entering inside) */}
          <path
            d="M3.5 15.2C7.5 18 11.5 19.2 16 19.2C20.5 19.2 24.5 18 28.5 15.2V24.5C28.5 26.433 26.933 28 25 28H7C5.067 28 3.5 26.433 3.5 24.5V15.2Z"
            fill="url(#logoWalletFront)"
            stroke="#475569"
            strokeWidth="1.1"
            strokeLinejoin="round"
          />

          {/* 4. Luminous Emerald Accent Trim on Pocket Lip */}
          <path
            d="M10 18.2C11.8 19 13.9 19.5 16 19.5C18.1 19.5 20.2 19 22 18.2"
            stroke="url(#logoEmeraldGrad)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* 5. Minimalist Gold Clasp with Rivet */}
          <rect x="22.5" y="20.5" width="4.5" height="3" rx="0.8" fill="url(#logoCoinGrad)" />
          <circle cx="24.2" cy="22" r="0.5" fill="#070A11" />
        </svg>
      </div>

      {/* Brand Name & Tagline */}
      {!collapsed && (
        <div className="flex flex-col leading-none">
          <div className={`${textSizes[size]} font-extrabold tracking-tight text-white flex items-center`}>
            <span>Arruma</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400">
              Bolso
            </span>
          </div>
          {showTagline && (
            <span className={`${taglineSizes[size]} text-muted-foreground/90 font-medium tracking-normal mt-0.5 flex items-center gap-1`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              {tagline}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export interface ArrumaBolsoIconProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  glow?: boolean;
  badgeClassName?: string;
}

/**
 * Ícone Oficial da Carteira Obsidian com Moeda de Ouro ArrumaBolso.
 * Componente unificado para garantir fidelidade idêntica em telas mobile, desktop e dashboard.
 */
export function ArrumaBolsoIcon({
  size,
  className = '',
  glow = false,
  badgeClassName = '',
}: ArrumaBolsoIconProps) {
  const sizePresets = {
    xs: { box: 'w-8 h-8', inner: 'p-1 rounded-xl border border-zinc-700/60 shadow-md', glowInset: '-inset-1 blur-sm' },
    sm: { box: 'w-10 h-10', inner: 'p-1.5 rounded-xl border border-zinc-700/70 shadow-lg', glowInset: '-inset-1 blur-md' },
    md: { box: 'w-12 h-12', inner: 'p-2 rounded-xl border border-zinc-700/80 shadow-lg', glowInset: '-inset-1.5 blur-md' },
    lg: { box: 'w-16 h-16', inner: 'p-2.5 rounded-2xl border-2 border-zinc-700/80 shadow-xl', glowInset: '-inset-1.5 blur-lg' },
    xl: { box: 'w-20 h-20 sm:w-24 sm:h-24', inner: 'p-2.5 sm:p-3.5 rounded-2xl border-2 border-zinc-700/80 shadow-2xl', glowInset: '-inset-1.5 blur-lg' },
    '2xl': { box: 'w-28 h-28 sm:w-32 sm:h-32', inner: 'p-3.5 rounded-3xl border-2 border-zinc-700/80 shadow-2xl', glowInset: '-inset-2 blur-xl' },
  };

  const preset = size ? sizePresets[size] : null;
  const containerClasses = className || preset?.box || 'w-20 h-20 sm:w-24 sm:h-24';
  const innerPreset = preset?.inner || 'p-2.5 sm:p-3.5 rounded-2xl border-2 border-zinc-700/80 shadow-2xl';
  const glowClasses = preset?.glowInset || '-inset-1.5 blur-lg';

  return (
    <div className={`relative group shrink-0 ${containerClasses}`}>
      {glow && (
        <div className={`absolute ${glowClasses} bg-gradient-to-r from-emerald-500/30 via-teal-500/20 to-amber-500/20 rounded-3xl opacity-85 group-hover:opacity-100 transition duration-500`} />
      )}
      <div className={`w-full h-full relative bg-gradient-to-b from-[#0F172A] to-[#06090F] flex items-center justify-center shadow-black/80 ${innerPreset} ${badgeClassName}`}>
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full relative z-10 transition-transform duration-300 group-hover:scale-105"
        >
          <defs>
            <linearGradient id="absCoinGrad" x1="16" y1="3.5" x2="16" y2="15.5" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FEF08A"/>
              <stop offset="35%" stopColor="#FACC15"/>
              <stop offset="100%" stopColor="#D97706"/>
            </linearGradient>
            <linearGradient id="absEmeraldGrad" x1="10" y1="18.2" x2="22" y2="18.2" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#34D399"/>
              <stop offset="100%" stopColor="#059669"/>
            </linearGradient>
            <linearGradient id="absWalletBack" x1="3.5" y1="11.5" x2="28.5" y2="28" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1E293B"/>
              <stop offset="100%" stopColor="#0F172A"/>
            </linearGradient>
            <linearGradient id="absWalletFront" x1="16" y1="15.2" x2="16" y2="28" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0F172A"/>
              <stop offset="100%" stopColor="#070A11"/>
            </linearGradient>
          </defs>

          {/* 1. Golden Concentric Coin entering wallet (with smooth glide) */}
          <g className="transition-transform duration-300 ease-out group-hover:translate-y-1">
            <circle cx="16" cy="9.5" r="5.8" fill="url(#absCoinGrad)" />
            <circle cx="16" cy="9.5" r="3.4" stroke="#070A11" strokeWidth="1.2" fill="none" />
            <circle cx="16" cy="9.5" r="1.1" fill="#070A11" />
          </g>

          {/* 2. Obsidian Wallet Body (Back) */}
          <rect x="3.5" y="11.5" width="25" height="16.5" rx="3.5" fill="url(#absWalletBack)" stroke="#334155" strokeWidth="1.1" />

          {/* 3. Front Pocket Slit */}
          <path
            d="M3.5 15.2C7.5 18 11.5 19.2 16 19.2C20.5 19.2 24.5 18 28.5 15.2V24.5C28.5 26.433 26.933 28 25 28H7C5.067 28 3.5 26.433 3.5 24.5V15.2Z"
            fill="url(#absWalletFront)"
            stroke="#475569"
            strokeWidth="1.1"
            strokeLinejoin="round"
          />

          {/* 4. Luminous Emerald Accent Trim on Pocket Lip */}
          <path
            d="M10 18.2C11.8 19 13.9 19.5 16 19.5C18.1 19.5 20.2 19 22 18.2"
            stroke="url(#absEmeraldGrad)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* 5. Minimalist Gold Clasp with Rivet */}
          <rect x="22.5" y="20.5" width="4.5" height="3" rx="0.8" fill="url(#absCoinGrad)" />
          <circle cx="24.2" cy="22" r="0.5" fill="#070A11" />
        </svg>
      </div>
    </div>
  );
}
