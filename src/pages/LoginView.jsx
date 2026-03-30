import React, { useState } from 'react'
import ButtonPrimary from '../components/ui/ButtonPrimary.jsx'

const LoginView = ({ handleLogin, setView, error }) => {
  const [id, setId] = useState('')
  const [pw, setPw] = useState('')

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-white px-6 text-slate-900">
      <div className="mb-12 text-center">
        <h2 className="mb-2 text-3xl font-serif text-emerald-600">THE COACH</h2>
        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
          Premium Management System
        </p>
      </div>
      <div className="w-full max-w-sm space-y-4">
        <input
          type="text"
          placeholder="ID"
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-slate-900 outline-none focus:border-emerald-600"
          value={id}
          onChange={(e) => setId(e.target.value)}
        />
        <input
          type="password"
          placeholder="PASSWORD"
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-slate-900 outline-none focus:border-emerald-600"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        <ButtonPrimary onClick={() => handleLogin(id, pw)}>ENTER</ButtonPrimary>
        {error && (
          <p className="text-center text-sm text-red-500">{error}</p>
        )}
      </div>
      <div className="mt-6 flex gap-4 text-xs text-gray-500">
        <button
          onClick={() => setView('find_account')}
          className="hover:text-emerald-600"
        >
          ID/PW 찾기
        </button>
        <span className="text-gray-500">|</span>
        <button
          onClick={() => setView('register')}
          className="hover:text-emerald-600"
        >
          회원가입
        </button>
      </div>
      <div className="mt-8 text-center text-xs text-gray-600">
        <p>Demo Admin: admin / 1234</p>
        <p>Demo User: user1 / 1234</p>
      </div>
    </div>
  )
}

export default LoginView

