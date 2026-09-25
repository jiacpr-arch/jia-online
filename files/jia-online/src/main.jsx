import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './ErrorBoundary'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)

// PWA: ติดตั้งเป็นแอปได้ + คู่มือ CPR ฉุกเฉิน (/emergency.html) ใช้ได้ตอนออฟไลน์ — เฉพาะ production build
// (dev server ของ Vite ไม่ใช้ service worker กันแคชค้างระหว่างพัฒนา)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}) })
}
