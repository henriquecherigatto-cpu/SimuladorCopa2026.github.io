import { useState } from 'react'
import { Star } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../ui/Toast'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import type { Profile } from '../../types'

interface ReviewModalProps {
  open: boolean
  onClose: () => void
  avaliado: Profile
  listingId: string
}

export function ReviewModal({ open, onClose, avaliado, listingId }: ReviewModalProps) {
  const { user } = useAuth()
  const { success, error } = useToast()
  const [nota, setNota] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comentario, setComentario] = useState('')
  const [loading, setLoading] = useState(false)

  async function enviar() {
    if (!nota || !user) return
    setLoading(true)
    const { error: err } = await supabase.from('reviews').insert({
      avaliador_id: user.id,
      avaliado_id: avaliado.id,
      listing_id: listingId,
      nota,
      comentario: comentario.trim() || null,
    })
    setLoading(false)
    if (err) {
      if (err.code === '23505') error('Você já avaliou este vendedor neste anúncio.')
      else error('Erro ao enviar avaliação.')
    } else {
      success('Avaliação enviada! Obrigado.')
      onClose()
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Avaliar vendedor" size="sm">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-terracota-100 flex items-center justify-center text-lg font-semibold text-terracota-600">
            {avaliado.nome[0].toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-concreto-800 text-sm">{avaliado.nome}</p>
            <p className="text-xs text-concreto-400">Como foi a negociação?</p>
          </div>
        </div>

        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => setNota(n)}
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(0)}
              className="transition-transform hover:scale-110"
            >
              <Star
                size={36}
                className={n <= (hovered || nota) ? 'text-yellow-400 fill-yellow-400' : 'text-concreto-200'}
              />
            </button>
          ))}
        </div>
        {nota > 0 && (
          <p className="text-center text-sm text-concreto-500">
            {['', 'Muito ruim', 'Ruim', 'Regular', 'Bom', 'Excelente!'][nota]}
          </p>
        )}

        <textarea
          placeholder="Comentário opcional..."
          value={comentario}
          onChange={e => setComentario(e.target.value)}
          rows={3}
          className="w-full border border-concreto-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracota-400 resize-none"
        />

        <Button fullWidth onClick={enviar} loading={loading} disabled={!nota}>
          Enviar avaliação
        </Button>
      </div>
    </Modal>
  )
}
