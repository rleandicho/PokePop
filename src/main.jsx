import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App            from './App.jsx'
import PublicWishlist from './components/PublicWishlist.jsx'
import PublicList     from './components/PublicList.jsx'
import CardDetailPage from './components/CardDetailPage.jsx'
import ErrorBoundary  from './components/ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/share/:userId"   element={<PublicWishlist />} />
          <Route path="/list/:listId"    element={<PublicList />} />
          <Route path="/card/:cardId"    element={<CardDetailPage />} />
          <Route path="/*"               element={<App />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
