import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search as SearchIcon, SlidersHorizontal, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Category, Listing } from '../types'
import { Layout } from '../components/layout/Layout'
import { ListingCard } from '../components/listings/ListingCard'
import { Spinner } from '../components/ui/Spinner'
import { Badge } from '../components/ui/Badge'
import { ESTADO_MATERIAL_LABELS } from '../lib/utils'

const ESTADOS_MATERIAL = Object.entries(ESTADO_MATERIAL_LABELS)

export function Search() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const categoriaSlug = params.get('categoria') || ''
  const estadoFiltro = params.get('estado') || ''

  const [busca, setBusca] = useState(q)
  const [listings, setListings] = useState<Listing[]>([])
  const [categorias, setCategorias] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showFiltros, setShowFiltros] = useState(false)

  useEffect(() => {
    supabase.from('categories').select('*').order('nome').then(({ data }) => setCategorias(data || []))
  }, [])

  const buscarListings = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('listings')
      .select('*, profiles(*), categories(*), listing_images(*)')
      .eq('ativo', true)
      .eq('vendido', false)
      .order('destaque', { ascending: false })
      .order('criado_em', { ascending: false })
      .limit(40)

    if (q) query = query.ilike('titulo', `%${q}%`)
    if (categoriaSlug) query = query.eq('categories.slug', categoriaSlug)
    if (estadoFiltro) query = query.eq('estado_material', estadoFiltro)

    const { data } = await query
    setListings(data || [])
    setLoading(false)
  }, [q, categoriaSlug, estadoFiltro])

  useEffect(() => { buscarListings() }, [buscarListings])

  function handleBusca(e: React.FormEvent) {
    e.preventDefault()
    setParams(prev => { const n = new URLSearchParams(prev); n.set('q', busca); return n })
  }

  function setCategoria(slug: string) {
    setParams(prev => {
      const n = new URLSearchParams(prev)
      slug ? n.set('categoria', slug) : n.delete('categoria')
      return n
    })
  }

  function setEstado(estado: string) {
    setParams(prev => {
      const n = new URLSearchParams(prev)
      estado ? n.set('estado', estado) : n.delete('estado')
      return n
    })
  }

  const categoriaSelecionada = categorias.find(c => c.slug === categoriaSlug)

  return (
    <Layout>
      <div className="space-y-4">
        {/* Barra de busca */}
        <form onSubmit={handleBusca} className="flex gap-2">
          <div className="flex-1 relative">
            <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-concreto-400" />
            <input
              type="search"
              placeholder="Buscar material..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-concreto-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-terracota-400"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFiltros(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm transition-colors ${
              showFiltros || categoriaSlug || estadoFiltro
                ? 'bg-terracota-50 border-terracota-300 text-terracota-600'
                : 'bg-white border-concreto-200 text-concreto-600'
            }`}
          >
            <SlidersHorizontal size={16} />
            Filtros
            {(categoriaSlug || estadoFiltro) && (
              <Badge variant="terracota" size="sm">{Number(!!categoriaSlug) + Number(!!estadoFiltro)}</Badge>
            )}
          </button>
        </form>

        {/* Filtros expandíveis */}
        {showFiltros && (
          <div className="bg-white border border-concreto-100 rounded-2xl p-4 space-y-4">
            <div>
              <p className="text-xs font-semibold text-concreto-500 uppercase mb-2">Categoria</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setCategoria('')}
                  className={`px-3 py-1.5 rounded-xl text-sm border transition-colors ${
                    !categoriaSlug ? 'bg-terracota-500 text-white border-terracota-500' : 'border-concreto-200 text-concreto-600 hover:border-terracota-300'
                  }`}
                >
                  Todas
                </button>
                {categorias.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setCategoria(c.slug)}
                    className={`px-3 py-1.5 rounded-xl text-sm border transition-colors flex items-center gap-1 ${
                      categoriaSlug === c.slug ? 'bg-terracota-500 text-white border-terracota-500' : 'border-concreto-200 text-concreto-600 hover:border-terracota-300'
                    }`}
                  >
                    {c.icone} {c.nome}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-concreto-500 uppercase mb-2">Estado do material</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setEstado('')}
                  className={`px-3 py-1.5 rounded-xl text-sm border transition-colors ${
                    !estadoFiltro ? 'bg-terracota-500 text-white border-terracota-500' : 'border-concreto-200 text-concreto-600'
                  }`}
                >
                  Todos
                </button>
                {ESTADOS_MATERIAL.map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setEstado(key)}
                    className={`px-3 py-1.5 rounded-xl text-sm border transition-colors ${
                      estadoFiltro === key ? 'bg-terracota-500 text-white border-terracota-500' : 'border-concreto-200 text-concreto-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Chips de filtro ativos */}
        {(q || categoriaSelecionada || estadoFiltro) && (
          <div className="flex flex-wrap gap-2">
            {q && (
              <button onClick={() => setParams(p => { const n = new URLSearchParams(p); n.delete('q'); return n })} className="flex items-center gap-1 px-3 py-1 bg-concreto-100 rounded-full text-xs text-concreto-700">
                "{q}" <X size={12} />
              </button>
            )}
            {categoriaSelecionada && (
              <button onClick={() => setCategoria('')} className="flex items-center gap-1 px-3 py-1 bg-terracota-100 rounded-full text-xs text-terracota-700">
                {categoriaSelecionada.icone} {categoriaSelecionada.nome} <X size={12} />
              </button>
            )}
            {estadoFiltro && (
              <button onClick={() => setEstado('')} className="flex items-center gap-1 px-3 py-1 bg-terracota-100 rounded-full text-xs text-terracota-700">
                {ESTADO_MATERIAL_LABELS[estadoFiltro]} <X size={12} />
              </button>
            )}
          </div>
        )}

        {/* Resultados */}
        {loading ? (
          <div className="flex justify-center py-12"><Spinner className="text-terracota-400" /></div>
        ) : listings.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-concreto-500 font-medium">Nenhum anúncio encontrado</p>
            <p className="text-concreto-400 text-sm mt-1">Tente outros termos ou remova os filtros</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-concreto-400">{listings.length} anúncio{listings.length !== 1 ? 's' : ''} encontrado{listings.length !== 1 ? 's' : ''}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {listings.map(l => <ListingCard key={l.id} listing={l} />)}
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
