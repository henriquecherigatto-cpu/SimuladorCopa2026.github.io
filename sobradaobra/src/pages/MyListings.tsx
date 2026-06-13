import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle, Eye, EyeOff, Edit, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/ui/Toast'
import type { Listing } from '../types'
import { Layout } from '../components/layout/Layout'
import { Badge } from '../components/ui/Badge'
import { Spinner } from '../components/ui/Spinner'
import { ConfirmModal } from '../components/ui/Modal'
import { formatarPreco, formatarDataRelativa, ESTADO_MATERIAL_LABELS } from '../lib/utils'

type Aba = 'ativos' | 'pausados' | 'vendidos'

export function MyListings() {
  const { user } = useAuth()
  const { success, error } = useToast()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState<Aba>('ativos')
  const [confirmVendido, setConfirmVendido] = useState<string | null>(null)
  const [processando, setProcessando] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('listings')
      .select('*, categories(*), listing_images(*)')
      .eq('vendedor_id', user.id)
      .order('criado_em', { ascending: false })
      .then(({ data }) => {
        setListings(data || [])
        setLoading(false)
      })
  }, [user])

  async function pausar(id: string, pausar: boolean) {
    setProcessando(id)
    const { error: err } = await supabase.from('listings').update({ ativo: !pausar }).eq('id', id)
    if (err) { error('Erro ao atualizar.'); setProcessando(null); return }
    setListings(prev => prev.map(l => l.id === id ? { ...l, ativo: !pausar } : l))
    success(pausar ? 'Anúncio pausado.' : 'Anúncio reativado.')
    setProcessando(null)
  }

  async function marcarVendido(id: string) {
    setProcessando(id)
    const { error: err } = await supabase.from('listings').update({ vendido: true, ativo: false }).eq('id', id)
    if (err) { error('Erro ao atualizar.'); setProcessando(null); return }
    setListings(prev => prev.map(l => l.id === id ? { ...l, vendido: true, ativo: false } : l))
    success('Ótimo! Anúncio marcado como vendido.')
    setConfirmVendido(null)
    setProcessando(null)
  }

  const ativos = listings.filter(l => l.ativo && !l.vendido)
  const pausados = listings.filter(l => !l.ativo && !l.vendido)
  const vendidos = listings.filter(l => l.vendido)

  const abas: { id: Aba; label: string; count: number }[] = [
    { id: 'ativos', label: 'Ativos', count: ativos.length },
    { id: 'pausados', label: 'Pausados', count: pausados.length },
    { id: 'vendidos', label: 'Vendidos', count: vendidos.length },
  ]

  const atual = { ativos, pausados, vendidos }[aba]

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-concreto-800">Meus anúncios</h1>
          <Link
            to="/novo-anuncio"
            className="flex items-center gap-2 bg-terracota-500 hover:bg-terracota-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <PlusCircle size={16} />
            Novo anúncio
          </Link>
        </div>

        {/* Abas */}
        <div className="flex gap-1 bg-concreto-50 rounded-2xl p-1 mb-6">
          {abas.map(a => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                aba === a.id ? 'bg-white text-concreto-800 shadow-sm' : 'text-concreto-500 hover:text-concreto-700'
              }`}
            >
              {a.label}
              {a.count > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${aba === a.id ? 'bg-terracota-100 text-terracota-600' : 'bg-concreto-200 text-concreto-500'}`}>
                  {a.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner className="text-terracota-400" /></div>
        ) : atual.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📦</div>
            <p className="text-concreto-500">
              {aba === 'ativos' && 'Você não tem anúncios ativos.'}
              {aba === 'pausados' && 'Nenhum anúncio pausado.'}
              {aba === 'vendidos' && 'Nenhum anúncio vendido ainda.'}
            </p>
            {aba === 'ativos' && (
              <Link to="/novo-anuncio" className="mt-3 inline-block text-terracota-600 font-medium hover:underline text-sm">
                Criar meu primeiro anúncio →
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {atual.map(listing => {
              const foto = listing.listing_images?.[0]?.url
              const categoria = listing.categories
              return (
                <div key={listing.id} className="bg-white border border-concreto-100 rounded-2xl p-4 flex gap-4">
                  {/* Miniatura */}
                  <Link to={`/anuncio/${listing.id}`} className="shrink-0">
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-concreto-100">
                      {foto ? (
                        <img src={foto} alt={listing.titulo} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">
                          {categoria?.icone || '📦'}
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Detalhes */}
                  <div className="flex-1 min-w-0">
                    <Link to={`/anuncio/${listing.id}`} className="font-medium text-concreto-800 text-sm hover:text-terracota-600 line-clamp-1">
                      {listing.titulo}
                    </Link>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <Badge variant="gray" size="sm">{ESTADO_MATERIAL_LABELS[listing.estado_material]}</Badge>
                      {categoria && <Badge variant="terracota" size="sm">{categoria.icone} {categoria.nome}</Badge>}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-semibold text-terracota-600 text-sm">
                        {listing.tipo_negociacao === 'doacao' ? 'Doação' : formatarPreco(listing.preco)}
                      </span>
                      <span className="text-xs text-concreto-400">{formatarDataRelativa(listing.criado_em)}</span>
                    </div>

                    {/* Ações */}
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <Link to={`/anuncio/${listing.id}/editar`} className="flex items-center gap-1 text-xs text-concreto-600 border border-concreto-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                        <Edit size={12} />Editar
                      </Link>
                      {!listing.vendido && (
                        <>
                          <button
                            onClick={() => pausar(listing.id, listing.ativo)}
                            disabled={processando === listing.id}
                            className="flex items-center gap-1 text-xs text-concreto-600 border border-concreto-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                          >
                            {listing.ativo ? <><EyeOff size={12} />Pausar</> : <><Eye size={12} />Reativar</>}
                          </button>
                          {listing.ativo && (
                            <button
                              onClick={() => setConfirmVendido(listing.id)}
                              className="flex items-center gap-1 text-xs text-green-600 border border-green-200 px-2.5 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
                            >
                              <CheckCircle size={12} />Vendido
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!confirmVendido}
        onClose={() => setConfirmVendido(null)}
        onConfirm={() => confirmVendido && marcarVendido(confirmVendido)}
        title="Marcar como vendido?"
        message="O anúncio será arquivado e não aparecerá mais nas buscas."
        confirmLabel="Sim, foi vendido!"
        loading={processando === confirmVendido}
      />
    </Layout>
  )
}
