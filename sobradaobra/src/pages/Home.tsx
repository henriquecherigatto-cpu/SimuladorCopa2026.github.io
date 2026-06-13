import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, ArrowRight, Recycle, Users, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Category, Listing } from '../types'
import { Layout } from '../components/layout/Layout'
import { ListingCard } from '../components/listings/ListingCard'
import { ListingCardSkeleton } from '../components/ui/Skeleton'

export function Home() {
  const [busca, setBusca] = useState('')
  const [categorias, setCategorias] = useState<Category[]>([])
  const [recentes, setRecentes] = useState<Listing[]>([])
  const [destaques, setDestaques] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function carregar() {
      const [{ data: cats }, { data: dest }, { data: rec }] = await Promise.all([
        supabase.from('categories').select('*').order('nome'),
        supabase.from('listings')
          .select('*, profiles(*), categories(*), listing_images(*)')
          .eq('ativo', true).eq('vendido', false).eq('destaque', true)
          .order('criado_em', { ascending: false }).limit(4),
        supabase.from('listings')
          .select('*, profiles(*), categories(*), listing_images(*)')
          .eq('ativo', true).eq('vendido', false)
          .order('criado_em', { ascending: false }).limit(12),
      ])
      setCategorias(cats || [])
      setDestaques(dest || [])
      setRecentes(rec || [])
      setLoading(false)
    }
    carregar()
  }, [])

  function handleBusca(e: React.FormEvent) {
    e.preventDefault()
    if (busca.trim()) navigate(`/busca?q=${encodeURIComponent(busca.trim())}`)
  }

  return (
    <Layout noPadding>
      {/* Hero */}
      <section className="bg-gradient-to-br from-terracota-500 to-terracota-700 text-white px-4 pt-6 pb-10 md:pt-10 md:pb-14">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-4xl mb-2">🧱</div>
          <h1 className="text-2xl md:text-4xl font-bold mb-2">SobraDaObra</h1>
          <p className="text-terracota-100 text-sm md:text-base mb-6">
            Compre e venda sobras de material de construção perto de você
          </p>

          <form onSubmit={handleBusca} className="flex gap-2 max-w-lg mx-auto">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-concreto-400" />
              <input
                type="search"
                placeholder="Tijolos, telhas, tinta..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl text-concreto-800 bg-white placeholder:text-concreto-400 focus:outline-none focus:ring-2 focus:ring-white/50 text-sm"
              />
            </div>
            <button
              type="submit"
              className="bg-white text-terracota-600 font-semibold px-5 py-3 rounded-xl hover:bg-terracota-50 transition-colors text-sm"
            >
              Buscar
            </button>
          </form>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        {/* Categorias */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-concreto-800">Categorias</h2>
          </div>
          {loading ? (
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-concreto-100 p-3 animate-pulse">
                  <div className="h-8 w-8 rounded-full bg-concreto-100 mx-auto mb-1.5" />
                  <div className="h-3 bg-concreto-100 rounded mx-auto w-3/4" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
              {categorias.map(cat => (
                <Link
                  key={cat.id}
                  to={`/busca?categoria=${cat.slug}`}
                  className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-2xl border border-concreto-100 hover:border-terracota-300 hover:shadow-sm transition-all text-center"
                >
                  <span className="text-2xl">{cat.icone}</span>
                  <span className="text-xs text-concreto-600 leading-tight">{cat.nome.split(' ')[0]}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Destaques */}
        {destaques.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-concreto-800">⭐ Em destaque</h2>
              <Link to="/busca" className="text-sm text-terracota-600 flex items-center gap-1 hover:underline">
                Ver todos <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {destaques.map(l => <ListingCard key={l.id} listing={l} />)}
            </div>
          </section>
        )}

        {/* Recentes */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-concreto-800">🕐 Anúncios recentes</h2>
            <Link to="/busca" className="text-sm text-terracota-600 flex items-center gap-1 hover:underline">
              Ver todos <ArrowRight size={14} />
            </Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => <ListingCardSkeleton key={i} />)}
            </div>
          ) : recentes.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">📦</div>
              <p className="text-concreto-400">Nenhum anúncio ainda. Seja o primeiro a anunciar!</p>
              <Link to="/novo-anuncio" className="mt-4 inline-block text-terracota-600 font-medium hover:underline">
                Criar anúncio →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {recentes.map(l => <ListingCard key={l.id} listing={l} />)}
            </div>
          )}
        </section>

        {/* Banner informativo */}
        <section className="bg-sustenta-600 rounded-2xl p-6 text-white">
          <h2 className="text-lg font-bold mb-1">♻️ Reutilize. Economize. Ajude o planeta.</h2>
          <p className="text-green-100 text-sm mb-4">
            Cada sobra vendida é material que não vai pro lixo. Juntos estamos construindo um Brasil mais sustentável.
          </p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <Recycle size={24} className="mx-auto mb-1" />
              <p className="text-xs">Menos desperdício</p>
            </div>
            <div>
              <Users size={24} className="mx-auto mb-1" />
              <p className="text-xs">Comunidade local</p>
            </div>
            <div>
              <ShieldCheck size={24} className="mx-auto mb-1" />
              <p className="text-xs">Negócio seguro</p>
            </div>
          </div>
        </section>

        {/* CTA anunciar */}
        <section className="bg-terracota-50 border border-terracota-200 rounded-2xl p-6 text-center">
          <h2 className="text-lg font-semibold text-concreto-800 mb-2">Tem sobra de obra?</h2>
          <p className="text-concreto-500 text-sm mb-4">
            Anuncie em menos de 2 minutos e encontre compradores perto de você.
          </p>
          <Link
            to="/novo-anuncio"
            className="inline-flex items-center gap-2 bg-terracota-500 hover:bg-terracota-600 text-white px-6 py-3 rounded-xl font-medium transition-colors"
          >
            Anunciar agora — é grátis!
          </Link>
        </section>
      </div>
    </Layout>
  )
}
