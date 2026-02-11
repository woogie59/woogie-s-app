import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { GlobalModalProvider } from './context/GlobalModalContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GlobalModalProvider>
      <App />
    </GlobalModalProvider>
  </StrictMode>,
)
