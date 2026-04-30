import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { GlobalModalProvider } from './context/GlobalModalContext'
import { Toaster } from 'react-hot-toast'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GlobalModalProvider>
      <App />
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
