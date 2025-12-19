import React from 'react';
import AiChatFlowLogo from './aichatflow-logo';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showText?: boolean;
}

const Logo: React.FC<LogoProps> = ({ size = 'md', className = '', showText = false }) => {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <AiChatFlowLogo size={size} variant={showText ? 'with-text' : 'simple'} />
    </div>
  );
};

export default Logo;