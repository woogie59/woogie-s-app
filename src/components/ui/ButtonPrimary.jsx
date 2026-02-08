import React from 'react'

const ButtonPrimary = ({ children, onClick, className = '', icon: Icon }) => (
  <button
    onClick={onClick}
    className={`w-full py-4 px-6 bg-gradient-to-r from-zinc-800 to-zinc-900 border border-yellow-600/30 rounded-xl text-yellow-500 font-medium tracking-wide shadow-lg hover:shadow-yellow-900/20 active:scale-95 transition-all flex items-center justify-center gap-3 ${className}`}
  >
    {Icon && <Icon size={20} />}
    {children}
  </button>
)

export default ButtonPrimary

