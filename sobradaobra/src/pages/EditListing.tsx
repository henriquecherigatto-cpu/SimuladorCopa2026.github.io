import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Upload, X, MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/ui/Toast'
import { buscarCep, formatarCep } from '../lib/viacep'
import { UNIDADES, ESTADOS_UF } from '../lib/utils'
import type { Category, Listing, ListingImage } from '../types'
import { Layout } from '../components/layout/Layout'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Spinner } from '../components/ui/Spinner'
import { ConfirmModal } from '../components/ui/Modal'

const ESTADOS_MATERIAL = [
  { value: 'novo', label: 'Novo' },
  { value: 'sobra_nova', label: 'Sobra nova' },
  { value: 'usado', label: 'Usado' },
  { value: 'com_defeito', label: 'Com defeito' },
]

const TIPOS_NEGOCIACAO = [
  { value: 'negociavel', label: 'Negociável' },
  { value: 'fixo', label: 'Preço fixo' },
  { value: 'troca', label: 'Aceito troca' },
  { value: 'doacao', label: 'Doação' },
]

export function EditListing() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { success, error: toastError } = useToast()

  const [, setListing] = useState<Listing | null>(null)
  const [categorias, setCategorias] = useState<Category[]>([])
  const [fotosExistentes, setFotosExistentes] = useState<ListingImage[]>([])
  const [novasImagens, setNovasImagens] = useState<File[]>([])
  const [novasPreviews, setNovasPreviews] = useState<string[]>([])
  const [fotosRemover, setFotosRemover] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [confirmExcluir, setConfirmExcluir] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    titulo: '', descricao: '', categoria_id: '',
    quantidade: '', unidade: 'unidade(s)', estado_material: 'sobra_nova',
    tipo_negociacao: 'negociavel', preco: '',
    cep: '', cidade: '', bairro: '', estado_uf: '',
  })

  useEffect(() => {
    async function carregar() {
      const [{ data: cats }, { data: lst }] = await Promise.all([
        supabase.from('categories').select('*').order('nome'),
        supabase.from('listings').select('*, listing_images(*)').eq('id', id!).single(),
      ])
      setCategorias(cats || [])
      if (!lst) { navigate('/meus-anuncios'); return }
      if (lst.vendedor_id !== user?.id) { navigate('/'); return }
      setListing(lst)
      setFotosExistentes(lst.listing_images || [])
      setForm({
        titulo: lst.titulo,
        descricao: lst.descricao || '',
        categoria_id: lst.categoria_id || '',
        quantidade: lst.quantidade?.toString() || '',
        unidade: lst.unidade || 'unidade(s)',
        estado_material: lst.estado_material,
        tipo_negociacao: lst.tipo_negociacao,
        preco: lst.preco?.toString() || '',
        cep: lst.cep || '',
        cidade: lst.cidade || '',
        bairro: lst.bairro || '',
        estado_uf: lst.estado_uf || '',
      })
      setLoading(false)
    }
    carregar()
  }, [id, user, navigate])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleCep(valor: string) {
    const fmt = formatarCep(valor)
    set('cep', fmt)
    if (fmt.replace(/\D/g, '').length === 8) {
      setBuscandoCep(true)
      const end = await buscarCep(fmt)
      setBuscandoCep(false)
      if (end) setForm(f => ({ ...f, cidade: end.localidade, bairro: end.bairro, estado_uf: end.uf }))
    }
  }

  function adicionarImagens(files: FileList | null) {
    if (!files) return
    const total = fotosExistentes.filter(f => !fotosRemover.includes(f.id)).length + novasImagens.length
    const disponiveis = Math.max(0, 8 - total)
    const novos = Array.from(files).slice(0, disponiveis)
    setNovasImagens(prev => [...prev, ...novos])
    setNovasPreviews(prev => [...prev, ...novos.map(f => URL.createObjectURL(f))])
  }

  function removerFotoExistente(fotoId: string) {
    setFotosRemover(prev => [...prev, fotoId])
  }

  function removerNovaFoto(i: number) {
    setNovasImagens(prev => prev.filter((_, idx) => idx !== i))
    setNovasPreviews(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.titulo.trim()) { toastError('Preencha o título.'); return }
    if (!form.cidade) { toastError('Informe o CEP ou a cidade.'); return }

    setSalvando(true)
    try {
      await supabase.from('listings').update({
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
        atualizado_em: new Date().toISOString(),
      }).eq('id', id!)

      if (fotosRemover.length > 0) {
        await supabase.from('listing_images').delete().in('id', fotosRemover)
      }

      if (novasImagens.length > 0) {
        const ordemBase = fotosExistentes.filter(f => !fotosRemover.includes(f.id)).length
        const uploads = await Promise.all(novasImagens.map(async (file, i) => {
          const ext = file.name.split('.').pop()
          const path = `${user!.id}/${id}/${Date.now()}_${i}.${ext}`
          const { error: uploadErr } = await supabase.storage.from('listing-images').upload(path, file)
          if (uploadErr) return null
          const { data: { publicUrl } } = supabase.storage.from('listing-images').getPublicUrl(path)
          return { listing_id: id!, url: publicUrl, ordem: ordemBase + i }
        }))
        const validos = uploads.filter((u): u is { listing_id: string; url: string; ordem: number } => u !== null)
        if (validos.length > 0) await supabase.from('listing_images').insert(validos)
      }

      success('Anúncio atualizado!')
      navigate(`/anuncio/${id}`)
    } catch {
      toastError('Erro ao salvar. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  async function handleExcluir() {
    setExcluindo(true)
    await supabase.from('listings').update({ ativo: false }).eq('id', id!)
    success('Anúncio removido.')
    navigate('/meus-anuncios')
  }

  if (loading) return (
    <Layout><div className="flex justify-center py-20"><Spinner size="lg" className="text-terracota-400" /></div></Layout>
  )

  const fotosVisiveis = fotosExistentes.filter(f => !fotosRemover.includes(f.id))
  const ehDoacao = form.tipo_negociacao === 'doacao'

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-concreto-800">Editar anúncio</h1>
          <button onClick={() => setConfirmExcluir(true)} className="text-sm text-red-500 hover:underline">
            Excluir anúncio
          </button>
        </div>

        <form onSubmit={handleSalvar} className="space-y-6">
          {/* Fotos */}
          <div className="bg-white rounded-2xl border border-concreto-100 p-4">
            <h2 className="font-semibold text-concreto-700 mb-3">Fotos <span className="text-concreto-400 font-normal text-sm">(até 8)</span></h2>
            <div className="flex flex-wrap gap-2">
              {fotosVisiveis.map(foto => (
                <div key={foto.id} className="relative w-20 h-20 rounded-xl overflow-hidden border border-concreto-200">
                  <img src={foto.url} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removerFotoExistente(foto.id)} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5">
                    <X size={12} />
                  </button>
                </div>
              ))}
              {novasPreviews.map((src, i) => (
                <div key={`new-${i}`} className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-terracota-300">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removerNovaFoto(i)} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5">
                    <X size={12} />
                  </button>
                </div>
              ))}
              {(fotosVisiveis.length + novasImagens.length) < 8 && (
                <button type="button" onClick={() => fileRef.current?.click()} className="w-20 h-20 rounded-xl border-2 border-dashed border-concreto-300 flex flex-col items-center justify-center text-concreto-400 hover:border-terracota-400 hover:text-terracota-500 transition-colors">
                  <Upload size={20} />
                  <span className="text-xs mt-1">Adicionar</span>
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => adicionarImagens(e.target.files)} />
          </div>

          {/* Dados */}
          <div className="bg-white rounded-2xl border border-concreto-100 p-4 space-y-4">
            <h2 className="font-semibold text-concreto-700">Informações do material</h2>
            <Input label="Título" value={form.titulo} onChange={e => set('titulo', e.target.value)} required />
            <div>
              <label className="text-sm font-medium text-concreto-700 block mb-1">Categoria</label>
              <select value={form.categoria_id} onChange={e => set('categoria_id', e.target.value)} className="w-full border border-concreto-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracota-400 bg-white">
                <option value="">Selecione</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Quantidade" type="number" value={form.quantidade} onChange={e => set('quantidade', e.target.value)} min="0" />
              <div>
                <label className="text-sm font-medium text-concreto-700 block mb-1">Unidade</label>
                <select value={form.unidade} onChange={e => set('unidade', e.target.value)} className="w-full border border-concreto-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracota-400 bg-white">
                  {UNIDADES.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-concreto-700 block mb-1">Estado do material</label>
              <div className="grid grid-cols-2 gap-2">
                {ESTADOS_MATERIAL.map(op => (
                  <label key={op.value} className={`flex items-center gap-2 border rounded-xl px-3 py-2.5 cursor-pointer transition-colors ${form.estado_material === op.value ? 'border-terracota-400 bg-terracota-50' : 'border-concreto-200'}`}>
                    <input type="radio" name="estado" value={op.value} checked={form.estado_material === op.value} onChange={() => set('estado_material', op.value)} className="sr-only" />
                    <span className="text-sm">{op.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-concreto-700 block mb-1">Descrição</label>
              <textarea value={form.descricao} onChange={e => set('descricao', e.target.value)} rows={4} className="w-full border border-concreto-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracota-400 resize-none" />
            </div>
          </div>

          {/* Preço */}
          <div className="bg-white rounded-2xl border border-concreto-100 p-4 space-y-4">
            <h2 className="font-semibold text-concreto-700">Preço e negociação</h2>
            <div>
              <label className="text-sm font-medium text-concreto-700 block mb-1">Tipo de negociação</label>
              <div className="grid grid-cols-2 gap-2">
                {TIPOS_NEGOCIACAO.map(op => (
                  <label key={op.value} className={`flex items-center gap-2 border rounded-xl px-3 py-2.5 cursor-pointer transition-colors ${form.tipo_negociacao === op.value ? 'border-terracota-400 bg-terracota-50' : 'border-concreto-200'}`}>
                    <input type="radio" name="tipo" value={op.value} checked={form.tipo_negociacao === op.value} onChange={() => set('tipo_negociacao', op.value)} className="sr-only" />
                    <span className="text-sm">{op.label}</span>
                  </label>
                ))}
              </div>
            </div>
            {!ehDoacao && (
              <Input label="Preço (R$)" type="number" value={form.preco} onChange={e => set('preco', e.target.value)} min="0" step="0.01" hint='Deixe em branco para "A combinar"' />
            )}
          </div>

          {/* Localização */}
          <div className="bg-white rounded-2xl border border-concreto-100 p-4 space-y-4">
            <h2 className="font-semibold text-concreto-700">Localização</h2>
            <Input
              label="CEP" value={form.cep} onChange={e => handleCep(e.target.value)}
              leftIcon={<MapPin size={16} />}
              rightElement={buscandoCep ? <div className="w-4 h-4 border-2 border-terracota-400 border-t-transparent rounded-full animate-spin" /> : undefined}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Cidade" value={form.cidade} onChange={e => set('cidade', e.target.value)} required />
              <div>
                <label className="text-sm font-medium text-concreto-700 block mb-1">Estado</label>
                <select value={form.estado_uf} onChange={e => set('estado_uf', e.target.value)} className="w-full border border-concreto-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracota-400 bg-white">
                  <option value="">UF</option>
                  {ESTADOS_UF.map(uf => <option key={uf}>{uf}</option>)}
                </select>
              </div>
            </div>
            <Input label="Bairro" value={form.bairro} onChange={e => set('bairro', e.target.value)} />
          </div>

          <Button type="submit" fullWidth size="lg" loading={salvando}>Salvar alterações</Button>
        </form>
      </div>

      <ConfirmModal
        open={confirmExcluir}
        onClose={() => setConfirmExcluir(false)}
        onConfirm={handleExcluir}
        title="Excluir anúncio?"
        message="O anúncio será removido. Essa ação não pode ser desfeita."
        confirmLabel="Excluir"
        confirmVariant="danger"
        loading={excluindo}
      />
    </Layout>
  )
}
