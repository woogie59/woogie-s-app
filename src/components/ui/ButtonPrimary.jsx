import React from 'react'

const ButtonPrimary = ({ children, onClick, className = '', icon: Icon, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`w-full py-4 px-6 bg-emerald-600 border border-emerald-700/30 rounded-xl text-white font-semibold tracking-wide shadow-sm hover:shadow-md active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
  >
    {Icon && <Icon size={20} />}
    {children}
  </button>
)

export default ButtonPrimary

