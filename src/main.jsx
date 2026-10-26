import { DesignRefinementProvider } from './features/design/DesignRefinement'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import OtBookingPage from './pages/ot/OtBookingPage.jsx'
import AdminOtLinks from './features/admin/AdminOtLinks.jsx'
import { GlobalModalProvider } from './context/GlobalModalContext'
import { Toaster } from 'react-hot-toast'

// 오티 전용 공개 입구: /ot/<token> — 로그인·회원 화면과 완전히 분리
const otMatch = window.location.pathname.match(/^\/ot\/([0-9a-fA-F-]{36})\/?$/)
// 검토용 데모 전용: 관리자 링크 관리 화면을 로그인 없이 더미 데이터로 확인 (?demo=1 필수)
const demoAdminOt = window.location.pathname === '/demo/admin-ot-links' && new URLSearchParams(window.location.search).get('demo') === '1'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DesignRefinementProvider><GlobalModalProvider>
      {demoAdminOt ? <AdminOtLinks goBack={() => window.history.back()} /> : otMatch ? <OtBookingPage token={otMatch[1]} /> : <App />}
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
    </GlobalModalProvider></DesignRefinementProvider>
  </StrictMode>,
)
