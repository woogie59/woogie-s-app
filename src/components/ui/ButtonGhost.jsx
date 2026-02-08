import React from 'react'

const ButtonGhost = ({ children, onClick, className = '' }) => (
  <button
    onClick={onClick}
    className={`w-full py-3 px-6 text-zinc-400 text-sm hover:text-white transition-colors tracking-widest uppercase ${className}`}
  >
    {children}
  </button>
)

export default ButtonGhost

