import React from 'react';

/**
 * LAB DOT — Deep Emerald (#064e3b). Dot is sized in `em` inside a 1em box so it aligns
 * with the cap height / optical center of the wordmark on all variants.
 * @param {'splash' | 'hero' | 'header'} variant
 */
export function LabDotBrand({ variant = 'header', className = '' }) {
  if (variant === 'splash') {
    return (
      <div className={`flex flex-col items-center justify-center gap-5 ${className}`}>
        <div className="h-6 w-6 shrink-0 rounded-full bg-[#064e3b] shadow-sm" aria-hidden />
        <span className="font-sans text-lg font-semibold uppercase tracking-[0.38em] text-[#064e3b] leading-none md:text-xl">
          LAB DOT
        </span>
      </div>
    );
  }
  if (variant === 'hero') {
    return (
      <div className={`inline-flex flex-col items-center justify-center gap-3 ${className}`}>
        <div className="inline-flex items-center justify-center gap-3 text-3xl font-semibold uppercase text-[#064e3b] md:text-4xl">
          <span className="inline-flex h-[1em] w-[1em] shrink-0 items-center justify-center" aria-hidden>
            <span className="h-[0.45em] w-[0.45em] rounded-full bg-[#064e3b]" />
          </span>
          <span className="font-sans tracking-[0.32em] leading-none">LAB DOT</span>
        </div>
      </div>
    );
  }
  return (
    <div
      className={`inline-flex items-center justify-center gap-2.5 text-xl font-semibold uppercase text-[#064e3b] ${className}`}
    >
      <span className="inline-flex h-[1em] w-[1em] shrink-0 items-center justify-center" aria-hidden>
        <span className="h-[0.45em] w-[0.45em] rounded-full bg-[#064e3b]" />
      </span>
      <span className="font-sans tracking-[0.26em] leading-none">LAB DOT</span>
    </div>
  );
}

export default LabDotBrand;
