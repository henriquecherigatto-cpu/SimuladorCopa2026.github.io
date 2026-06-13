import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, X, MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/ui/Toast'
import { buscarCep, formatarCep } from '../lib/viacep'
import { UNIDADES, ESTADOS_UF } from '../lib/utils'
import type { Category } from '../types'
import { Layout } from '../components/layout/Layout'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

const ESTADOS_MATERIAL = [
  { value: 'novo', label: 'Novo' },
  { value: 'sobra_nova', label: 'Sobra nova (nunca usada)' },
  { value: 'usado', label: 'Usado' },
  { value: 'com_defeito', label: 'Com defeito' },
]

const TIPOS_NEGOCIACAO = [
  { value: 'negociavel', label: 'Negociável' },
  { value: 'fixo', label: 'Preço fixo' },
  { value: 'troca', label: 'Aceito troca' },
  { value: 'doacao', label: 'Doação (grátis)' },
]

export function CreateListing() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { error: toastError } = useToast()

  const [categorias, setCategorias] = useState<Category[]>([])
  const [imagens, setImagens] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [buscandoCep, setBuscandoCep] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    titulo: '',
    descricao: '',
    categoria_id: '',
    quantidade: '',
    unidade: 'unidade(s)',
    estado_material: 'sobra_nova',
    tipo_negociacao: 'negociavel',
    preco: '',
    cep: '',
    cidade: '',
    bairro: '',
    estado_uf: '',
  })

  useEffect(() => {
    supabase.from('categories').select('*').order('nome').then(({ data }) => setCategorias(data || []))
  }, [])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleCep(valor: string) {
    const formatted = formatarCep(valor)
    set('cep', formatted)
    if (formatted.replace(/\D/g, '').length === 8) {
      setBuscandoCep(true)
      const end = await buscarCep(formatted)
      setBuscandoCep(false)
      if (end) {
        setForm(f => ({ ...f, cidade: end.localidade, bairro: end.bairro, estado_uf: end.uf }))
      }
    }
  }

  function handleImagens(files: FileList | null) {
    if (!files) return
    const novos = Array.from(files).slice(0, 8 - imagens.length)
    setImagens(prev => [...prev, ...novos])
    setPreviews(prev => [...prev, ...novos.map(f => URL.createObjectURL(f))])
  }

  function removerImagem(i: number) {
    setImagens(prev => prev.filter((_, idx) => idx !== i))
    setPreviews(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!form.titulo.trim()) { setErro('Preencha o título.'); return }
    if (!form.cidade) { setErro('Informe o CEP ou a cidade.'); return }

    setLoading(true)
    try {
      const { data: listing, error: listingErr } = await supabase.from('listings').insert({
        vendedor_id: user!.id,
        titulo: form.titulo,
        descricao: form.descricao || null,
        categoria_id: form.categoria_id || null,
        quantidade: form.quantidade ? Number(form.quantidade) : null,
        unidade: form.unidade || null,
        estado_material: form.estado_material,
        tipo_negociacao: form.tipo_negociacao,
        preco: form.tipo_negociacao === 'doacao' ? null : (form.preco ? Number(form.preco.replace(',', '.')) : null),
        cep: form.cep.replace(/\D/g, '') || null,
        cidade: form.cidade || null,
        bairro: form.bairro || null,
        estado_uf: form.estado_uf || null,
      }).select().single()

      if (listingErr) throw listingErr

      if (imagens.length > 0) {
        const uploads = await Promise.all(imagens.map(async (file, i) => {
          const ext = file.name.split('.').pop()
          const path = `${user!.id}/${listing.id}/${i}.${ext}`
          const { error: uploadErr } = await supabase.storage.from('listing-images').upload(path, file)
          if (uploadErr) return null
          const { data: { publicUrl } } = supabase.storage.from('listing-images').getPublicUrl(path)
          return { listing_id: listing.id, url: publicUrl, ordem: i }
        }))
        const validos = uploads.filter((u): u is { listing_id: string; url: string; ordem: number } => u !== null)
        if (validos.length > 0) await supabase.from('listing_images').insert(validos)
      }

      navigate(`/anuncio/${listing.id}`)
    } catch (err) {
      toastError('Erro ao criar anúncio. Tente novamente.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const ehDoacao = form.tipo_negociacao === 'doacao'

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-concreto-800 mb-6">Criar anúncio</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Fotos */}
          <div className="bg-white rounded-2xl border border-concreto-100 p-4">
            <h2 className="font-semibold text-concreto-700 mb-3">Fotos <span className="text-concreto-400 font-normal text-sm">(até 8)</span></h2>
            <div className="flex flex-wrap gap-2">
              {previews.map((src, i) => (
                <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-concreto-200">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removerImagem(i)}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {imagens.length < 8 && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-concreto-300 flex flex-col items-center justify-center text-concreto-400 hover:border-terracota-400 hover:text-terracota-500 transition-colors"
                >
                  <Upload size={20} />
                  <span className="text-xs mt-1">Adicionar</span>
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => handleImagens(e.target.files)}
            />
            <p className="text-xs text-concreto-400 mt-2">A primeira foto será a capa do anúncio.</p>
          </div>

          {/* Dados do anúncio */}
          <div className="bg-white rounded-2xl border border-concreto-100 p-4 space-y-4">
            <h2 className="font-semibold text-concreto-700">Informações do material</h2>

            <Input
              label="Título do anúncio"
              placeholder="Ex: Tijolos cerâmicos 6 furos"
              value={form.titulo}
              onChange={e => set('titulo', e.target.value)}
              required
            />

            <div>
              <label className="text-sm font-medium text-concreto-700 block mb-1">
                Categoria
              </label>
              <select
                value={form.categoria_id}
                onChange={e => set('categoria_id', e.target.value)}
                className="w-full border border-concreto-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracota-400 bg-white"
              >
                <option value="">Selecione uma categoria</option>
                {categorias.map(c => (
                  <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Quantidade"
                type="number"
                placeholder="Ex: 200"
                value={form.quantidade}
                onChange={e => set('quantidade', e.target.value)}
                min="0"
              />
              <div>
                <label className="text-sm font-medium text-concreto-700 block mb-1">Unidade</label>
                <select
                  value={form.unidade}
                  onChange={e => set('unidade', e.target.value)}
                  className="w-full border border-concreto-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracota-400 bg-white"
                >
                  {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-concreto-700 block mb-1">Estado do material *</label>
              <div className="grid grid-cols-2 gap-2">
                {ESTADOS_MATERIAL.map(op => (
                  <label key={op.value} className={`flex items-center gap-2 border rounded-xl px-3 py-2.5 cursor-pointer transition-colors ${form.estado_material === op.value ? 'border-terracota-400 bg-terracota-50' : 'border-concreto-200 hover:border-concreto-300'}`}>
                    <input type="radio" name="estado" value={op.value} checked={form.estado_material === op.value} onChange={() => set('estado_material', op.value)} className="sr-only" />
                    <span className="text-sm text-concreto-700">{op.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-concreto-700 block mb-1">Descrição</label>
              <textarea
                placeholder="Descreva o material, dimensões, marcas, etc."
                value={form.descricao}
                onChange={e => set('descricao', e.target.value)}
                rows={4}
                className="w-full border border-concreto-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracota-400 resize-none"
              />
            </div>
          </div>

          {/* Preço */}
          <div className="bg-white rounded-2xl border border-concreto-100 p-4 space-y-4">
            <h2 className="font-semibold text-concreto-700">Preço e negociação</h2>
            <div>
              <label className="text-sm font-medium text-concreto-700 block mb-1">Tipo de negociação *</label>
              <div className="grid grid-cols-2 gap-2">
                {TIPOS_NEGOCIACAO.map(op => (
                  <label key={op.value} className={`flex items-center gap-2 border rounded-xl px-3 py-2.5 cursor-pointer transition-colors ${form.tipo_negociacao === op.value ? 'border-terracota-400 bg-terracota-50' : 'border-concreto-200 hover:border-concreto-300'}`}>
                    <input type="radio" name="tipo" value={op.value} checked={form.tipo_negociacao === op.value} onChange={() => set('tipo_negociacao', op.value)} className="sr-only" />
                    <span className="text-sm text-concreto-700">{op.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {!ehDoacao && (
              <Input
                label="Preço (R$)"
                type="number"
                placeholder="0,00"
                value={form.preco}
                onChange={e => set('preco', e.target.value)}
                min="0"
                step="0.01"
                hint='Deixe em branco para "A combinar"'
              />
            )}
          </div>

          {/* Localização */}
          <div className="bg-white rounded-2xl border border-concreto-100 p-4 space-y-4">
            <h2 className="font-semibold text-concreto-700">Localização</h2>
            <Input
              label="CEP"
              placeholder="00000-000"
              value={form.cep}
              onChange={e => handleCep(e.target.value)}
              leftIcon={<MapPin size={16} />}
              rightElement={buscandoCep ? <div className="w-4 h-4 border-2 border-terracota-400 border-t-transparent rounded-full animate-spin" /> : undefined}
              hint="Preenchemos cidade e bairro automaticamente"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Cidade"
                placeholder="São Paulo"
                value={form.cidade}
                onChange={e => set('cidade', e.target.value)}
                required
              />
              <div>
                <label className="text-sm font-medium text-concreto-700 block mb-1">Estado</label>
                <select
                  value={form.estado_uf}
                  onChange={e => set('estado_uf', e.target.value)}
                  className="w-full border border-concreto-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracota-400 bg-white"
                >
                  <option value="">UF</option>
                  {ESTADOS_UF.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
            </div>
            <Input
              label="Bairro"
              placeholder="Centro"
              value={form.bairro}
              onChange={e => set('bairro', e.target.value)}
            />
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">{erro}</div>
          )}

          <Button type="submit" fullWidth size="lg" loading={loading}>
            Publicar anúncio
          </Button>
        </form>
      </div>
    </Layout>
  )
}
