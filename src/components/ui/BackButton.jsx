import React from 'react';
import { ArrowLeft } from 'lucide-react';

const TONE = {
  light: 'bg-white/95 text-gray-600 hover:text-emerald-600',
  dark: 'bg-[#050505]/95 text-zinc-400 hover:text-white',
};

const BackButton = ({ onClick, label = '뒤로', tone = 'light', className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`sticky top-0 z-50 -mx-1 mb-4 flex min-h-11 w-full max-w-full items-center gap-2 px-1 py-2 backdrop-blur-sm transition-colors ${TONE[tone] || TONE.light} ${className}`}
    style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
  >
    <ArrowLeft size={20} className="shrink-0" />
    <span className="text-sm font-medium tracking-wide">{label}</span>
  </button>
);

export default BackButton;
