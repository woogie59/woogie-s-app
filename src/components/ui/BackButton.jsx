import React from 'react';
import { ArrowLeft } from 'lucide-react';

const BackButton = ({ onClick, label = "뒤로" }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 text-gray-600 hover:text-emerald-600 transition-colors mb-4"
  >
    <ArrowLeft size={20} />
    <span className="text-sm font-medium tracking-wide text-gray-600">{label}</span>
  </button>
);

export default BackButton;
