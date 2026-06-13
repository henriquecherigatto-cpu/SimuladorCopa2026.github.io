import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './hooks/useAuth'
import { ToastProvider } from './components/ui/Toast'
import { ProtectedRoute } from './components/layout/ProtectedRoute'

import { Home } from './pages/Home'
import { Search } from './pages/Search'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { VerifyEmail } from './pages/VerifyEmail'
import { ListingDetail } from './pages/ListingDetail'
import { CreateListing } from './pages/CreateListing'
import { EditListing } from './pages/EditListing'
import { MyListings } from './pages/MyListings'
import { Profile } from './pages/Profile'
import { Messages } from './pages/Messages'
import { Report } from './pages/Report'
import { Terms } from './pages/Terms'
import { Privacy } from './pages/Privacy'
import { NotFound } from './pages/NotFound'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/busca" element={<Search />} />
              <Route path="/entrar" element={<Login />} />
              <Route path="/cadastro" element={<Register />} />
              <Route path="/verificar-email" element={<VerifyEmail />} />
              <Route path="/anuncio/:id" element={<ListingDetail />} />
              <Route path="/usuario/:id" element={<Profile />} />
              <Route path="/termos" element={<Terms />} />
              <Route path="/privacidade" element={<Privacy />} />
              <Route
                path="/novo-anuncio"
                element={<ProtectedRoute><CreateListing /></ProtectedRoute>}
              />
              <Route
                path="/anuncio/:id/editar"
                element={<ProtectedRoute><EditListing /></ProtectedRoute>}
              />
              <Route
                path="/meus-anuncios"
                element={<ProtectedRoute><MyListings /></ProtectedRoute>}
              />
              <Route
                path="/perfil"
                element={<ProtectedRoute><Profile /></ProtectedRoute>}
              />
              <Route
                path="/mensagens"
                element={<ProtectedRoute><Messages /></ProtectedRoute>}
              />
              <Route
                path="/mensagens/novo"
                element={<ProtectedRoute><Messages /></ProtectedRoute>}
              />
              <Route
                path="/denunciar/:id"
                element={<ProtectedRoute><Report /></ProtectedRoute>}
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
