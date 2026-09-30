'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { 
  PiggyBank, 
  TrendingUp, 
  Target, 
  Coins, 
  ShieldCheck, 
  Sparkles,
  User
} from 'lucide-react';
import { AVATAR_PRESETS } from '@/lib/theme/avatar-presets';

interface UserAvatarProps {
  avatarUrl?: string | null;
  name?: string | null;
  email?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
};

const ICON_SIZE_MAP = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-7 h-7',
  xl: 'w-10 h-10',
};

export function UserAvatar({
  avatarUrl,
  name,
  email,
  size = 'md',
  className = '',
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);

  // Calcula iniciais do nome ou e-mail
  const initials = React.useMemo(() => {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return parts[0].substring(0, 2).toUpperCase();
    }
    if (email && email.trim()) {
      return email.substring(0, 2).toUpperCase();
    }
    return 'AB';
  }, [name, email]);

  const sizeClass = SIZE_MAP[size];
  const iconClass = ICON_SIZE_MAP[size];

  // Caso 1: Preset selecionado (ex: preset:piggy, preset:target)
  if (avatarUrl?.startsWith('preset:')) {
    const preset = AVATAR_PRESETS.find(p => p.id === avatarUrl) || AVATAR_PRESETS[0];
    const renderIcon = () => {
      switch (preset.iconKey) {
        case 'piggy':
          return <PiggyBank className={iconClass} />;
        case 'investor':
          return <TrendingUp className={iconClass} />;
        case 'target':
          return <Target className={iconClass} />;
        case 'crypto':
          return <Coins className={iconClass} />;
        case 'shield':
          return <ShieldCheck className={iconClass} />;
        case 'sparkles':
          return <Sparkles className={iconClass} />;
        default:
          return <User className={iconClass} />;
      }
    };

    return (
      <div 
        className={`rounded-full bg-gradient-to-br ${preset.gradientClass} text-white flex items-center justify-center shrink-0 shadow-sm border border-white/20 select-none ${sizeClass} ${className}`}
        title={preset.name}
      >
        {renderIcon()}
      </div>
    );
  }

  // Caso 2: Gradiente de Iniciais (ex: gradient:emerald)
  if (avatarUrl?.startsWith('gradient:')) {
    const preset = AVATAR_PRESETS.find(p => p.id === avatarUrl) || AVATAR_PRESETS[6];
    return (
      <div 
        className={`rounded-full bg-gradient-to-br ${preset.gradientClass} text-white font-extrabold flex items-center justify-center shrink-0 shadow-sm border border-white/20 select-none ${sizeClass} ${className}`}
        title={name || email || 'Usuário'}
      >
        <span>{initials}</span>
      </div>
    );
  }

  // Caso 3: Imagem externa (URL HTTP ou Data URI)
  if (avatarUrl && (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:')) && !imageError) {
    return (
      <div className={`relative rounded-full overflow-hidden shrink-0 border border-border/80 bg-secondary ${sizeClass} ${className}`}>
        {/* Usamos img para suportar qualquer host de imagem configurado pelo usuário */}
        <img
          src={avatarUrl}
          alt={name || 'Avatar'}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // Caso 4: Padrão (Iniciais com tema primário)
  return (
    <div 
      className={`rounded-full bg-primary/15 border border-primary/30 text-primary font-bold flex items-center justify-center shrink-0 select-none ${sizeClass} ${className}`}
      title={name || email || 'Usuário'}
    >
      <span>{initials}</span>
    </div>
  );
}
