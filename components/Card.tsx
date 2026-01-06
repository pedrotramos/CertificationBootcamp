
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => {
  return (
    <div 
      onClick={onClick}
      className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${onClick ? 'cursor-pointer hover:border-indigo-300 transition-colors' : ''} ${className}`}
    >
      {children}
    </div>
  );
};

export default Card;
