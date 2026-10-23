import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import OtBookingPage from './pages/ot/OtBookingPage.jsx'
import { GlobalModalProvider } from './context/GlobalModalContext'
import { Toaster } from 'react-hot-toast'

// 오티 전용 공개 입구: /ot/<token> — 로그인·회원 화면과 완전히 분리
const otMatch = window.location.pathname.match(/^\/ot\/([0-9a-fA-F-]{36})\/?$/)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GlobalModalProvider>
      {otMatch ? <OtBookingPage token={otMatch[1]} /> : <App />}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3500,
          style: {
            borderRadius: '12px',
            background: '#111827',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
          },
        }}
      />
    </GlobalModalProvider>
  </StrictMode>,
)
