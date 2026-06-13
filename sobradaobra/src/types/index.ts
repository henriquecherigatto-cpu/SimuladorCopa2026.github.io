export interface Profile {
  id: string
  nome: string
  foto_url: string | null
  cidade: string | null
  estado: string | null
  telefone: string | null
  bio: string | null
  avaliacao_media: number
  total_avaliacoes: number
  criado_em: string
}

export interface Category {
  id: string
  nome: string
  slug: string
  icone: string
  cor: string | null
}

export type EstadoMaterial = 'novo' | 'sobra_nova' | 'usado' | 'com_defeito'
export type TipoNegociacao = 'fixo' | 'negociavel' | 'troca' | 'doacao'

export interface Listing {
  id: string
  vendedor_id: string
  titulo: string
  descricao: string | null
  categoria_id: string | null
  quantidade: number | null
  unidade: string | null
  estado_material: EstadoMaterial
  preco: number | null
  tipo_negociacao: TipoNegociacao
  cep: string | null
  cidade: string | null
  bairro: string | null
  estado_uf: string | null
  ativo: boolean
  vendido: boolean
  destaque: boolean
  visualizacoes: number
  criado_em: string
  atualizado_em: string
  // joined
  profiles?: Profile
  categories?: Category
  listing_images?: ListingImage[]
}

export interface ListingImage {
  id: string
  listing_id: string
  url: string
  ordem: number
}

export interface Message {
  id: string
  listing_id: string | null
  remetente_id: string
  destinatario_id: string
  conteudo: string
  lido: boolean
  criado_em: string
  remetente?: Profile
  destinatario?: Profile
  listings?: Pick<Listing, 'id' | 'titulo'>
}

export interface Review {
  id: string
  avaliador_id: string
  avaliado_id: string
  listing_id: string | null
  nota: number
  comentario: string | null
  criado_em: string
  avaliador?: Profile
}

export interface AddressData {
  cep: string
  logradouro: string
  bairro: string
  localidade: string
  uf: string
  erro?: boolean
}
