import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swPath = `${import.meta.env.BASE_URL || './'}sw.js?v=4`
    navigator.serviceWorker
      .register(swPath)
      .then((registration) => {
        // 新版本安装完成后提示刷新，避免用户一直卡在旧缓存
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              if (window.confirm('骑手工作台已更新，点击确定立即使用最新版本')) {
                window.location.reload()
              }
            }
          })
        })
      })
      .catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(<App />)
