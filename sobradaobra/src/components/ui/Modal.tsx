import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        'relative bg-white w-full rounded-t-3xl sm:rounded-2xl shadow-xl z-10',
        'max-h-[90vh] overflow-y-auto',
        sizes[size],
      )}>
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-concreto-100">
            <h2 className="font-semibold text-concreto-800">{title}</h2>
            <button onClick={onClose} className="p-1.5 rounded-xl text-concreto-400 hover:bg-gray-100 transition-colors">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  confirmVariant?: 'danger' | 'primary'
  loading?: boolean
}

export function ConfirmModal({
  open, onClose, onConfirm, title, message,
  confirmLabel = 'Confirmar', confirmVariant = 'primary', loading = false,
}: ConfirmModalProps) {
  const btnClass = confirmVariant === 'danger'
    ? 'bg-red-500 hover:bg-red-600 text-white'
    : 'bg-terracota-500 hover:bg-terracota-600 text-white'

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="text-center pb-2">
        <h3 className="text-lg font-semibold text-concreto-800 mb-2">{title}</h3>
        <p className="text-sm text-concreto-500 mb-5">{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-concreto-200 text-concreto-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${btnClass}`}
          >
            {loading ? 'Aguarde...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
