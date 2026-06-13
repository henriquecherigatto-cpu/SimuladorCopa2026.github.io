import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Star, MapPin, Calendar, MessageCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Profile as ProfileType, Listing } from '../types'
import { Layout } from '../components/layout/Layout'
import { Avatar } from '../components/ui/Avatar'
import { ListingCard } from '../components/listings/ListingCard'
import { Spinner } from '../components/ui/Spinner'
import { formatarData } from '../lib/utils'

export function Profile() {
  const { id } = useParams<{ id: string }>()
  const { user, refreshProfile } = useAuth()

  const profileId = id || user?.id
  const isMyProfile = !id || id === user?.id

  const [profile, setProfile] = useState<ProfileType | null>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({ nome: '', telefone: '', cidade: '', estado: '', bio: '' })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    async function carregar() {
      if (!profileId) return
      const [{ data: prof }, { data: lista }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', profileId).single(),
        supabase.from('listings')
          .select('*, categories(*), listing_images(*)')
          .eq('vendedor_id', profileId).eq('ativo', true)
          .order('criado_em', { ascending: false }),
      ])
      setProfile(prof)
      setListings(lista || [])
      if (prof) setForm({ nome: prof.nome, telefone: prof.telefone || '', cidade: prof.cidade || '', estado: prof.estado || '', bio: prof.bio || '' })
      setLoading(false)
    }
    carregar()
  }, [profileId])

  async function salvarPerfil() {
    setSalvando(true)
    await supabase.from('profiles').update({ nome: form.nome, telefone: form.telefone, cidade: form.cidade, estado: form.estado, bio: form.bio }).eq('id', user!.id)
    await refreshProfile()
    setProfile(prev => prev ? { ...prev, ...form } : prev)
    setSalvando(false)
    setEditando(false)
  }

  if (loading) return <Layout><div className="flex justify-center py-20"><Spinner size="lg" className="text-terracota-400" /></div></Layout>
  if (!profile) return <Layout><p className="text-center py-20 text-concreto-500">Usuário não encontrado.</p></Layout>

  const ativos = listings.filter(l => !l.vendido)
  const vendidos = listings.filter(l => l.vendido)

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header do perfil */}
        <div className="bg-white rounded-2xl border border-concreto-100 p-6">
          <div className="flex items-start gap-4">
            <Avatar src={profile.foto_url} nome={profile.nome} size="xl" />
            <div className="flex-1 min-w-0">
              {editando ? (
                <input
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  className="text-xl font-bold border-b-2 border-terracota-400 focus:outline-none w-full mb-1"
                />
              ) : (
                <h1 className="text-xl font-bold text-concreto-800">{profile.nome}</h1>
              )}

              <div className="flex flex-wrap gap-3 text-sm text-concreto-500 mt-1">
                {profile.cidade && !editando && (
                  <span className="flex items-center gap-1"><MapPin size={14} />{profile.cidade}{profile.estado ? `, ${profile.estado}` : ''}</span>
                )}
                <span className="flex items-center gap-1"><Calendar size={14} />Membro desde {formatarData(profile.criado_em)}</span>
              </div>

              {profile.total_avaliacoes > 0 && (
                <div className="flex items-center gap-1 mt-2">
                  {[1,2,3,4,5].map(n => (
                    <Star key={n} size={16} className={n <= Math.round(profile.avaliacao_media) ? 'text-yellow-400 fill-yellow-400' : 'text-concreto-200'} />
                  ))}
                  <span className="text-sm text-concreto-500 ml-1">{profile.avaliacao_media.toFixed(1)} ({profile.total_avaliacoes} avaliações)</span>
                </div>
              )}
            </div>
          </div>

          {editando ? (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-concreto-500 block mb-1">Cidade</label>
                  <input value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} className="w-full border border-concreto-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracota-400" />
                </div>
                <div>
                  <label className="text-xs text-concreto-500 block mb-1">Estado (UF)</label>
                  <input value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} maxLength={2} className="w-full border border-concreto-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracota-400 uppercase" />
                </div>
              </div>
              <div>
                <label className="text-xs text-concreto-500 block mb-1">WhatsApp (somente números)</label>
                <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} type="tel" placeholder="11999999999" className="w-full border border-concreto-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracota-400" />
              </div>
              <div>
                <label className="text-xs text-concreto-500 block mb-1">Bio</label>
                <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} rows={3} className="w-full border border-concreto-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracota-400 resize-none" />
              </div>
              <div className="flex gap-2">
                <button onClick={salvarPerfil} disabled={salvando} className="bg-terracota-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-terracota-600 disabled:opacity-50">
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
                <button onClick={() => setEditando(false)} className="border border-concreto-200 px-4 py-2 rounded-xl text-sm text-concreto-600 hover:bg-gray-50">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              {profile.bio && <p className="text-sm text-concreto-600 mt-3">{profile.bio}</p>}
              <div className="flex gap-2 mt-4">
                {isMyProfile && (
                  <button onClick={() => setEditando(true)} className="border border-concreto-200 px-4 py-2 rounded-xl text-sm text-concreto-600 hover:bg-gray-50 transition-colors">
                    Editar perfil
                  </button>
                )}
                {!isMyProfile && (
                  <Link to={`/mensagens/novo?vendedor=${profile.id}`} className="flex items-center gap-2 border border-concreto-200 px-4 py-2 rounded-xl text-sm text-concreto-600 hover:bg-gray-50 transition-colors">
                    <MessageCircle size={16} />Enviar mensagem
                  </Link>
                )}
              </div>
            </>
          )}
        </div>

        {/* Anúncios */}
        <div>
          <h2 className="text-lg font-semibold text-concreto-800 mb-4">
            Anúncios ({ativos.length} ativo{ativos.length !== 1 ? 's' : ''})
          </h2>
          {ativos.length === 0 ? (
            <p className="text-concreto-400 text-sm text-center py-8">Nenhum anúncio ativo.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {ativos.map(l => <ListingCard key={l.id} listing={l} />)}
            </div>
          )}

          {vendidos.length > 0 && (
            <>
              <h2 className="text-lg font-semibold text-concreto-800 mt-6 mb-4">Vendidos ({vendidos.length})</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {vendidos.map(l => <ListingCard key={l.id} listing={l} />)}
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
