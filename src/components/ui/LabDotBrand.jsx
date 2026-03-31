import React from 'react';

/**
 * LAB DOT — Deep Emerald (#064e3b), clean sans-serif, wide tracking.
 * @param {'splash' | 'hero' | 'header'} variant
 */
export function LabDotBrand({ variant = 'header', className = '' }) {
  if (variant === 'splash') {
    return (
      <div className={`flex flex-col items-center justify-center gap-5 ${className}`}>
        <div className="h-6 w-6 rounded-full bg-[#064e3b] shadow-sm" aria-hidden />
        <span className="font-sans text-lg font-semibold uppercase tracking-[0.38em] text-[#064e3b] md:text-xl">LAB DOT</span>
      </div>
    );
  }
  if (variant === 'hero') {
    return (
      <div className={`flex flex-col items-center gap-3 ${className}`}>
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#064e3b]" aria-hidden />
          <span className="font-sans text-3xl font-semibold uppercase tracking-[0.32em] text-[#064e3b] md:text-4xl">LAB DOT</span>
        </div>
      </div>
    );
  }
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className="h-2 w-2 shrink-0 rounded-full bg-[#064e3b]" aria-hidden />
      <span className="font-sans text-xl font-semibold uppercase tracking-[0.26em] text-[#064e3b]">LAB DOT</span>
    </div>
  );
}

export default LabDotBrand;
