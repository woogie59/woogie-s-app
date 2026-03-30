import React from 'react'

const ButtonGhost = ({ children, onClick, className = '' }) => (
  <button
    onClick={onClick}
    className={`w-full py-3 px-6 text-gray-500 text-sm hover:text-emerald-700 transition-colors tracking-widest uppercase ${className}`}
  >
    {children}
  </button>
)

export default ButtonGhost

