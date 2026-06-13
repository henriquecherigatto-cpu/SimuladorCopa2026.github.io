import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { MapPin, Clock, Eye, MessageCircle, Share2, Flag, ChevronLeft, ChevronRight, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/ui/Toast'
import type { Listing } from '../types'
import { Layout } from '../components/layout/Layout'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Avatar } from '../components/ui/Avatar'
import { Spinner } from '../components/ui/Spinner'
import { ConfirmModal } from '../components/ui/Modal'
import { ReviewModal } from '../components/listings/ReviewModal'
import { formatarPreco, formatarDataRelativa, ESTADO_MATERIAL_LABELS, TIPO_NEGOCIACAO_LABELS } from '../lib/utils'

export function ListingDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { success, info } = useToast()

  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)
  const [fotoAtual, setFotoAtual] = useState(0)
  const [confirmVendido, setConfirmVendido] = useState(false)
  const [marcandoVendido, setMarcandoVendido] = useState(false)
  const [showReview, setShowReview] = useState(false)

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase
        .from('listings')
        .select('*, profiles(*), categories(*), listing_images(*)')
        .eq('id', id!)
        .single()
      setListing(data)
      setLoading(false)
      if (data) {
        supabase.from('listings').update({ visualizacoes: (data.visualizacoes || 0) + 1 }).eq('id', id!)
      }
    }
    carregar()
  }, [id])

  async function marcarVendido() {
    setMarcandoVendido(true)
    await supabase.from('listings').update({ vendido: true, ativo: false }).eq('id', id!)
    setListing(prev => prev ? { ...prev, vendido: true, ativo: false } : prev)
    setMarcandoVendido(false)
    setConfirmVendido(false)
    success('Parabéns pela venda! 🎉')
  }

  async function compartilhar() {
    const url = window.location.href
    if (navigator.share) {
      await navigator.share({ title: listing?.titulo, url })
    } else {
      await navigator.clipboard.writeText(url)
      info('Link copiado!')
    }
  }

  if (loading) return (
    <Layout>
      <div className="flex justify-center py-20"><Spinner size="lg" className="text-terracota-400" /></div>
    </Layout>
  )

  if (!listing) return (
    <Layout>
      <div className="text-center py-20">
        <p className="text-concreto-500">Anúncio não encontrado.</p>
        <Link to="/" className="text-terracota-600 hover:underline mt-2 block">Voltar ao início</Link>
      </div>
    </Layout>
  )

  const fotos = listing.listing_images || []
  const vendedor = listing.profiles
  const isVendedor = user?.id === listing.vendedor_id

  const whatsappLink = vendedor?.telefone
    ? `https://wa.me/55${vendedor.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Vi seu anúncio "${listing.titulo}" no SobraDaObra e tenho interesse. Ainda disponível?`)}`
    : null

  return (
    <Layout noPadding>
      <div className="max-w-4xl mx-auto">
        {/* Galeria */}
        <div className="relative bg-concreto-100 aspect-[4/3] md:aspect-[16/9] md:rounded-2xl md:mx-4 md:mt-4 overflow-hidden">
          {fotos.length > 0 ? (
            <>
              <img src={fotos[fotoAtual]?.url} alt={listing.titulo} className="w-full h-full object-cover" />
              {fotos.length > 1 && (
                <>
                  <button onClick={() => setFotoAtual(i => (i - 1 + fotos.length) % fotos.length)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-2">
                    <ChevronLeft size={20} />
                  </button>
                  <button onClick={() => setFotoAtual(i => (i + 1) % fotos.length)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-2">
                    <ChevronRight size={20} />
                  </button>
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                    {fotos.map((_, i) => (
                      <button key={i} onClick={() => setFotoAtual(i)} className={`w-2 h-2 rounded-full transition-colors ${i === fotoAtual ? 'bg-white' : 'bg-white/50'}`} />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl">
              {listing.categories?.icone || '📦'}
            </div>
          )}
          {listing.vendido && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="bg-white text-concreto-700 font-bold text-xl px-6 py-3 rounded-2xl">VENDIDO</span>
            </div>
          )}
        </div>

        <div className="px-4 py-4 md:px-4 grid md:grid-cols-3 gap-6">
          {/* Detalhes principais */}
          <div className="md:col-span-2 space-y-4">
            <div>
              {listing.categories && (
                <Link to={`/busca?categoria=${listing.categories.slug}`} className="text-xs text-terracota-600 font-medium mb-2 block">
                  {listing.categories.icone} {listing.categories.nome}
                </Link>
              )}
              <h1 className="text-2xl font-bold text-concreto-800 leading-tight">{listing.titulo}</h1>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="text-2xl font-bold text-terracota-600">
                  {listing.tipo_negociacao === 'doacao' ? '🎁 Doação' : formatarPreco(listing.preco)}
                </span>
                <Badge variant="gray">{TIPO_NEGOCIACAO_LABELS[listing.tipo_negociacao]}</Badge>
                <Badge variant={listing.estado_material === 'novo' ? 'green' : listing.estado_material === 'com_defeito' ? 'red' : 'gray'}>
                  {ESTADO_MATERIAL_LABELS[listing.estado_material]}
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-concreto-500">
              {(listing.quantidade && listing.unidade) && (
                <span>📦 {listing.quantidade} {listing.unidade}</span>
              )}
              {listing.cidade && (
                <span className="flex items-center gap-1"><MapPin size={14} />{listing.cidade}{listing.estado_uf ? `, ${listing.estado_uf}` : ''}</span>
              )}
              <span className="flex items-center gap-1"><Clock size={14} />{formatarDataRelativa(listing.criado_em)}</span>
              <span className="flex items-center gap-1"><Eye size={14} />{listing.visualizacoes} visualizações</span>
            </div>

            {listing.descricao && (
              <div className="bg-white border border-concreto-100 rounded-2xl p-4">
                <h2 className="font-semibold text-concreto-700 mb-2">Descrição</h2>
                <p className="text-sm text-concreto-600 whitespace-pre-wrap leading-relaxed">{listing.descricao}</p>
              </div>
            )}

            {/* Miniaturas */}
            {fotos.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {fotos.map((f, i) => (
                  <button key={f.id} onClick={() => setFotoAtual(i)} className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-colors ${fotoAtual === i ? 'border-terracota-400' : 'border-concreto-100'}`}>
                    <img src={f.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-3">
            {vendedor && (
              <div className="bg-white border border-concreto-100 rounded-2xl p-4">
                <h2 className="font-semibold text-concreto-700 mb-3">Vendedor</h2>
                <Link to={`/usuario/${vendedor.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <Avatar src={vendedor.foto_url} nome={vendedor.nome} size="md" />
                  <div>
                    <p className="font-medium text-concreto-800 text-sm">{vendedor.nome}</p>
                    {vendedor.cidade && <p className="text-xs text-concreto-400">{vendedor.cidade}</p>}
                    {vendedor.total_avaliacoes > 0 && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Star size={12} className="text-yellow-400 fill-yellow-400" />
                        <span className="text-xs text-concreto-500">{vendedor.avaliacao_media.toFixed(1)} ({vendedor.total_avaliacoes})</span>
                      </div>
                    )}
                  </div>
                </Link>
              </div>
            )}

            {!listing.vendido && !isVendedor && (
              <div className="space-y-2">
                {whatsappLink && (
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                    <Button fullWidth size="lg" className="bg-green-500 hover:bg-green-600 w-full">
                      💬 Chamar no WhatsApp
                    </Button>
                  </a>
                )}
                <Button variant="outline" fullWidth size="lg" onClick={() => navigate(`/mensagens/novo?listing=${listing.id}&vendedor=${listing.vendedor_id}`)}>
                  <MessageCircle size={18} />
                  Enviar mensagem
                </Button>
                {user && vendedor && (
                  <Button variant="ghost" fullWidth size="sm" onClick={() => setShowReview(true)}>
                    <Star size={15} />
                    Avaliar vendedor
                  </Button>
                )}
              </div>
            )}

            {isVendedor && (
              <div className="space-y-2">
                <Link to={`/anuncio/${listing.id}/editar`}>
                  <Button variant="outline" fullWidth>Editar anúncio</Button>
                </Link>
                {!listing.vendido && (
                  <Button variant="secondary" fullWidth onClick={() => setConfirmVendido(true)}>
                    Marcar como vendido
                  </Button>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={compartilhar} className="flex-1">
                <Share2 size={16} />Compartilhar
              </Button>
              {!isVendedor && (
                <Link to={`/denunciar/${listing.id}`}>
                  <Button variant="ghost" size="sm">
                    <Flag size={16} />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmVendido}
        onClose={() => setConfirmVendido(false)}
        onConfirm={marcarVendido}
        title="Marcar como vendido?"
        message="O anúncio será arquivado e não aparecerá mais nas buscas."
        confirmLabel="Sim, foi vendido! 🎉"
        loading={marcandoVendido}
      />

      {vendedor && (
        <ReviewModal
          open={showReview}
          onClose={() => setShowReview(false)}
          avaliado={vendedor}
          listingId={id!}
        />
      )}
    </Layout>
  )
}
