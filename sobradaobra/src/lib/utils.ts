export function formatarPreco(valor: number | null): string {
  if (valor === null) return 'A combinar'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatarData(data: string): string {
  return new Date(data).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatarDataRelativa(data: string): string {
  const diff = Date.now() - new Date(data).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora mesmo'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `há ${d} dia${d > 1 ? 's' : ''}`
  return formatarData(data)
}

export const ESTADO_MATERIAL_LABELS: Record<string, string> = {
  novo: 'Novo',
  sobra_nova: 'Sobra nova',
  usado: 'Usado',
  com_defeito: 'Com defeito',
}

export const TIPO_NEGOCIACAO_LABELS: Record<string, string> = {
  fixo: 'Preço fixo',
  negociavel: 'Negociável',
  troca: 'Troca',
  doacao: 'Doação',
}

export const UNIDADES = [
  'unidade(s)', 'peça(s)', 'metro(s)', 'm²', 'm³',
  'kg', 'litro(s)', 'lata(s)', 'saco(s)', 'caixa(s)',
  'fardo(s)', 'rolo(s)', 'par(es)',
]

export const ESTADOS_UF = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO',
]

export function slugify(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
