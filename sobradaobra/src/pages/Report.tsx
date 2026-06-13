import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Flag } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/ui/Toast'
import { Layout } from '../components/layout/Layout'
import { Button } from '../components/ui/Button'

const MOTIVOS = [
  'Material falso ou enganoso',
  'Preço abusivo ou golpe',
  'Anúncio duplicado ou spam',
  'Conteúdo inapropriado',
  'Material proibido',
  'Vendedor não responde',
  'Outro motivo',
]

export function Report() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { success, error } = useToast()
  const [motivo, setMotivo] = useState('')
  const [detalhe, setDetalhe] = useState('')
  const [loading, setLoading] = useState(false)

  if (!user) {
    return (
      <Layout>
        <div className="max-w-md mx-auto text-center py-16">
          <p className="text-concreto-500 mb-4">Faça login para denunciar um anúncio.</p>
          <Link to="/entrar" className="text-terracota-600 font-medium hover:underline">Entrar</Link>
        </div>
      </Layout>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!motivo) { error('Selecione um motivo.'); return }
    setLoading(true)
    const { error: err } = await supabase.from('reports').insert({
      reporter_id: user!.id,
      listing_id: id!,
      motivo: detalhe ? `${motivo}: ${detalhe}` : motivo,
    })
    setLoading(false)
    if (err) {
      error('Erro ao enviar denúncia.')
    } else {
      success('Denúncia enviada. Nossa equipe irá analisar.')
      navigate(`/anuncio/${id}`)
    }
  }

  return (
    <Layout>
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
            <Flag size={20} className="text-red-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-concreto-800">Denunciar anúncio</h1>
            <p className="text-sm text-concreto-500">Ajude a manter a comunidade segura</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-concreto-100 p-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <p className="text-sm font-medium text-concreto-700 mb-3">Qual é o motivo da denúncia?</p>
              <div className="space-y-2">
                {MOTIVOS.map(m => (
                  <label key={m} className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${motivo === m ? 'border-red-400 bg-red-50' : 'border-concreto-200 hover:border-concreto-300'}`}>
                    <input type="radio" name="motivo" value={m} checked={motivo === m} onChange={() => setMotivo(m)} className="sr-only" />
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${motivo === m ? 'border-red-500 bg-red-500' : 'border-concreto-300'}`}>
                      {motivo === m && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <span className="text-sm text-concreto-700">{m}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-concreto-700 block mb-1">Detalhes adicionais (opcional)</label>
              <textarea
                value={detalhe}
                onChange={e => setDetalhe(e.target.value)}
                placeholder="Descreva o problema com mais detalhes..."
                rows={3}
                className="w-full border border-concreto-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" fullWidth onClick={() => navigate(-1)} type="button">
                Cancelar
              </Button>
              <Button variant="danger" fullWidth loading={loading} type="submit">
                Enviar denúncia
              </Button>
            </div>
          </form>
        </div>

        <p className="text-xs text-concreto-400 text-center mt-4">
          Denúncias falsas ou de má-fé podem resultar em suspensão da conta.
        </p>
      </div>
    </Layout>
  )
}
