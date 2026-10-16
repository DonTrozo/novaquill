"use client";

import { useLanguage } from "@/context/LanguageContext";

import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

export default function LoadingSpinner({ 
  size = 'md', 
  text, 
  className = '' 
}: LoadingSpinnerProps) {
  const { t } = useLanguage();
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const borderClasses = {
    sm: 'border-2',
    md: 'border-4',
    lg: 'border-4'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div 
        className={`animate-spin inline-block ${sizeClasses[size]} ${borderClasses[size]} border-foreground/30 border-t-foreground/70 rounded-full`}
        role="status"
        aria-label={t("Loading")}
      />
      {text && (
        <p className="mt-3 text-foreground/70 text-sm">{t(text)}</p>
      )}
    </div>
  );
}

// Convenience components for common use cases
export function LoadingSpinnerSmall({ text, className }: Omit<LoadingSpinnerProps, 'size'>) {
  return <LoadingSpinner size="sm" text={text} className={className} />;
}

export function LoadingSpinnerLarge({ text, className }: Omit<LoadingSpinnerProps, 'size'>) {
  return <LoadingSpinner size="lg" text={text} className={className} />;
}

// Inline loading spinner for buttons and small spaces
export function LoadingDot() {
  return (
    <div className="inline-flex items-center gap-1">
      <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
      <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
      <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
    </div>
  );
}
