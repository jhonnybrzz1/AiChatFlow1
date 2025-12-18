import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'primary' | 'secondary';
  label?: string;
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'default',
  label,
  className = ''
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const spinnerClasses = sizeClasses[size];

  const borderClasses = {
    default: 'border-gray-300 border-t-blue-600',
    primary: 'border-blue-300 border-t-blue-600',
    secondary: 'border-gray-300 border-t-gray-600'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className={`${spinnerClasses} rounded-full border-4 ${borderClasses[variant]} animate-spin`}></div>
      {label && <span className="mt-2 text-sm text-gray-600">{label}</span>}
    </div>
  );
};

export default LoadingSpinner;