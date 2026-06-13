import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Home, Search, PlusSquare, MessageSquare, User, LogOut } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { Avatar } from '../ui/Avatar'

export function Navbar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const isActive = (path: string) => location.pathname === path

  async function handleSignOut() {
    await signOut()
    navigate('/')
    setMenuOpen(false)
  }

  return (
    <>
      {/* Desktop top bar */}
      <header className="hidden md:flex fixed top-0 left-0 right-0 z-50 bg-white border-b border-concreto-100 shadow-sm h-16 items-center px-6 gap-4">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <span className="text-2xl">🧱</span>
          <span className="font-bold text-terracota-600 text-lg tracking-tight">SobraDaObra</span>
        </Link>

        <nav className="flex gap-1 ml-4">
          <NavLink to="/" active={isActive('/')}><Home size={16} />Início</NavLink>
          <NavLink to="/busca" active={isActive('/busca')}><Search size={16} />Buscar</NavLink>
        </nav>

        <div className="flex-1" />

        {user ? (
          <div className="flex items-center gap-3">
            <Link
              to="/novo-anuncio"
              className="bg-terracota-500 hover:bg-terracota-600 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 transition-colors"
            >
              <PlusSquare size={16} />
              Anunciar
            </Link>
            <Link to="/mensagens" className={`p-2 rounded-xl transition-colors ${isActive('/mensagens') ? 'bg-terracota-50 text-terracota-600' : 'text-concreto-500 hover:bg-gray-100'}`}>
              <MessageSquare size={20} />
            </Link>
            <div className="relative">
              <button onClick={() => setMenuOpen(v => !v)} className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-100 transition-colors">
                <Avatar src={profile?.foto_url} nome={profile?.nome} size="sm" />
                <span className="text-sm font-medium text-concreto-700 max-w-[120px] truncate">{profile?.nome}</span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-12 bg-white border border-concreto-100 rounded-2xl shadow-lg w-48 py-1 z-50">
                  <Link to="/perfil" className="flex items-center gap-2 px-4 py-2.5 text-sm text-concreto-700 hover:bg-gray-50" onClick={() => setMenuOpen(false)}>
                    <User size={16} />Meu perfil
                  </Link>
                  <Link to="/meus-anuncios" className="flex items-center gap-2 px-4 py-2.5 text-sm text-concreto-700 hover:bg-gray-50" onClick={() => setMenuOpen(false)}>
                    <PlusSquare size={16} />Meus anúncios
                  </Link>
                  <hr className="my-1 border-concreto-100" />
                  <button onClick={handleSignOut} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50">
                    <LogOut size={16} />Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link to="/entrar" className="px-4 py-2 text-sm font-medium text-concreto-600 hover:text-terracota-600 transition-colors">
              Entrar
            </Link>
            <Link to="/cadastro" className="bg-terracota-500 hover:bg-terracota-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
              Cadastrar
            </Link>
          </div>
        )}
      </header>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-concreto-100 safe-bottom">
        <div className="flex items-center justify-around h-16">
          <MobileNavItem to="/" icon={<Home size={22} />} label="Início" active={isActive('/')} />
          <MobileNavItem to="/busca" icon={<Search size={22} />} label="Buscar" active={isActive('/busca')} />
          {user ? (
            <Link
              to="/novo-anuncio"
              className="flex flex-col items-center justify-center -mt-5 bg-terracota-500 text-white rounded-2xl w-14 h-14 shadow-lg"
            >
              <PlusSquare size={24} />
            </Link>
          ) : (
            <Link
              to="/cadastro"
              className="flex flex-col items-center justify-center -mt-5 bg-terracota-500 text-white rounded-2xl w-14 h-14 shadow-lg"
            >
              <PlusSquare size={24} />
            </Link>
          )}
          <MobileNavItem to="/mensagens" icon={<MessageSquare size={22} />} label="Chat" active={isActive('/mensagens')} />
          <MobileNavItem to={user ? '/perfil' : '/entrar'} icon={<User size={22} />} label={user ? 'Perfil' : 'Entrar'} active={isActive('/perfil')} />
        </div>
      </nav>

      {/* Overlay for desktop dropdown */}
      {menuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
      )}
    </>
  )
}

function NavLink({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
        active ? 'bg-terracota-50 text-terracota-600' : 'text-concreto-500 hover:bg-gray-100'
      }`}
    >
      {children}
    </Link>
  )
}

function MobileNavItem({ to, icon, label, active }: { to: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      className={`flex flex-col items-center gap-0.5 px-3 py-2 transition-colors ${
        active ? 'text-terracota-500' : 'text-concreto-400'
      }`}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </Link>
  )
}
