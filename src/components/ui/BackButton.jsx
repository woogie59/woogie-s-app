import React from 'react';
import { ArrowLeft } from 'lucide-react';

const BackButton = ({ onClick, label = "Back" }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 text-zinc-400 hover:text-yellow-500 transition-colors mb-4"
  >
    <ArrowLeft size={20} />
    <span className="text-sm uppercase tracking-wider">{label}</span>
  </button>
);

export default BackButton;
