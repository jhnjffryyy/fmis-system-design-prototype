import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { StoreProvider } from './store'
import App from './App'
import logoUrl from './assets/dito-logo.jpg'
import './styles.css'

const fav = document.createElement('link')
fav.rel = 'icon'
fav.href = logoUrl
document.head.appendChild(fav)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
)
