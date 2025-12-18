import React from 'react';

interface CustomDisclaimerProps {
  children: React.ReactNode;
  title?: string;
  variant?: 'info' | 'warning' | 'note';
  className?: string;
  showIcon?: boolean;
  closable?: boolean;
  onClose?: () => void;
}

const CustomDisclaimer: React.FC<CustomDisclaimerProps> = ({
  children,
  title = 'Importante',
  variant = 'info',
  className = '',
  showIcon = true,
  closable = false,
  onClose
}) => {
  const variantClasses = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    note: 'bg-gray-50 border-gray-200 text-gray-800'
  };

  const iconMap: Record<string, React.ReactNode> = {
    info: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
      </svg>
    ),
    note: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
      </svg>
    )
  };

  const disclaimerIcon = showIcon ? iconMap[variant] : null;

  return (
    <div className={`border rounded-lg p-4 mb-4 ${variantClasses[variant]} ${className}`}>
      <div className="flex items-start">
        {disclaimerIcon && <span className="mr-3 mt-0.5 flex-shrink-0">{disclaimerIcon}</span>}
        <div className="flex-1">
          <h3 className="text-sm font-semibold mb-1">{title}</h3>
          <div className="text-sm">{children}</div>
        </div>
        {closable && onClose && (
          <button 
            onClick={onClose}
            className="ml-4 text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default CustomDisclaimer;