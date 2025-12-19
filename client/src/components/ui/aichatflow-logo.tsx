import React from 'react';

interface AiChatFlowLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  variant?: 'simple' | 'with-text';
}

const AiChatFlowLogo: React.FC<AiChatFlowLogoProps> = ({ 
  size = 'md', 
  className = '',
  variant = 'simple'
}) => {
  // Definir tamanhos
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg'
  };

  // Ícones combinados de IA (circuitos e conversas)
  const logoContent = (
    <svg 
      viewBox="0 0 100 100" 
      className={`${sizeClasses[size]} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      {/* Fundo circular com gradiente */}
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" /> {/* Azul primário */}
          <stop offset="100%" stopColor="#8B5CF6" /> {/* Roxo secundário */}
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="1" dy="1" stdDeviation="2" floodOpacity="0.3"/>
        </filter>
      </defs>
      
      {/* Círculo externo com gradiente */}
      <circle 
        cx="50" 
        cy="50" 
        r="45" 
        fill="url(#logoGradient)" 
        filter="url(#shadow)"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="1"
      />
      
      {/* Símbolo de IA - circuito estilizado */}
      <path 
        d="M30,40 L35,40 L35,35 L45,35 L45,40 L50,40 L50,45 L45,45 L45,50 L40,50 L40,55 L35,55 L35,50 L30,50 Z" 
        fill="white" 
        opacity="0.9"
      />
      
      {/* Símbolo de chat - bolhas de fala */}
      <circle cx="65" cy="35" r="7" fill="white" opacity="0.8" />
      <circle cx="70" cy="50" r="8" fill="white" opacity="0.9" />
      <circle cx="60" cy="55" r="6" fill="white" opacity="0.7" />
      
      {/* Elemento de conexão - representando fluxo */}
      <path 
        d="M42,45 Q48,42 55,45 Q62,48 65,55" 
        stroke="white" 
        strokeWidth="2" 
        fill="none" 
        opacity="0.7"
      />
      <circle cx="65" cy="55" r="2" fill="white" opacity="0.9" />
    </svg>
  );

  if (variant === 'with-text') {
    return (
      <div className="flex items-center space-x-2">
        {logoContent}
        <span className={`font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 ${textSizeClasses[size]}`}>
          AiChatFlow
        </span>
      </div>
    );
  }

  return logoContent;
};

export default AiChatFlowLogo;