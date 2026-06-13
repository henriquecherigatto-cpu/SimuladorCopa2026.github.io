import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export function Login() {
  const { signIn, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    const { error } = await signIn(email, senha)
    setLoading(false)
    if (error) {
      setErro(traduzirErro(error.message))
    } else {
      navigate(from, { replace: true })
    }
  }

  async function handleGoogle() {
    setLoadingGoogle(true)
    await signInWithGoogle()
    setLoadingGoogle(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🧱</div>
          <h1 className="text-2xl font-bold text-concreto-800">SobraDaObra</h1>
          <p className="text-concreto-500 mt-1">Bem-vindo de volta!</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-concreto-100 p-6 md:p-8">
          <h2 className="text-xl font-semibold text-concreto-800 mb-6">Entrar na conta</h2>

          {/* Google */}
          <Button
            variant="outline"
            fullWidth
            size="lg"
            loading={loadingGoogle}
            onClick={handleGoogle}
            className="mb-4 border-concreto-200 text-concreto-700"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="" />
            Entrar com Google
          </Button>

          <div className="flex items-center gap-3 mb-4">
            <hr className="flex-1 border-concreto-100" />
            <span className="text-xs text-concreto-400">ou</span>
            <hr className="flex-1 border-concreto-100" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="E-mail"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              leftIcon={<Mail size={16} />}
              required
              autoComplete="email"
            />
            <Input
              label="Senha"
              type={mostrarSenha ? 'text' : 'password'}
              placeholder="••••••••"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              leftIcon={<Lock size={16} />}
              rightElement={
                <button type="button" onClick={() => setMostrarSenha(v => !v)}>
                  {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
              required
              autoComplete="current-password"
            />

            {erro && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
                {erro}
              </div>
            )}

            <Button type="submit" fullWidth size="lg" loading={loading}>
              Entrar
            </Button>
          </form>

          <p className="text-center text-sm text-concreto-500 mt-4">
            Não tem conta?{' '}
            <Link to="/cadastro" className="text-terracota-600 font-medium hover:underline">
              Cadastre-se grátis
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

function traduzirErro(msg: string): string {
  if (msg.includes('Invalid login')) return 'E-mail ou senha incorretos.'
  if (msg.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.'
  if (msg.includes('rate limit')) return 'Muitas tentativas. Aguarde alguns minutos.'
  return 'Erro ao entrar. Tente novamente.'
}
