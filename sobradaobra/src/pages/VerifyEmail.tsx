import { Link, useLocation } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function VerifyEmail() {
  const location = useLocation()
  const email = (location.state as { email?: string })?.email || ''
  const [reenviado, setReenviado] = useState(false)
  const [loading, setLoading] = useState(false)

  async function reenviarEmail() {
    setLoading(true)
    await supabase.auth.resend({ type: 'signup', email })
    setLoading(false)
    setReenviado(true)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="bg-white rounded-2xl shadow-sm border border-concreto-100 p-8">
          <div className="w-16 h-16 bg-terracota-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail size={32} className="text-terracota-500" />
          </div>
          <h2 className="text-xl font-semibold text-concreto-800 mb-2">Confirme seu e-mail</h2>
          <p className="text-concreto-500 mb-1">
            Enviamos um link de confirmação para:
          </p>
          <p className="font-medium text-concreto-700 mb-6">{email}</p>
          <p className="text-sm text-concreto-400 mb-6">
            Clique no link do e-mail para ativar sua conta. Verifique também a pasta de spam.
          </p>

          {reenviado ? (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm mb-4">
              E-mail reenviado com sucesso!
            </div>
          ) : (
            <Button variant="outline" fullWidth onClick={reenviarEmail} loading={loading} className="mb-4">
              Reenviar e-mail
            </Button>
          )}

          <Link to="/entrar" className="text-sm text-terracota-600 font-medium hover:underline">
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  )
}
