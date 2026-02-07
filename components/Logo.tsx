
import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
  variant?: 'white' | 'gradient';
}

const Logo: React.FC<LogoProps> = ({ className = '', size = 100, variant = 'gradient' }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="w-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
        <filter id="w-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
          <feOffset dx="0" dy="2" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.2" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      
      {/* Intricate 'W' Shape */}
      <path
        d="M20 25C20 25 25 70 35 75C45 80 48 45 50 40C52 35 55 80 65 75C75 70 80 25 80 25"
        stroke={variant === 'white' ? 'white' : 'url(#w-gradient)'}
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#w-shadow)"
      />
      
      {/* Subtle Inner Accent */}
      <path
        d="M26 35L36 68L48 42L60 68L70 35"
        stroke={variant === 'white' ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.6)'}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default Logo;
