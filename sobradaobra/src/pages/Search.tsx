import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search as SearchIcon, SlidersHorizontal, X, ArrowUpDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Category, Listing } from '../types'
import { Layout } from '../components/layout/Layout'
import { ListingCard } from '../components/listings/ListingCard'
import { ListingCardSkeleton } from '../components/ui/Skeleton'
import { Badge } from '../components/ui/Badge'
import { ESTADO_MATERIAL_LABELS, ESTADOS_UF } from '../lib/utils'

const ESTADOS_MATERIAL = Object.entries(ESTADO_MATERIAL_LABELS)

const ORDENACAO_OPTS = [
  { value: 'recente', label: 'Mais recente' },
  { value: 'antigo', label: 'Mais antigo' },
  { value: 'menor_preco', label: 'Menor preço' },
  { value: 'maior_preco', label: 'Maior preço' },
]

export function Search() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const categoriaSlug = params.get('categoria') || ''
  const estadoFiltro = params.get('estado') || ''
  const ufFiltro = params.get('uf') || ''
  const ordenacao = params.get('ordem') || 'recente'

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
      .limit(48)

    if (q) query = query.ilike('titulo', `%${q}%`)
    if (estadoFiltro) query = query.eq('estado_material', estadoFiltro)
    if (ufFiltro) query = query.eq('estado_uf', ufFiltro)

    switch (ordenacao) {
      case 'recente':
        query = query.order('destaque', { ascending: false }).order('criado_em', { ascending: false })
        break
      case 'antigo':
        query = query.order('criado_em', { ascending: true })
        break
      case 'menor_preco':
        query = query.order('preco', { ascending: true, nullsFirst: false })
        break
      case 'maior_preco':
        query = query.order('preco', { ascending: false, nullsFirst: false })
        break
    }

    const { data } = await query
    let resultado = data || []

    // Filtra por categoria no lado cliente (join não suporta filtro direto)
    if (categoriaSlug) {
      resultado = resultado.filter(l => l.categories?.slug === categoriaSlug)
    }

    setListings(resultado)
    setLoading(false)
  }, [q, categoriaSlug, estadoFiltro, ufFiltro, ordenacao])

  useEffect(() => { buscarListings() }, [buscarListings])

  function handleBusca(e: React.FormEvent) {
    e.preventDefault()
    setParams(prev => { const n = new URLSearchParams(prev); if (busca.trim()) n.set('q', busca.trim()); else n.delete('q'); return n })
  }

  function setParam(key: string, value: string) {
    setParams(prev => {
      const n = new URLSearchParams(prev)
      value ? n.set(key, value) : n.delete(key)
      return n
    })
  }

  const categoriaSelecionada = categorias.find(c => c.slug === categoriaSlug)
  const totalFiltros = [categoriaSlug, estadoFiltro, ufFiltro].filter(Boolean).length

  return (
    <Layout>
      <div className="space-y-4">
        {/* Barra de busca + botões de controle */}
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

          {/* Ordenação */}
          <div className="relative">
            <select
              value={ordenacao}
              onChange={e => setParam('ordem', e.target.value)}
              className="h-full pl-3 pr-8 py-2.5 border border-concreto-200 rounded-xl bg-white text-sm text-concreto-700 focus:outline-none focus:ring-2 focus:ring-terracota-400 appearance-none cursor-pointer"
            >
              {ORDENACAO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ArrowUpDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-concreto-400 pointer-events-none" />
          </div>

          <button
            type="button"
            onClick={() => setShowFiltros(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm transition-colors ${
              showFiltros || totalFiltros > 0
                ? 'bg-terracota-50 border-terracota-300 text-terracota-600'
                : 'bg-white border-concreto-200 text-concreto-600'
            }`}
          >
            <SlidersHorizontal size={16} />
            {totalFiltros > 0 && <Badge variant="terracota" size="sm">{totalFiltros}</Badge>}
          </button>
        </form>

        {/* Filtros expandíveis */}
        {showFiltros && (
          <div className="bg-white border border-concreto-100 rounded-2xl p-4 space-y-5">
            {/* Categorias */}
            <div>
              <p className="text-xs font-semibold text-concreto-500 uppercase tracking-wide mb-2">Categoria</p>
              <div className="flex flex-wrap gap-2">
                <FilterChip active={!categoriaSlug} onClick={() => setParam('categoria', '')}>Todas</FilterChip>
                {categorias.map(c => (
                  <FilterChip key={c.id} active={categoriaSlug === c.slug} onClick={() => setParam('categoria', c.slug)}>
                    {c.icone} {c.nome}
                  </FilterChip>
                ))}
              </div>
            </div>

            {/* Estado do material */}
            <div>
              <p className="text-xs font-semibold text-concreto-500 uppercase tracking-wide mb-2">Estado do material</p>
              <div className="flex flex-wrap gap-2">
                <FilterChip active={!estadoFiltro} onClick={() => setParam('estado', '')}>Todos</FilterChip>
                {ESTADOS_MATERIAL.map(([key, label]) => (
                  <FilterChip key={key} active={estadoFiltro === key} onClick={() => setParam('estado', key)}>{label}</FilterChip>
                ))}
              </div>
            </div>

            {/* Estado (UF) */}
            <div>
              <p className="text-xs font-semibold text-concreto-500 uppercase tracking-wide mb-2">Estado (UF)</p>
              <div className="flex flex-wrap gap-2">
                <FilterChip active={!ufFiltro} onClick={() => setParam('uf', '')}>Todos</FilterChip>
                {ESTADOS_UF.map(uf => (
                  <FilterChip key={uf} active={ufFiltro === uf} onClick={() => setParam('uf', uf)}>{uf}</FilterChip>
                ))}
              </div>
            </div>

            {totalFiltros > 0 && (
              <button
                onClick={() => setParams(new URLSearchParams(q ? { q } : {}))}
                className="text-sm text-red-500 hover:underline"
              >
                Limpar todos os filtros
              </button>
            )}
          </div>
        )}

        {/* Chips de filtros ativos */}
        {(q || categoriaSelecionada || estadoFiltro || ufFiltro) && (
          <div className="flex flex-wrap gap-2">
            {q && (
              <button onClick={() => setParam('q', '')} className="flex items-center gap-1 px-3 py-1 bg-concreto-100 rounded-full text-xs text-concreto-700">
                "{q}" <X size={12} />
              </button>
            )}
            {categoriaSelecionada && (
              <button onClick={() => setParam('categoria', '')} className="flex items-center gap-1 px-3 py-1 bg-terracota-100 rounded-full text-xs text-terracota-700">
                {categoriaSelecionada.icone} {categoriaSelecionada.nome} <X size={12} />
              </button>
            )}
            {estadoFiltro && (
              <button onClick={() => setParam('estado', '')} className="flex items-center gap-1 px-3 py-1 bg-terracota-100 rounded-full text-xs text-terracota-700">
                {ESTADO_MATERIAL_LABELS[estadoFiltro]} <X size={12} />
              </button>
            )}
            {ufFiltro && (
              <button onClick={() => setParam('uf', '')} className="flex items-center gap-1 px-3 py-1 bg-blue-100 rounded-full text-xs text-blue-700">
                📍 {ufFiltro} <X size={12} />
              </button>
            )}
          </div>
        )}

        {/* Resultados */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <ListingCardSkeleton key={i} />)}
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🔍</div>
            <p className="text-concreto-600 font-medium">Nenhum anúncio encontrado</p>
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

function FilterChip({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-sm border transition-colors ${
        active ? 'bg-terracota-500 text-white border-terracota-500' : 'border-concreto-200 text-concreto-600 hover:border-terracota-300'
      }`}
    >
      {children}
    </button>
  )
}
