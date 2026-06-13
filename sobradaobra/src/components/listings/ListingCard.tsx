import { Link } from 'react-router-dom'
import { MapPin, Clock } from 'lucide-react'
import type { Listing } from '../../types'
import { formatarPreco, formatarDataRelativa, ESTADO_MATERIAL_LABELS } from '../../lib/utils'
import { Badge } from '../ui/Badge'

interface ListingCardProps {
  listing: Listing
}

export function ListingCard({ listing }: ListingCardProps) {
  const imagem = listing.listing_images?.[0]?.url
  const categoria = listing.categories

  return (
    <Link
      to={`/anuncio/${listing.id}`}
      className="bg-white rounded-2xl border border-concreto-100 overflow-hidden hover:shadow-md transition-shadow group block"
    >
      {/* Imagem */}
      <div className="aspect-[4/3] bg-concreto-100 relative overflow-hidden">
        {imagem ? (
          <img
            src={imagem}
            alt={listing.titulo}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">
            {categoria?.icone || '📦'}
          </div>
        )}
        {listing.vendido && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="bg-white text-concreto-700 font-semibold px-3 py-1 rounded-full text-sm">Vendido</span>
          </div>
        )}
        {listing.destaque && !listing.vendido && (
          <div className="absolute top-2 left-2">
            <Badge variant="terracota">⭐ Destaque</Badge>
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-medium text-concreto-800 text-sm leading-tight line-clamp-2 flex-1">
            {listing.titulo}
          </h3>
        </div>

        {listing.quantidade && listing.unidade && (
          <p className="text-xs text-concreto-400 mb-1">
            {listing.quantidade} {listing.unidade}
          </p>
        )}

        <div className="flex items-center justify-between mt-2">
          <div>
            {listing.tipo_negociacao === 'doacao' ? (
              <span className="text-sustenta-600 font-bold text-base">Doação</span>
            ) : listing.preco ? (
              <span className="text-terracota-600 font-bold text-base">{formatarPreco(listing.preco)}</span>
            ) : (
              <span className="text-concreto-400 text-sm">A combinar</span>
            )}
          </div>
          <Badge variant="gray" size="sm">{ESTADO_MATERIAL_LABELS[listing.estado_material]}</Badge>
        </div>

        <div className="flex items-center gap-1 mt-2 text-xs text-concreto-400">
          {listing.cidade && (
            <>
              <MapPin size={11} className="shrink-0" />
              <span className="truncate">{listing.cidade}{listing.estado_uf ? `, ${listing.estado_uf}` : ''}</span>
              <span className="mx-1">·</span>
            </>
          )}
          <Clock size={11} className="shrink-0" />
          <span>{formatarDataRelativa(listing.criado_em)}</span>
        </div>
      </div>
    </Link>
  )
}
