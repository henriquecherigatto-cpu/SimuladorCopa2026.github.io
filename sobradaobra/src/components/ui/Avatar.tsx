import { cn } from '../../lib/utils'

interface AvatarProps {
  src?: string | null
  nome?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizes = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-14 h-14 text-xl',
  xl: 'w-20 h-20 text-2xl',
}

function getInitials(nome: string): string {
  return nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

export function Avatar({ src, nome, size = 'md', className }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={nome ?? 'avatar'}
        className={cn('rounded-full object-cover shrink-0 bg-concreto-100', sizes[size], className)}
      />
    )
  }
  return (
    <div className={cn(
      'rounded-full bg-terracota-100 text-terracota-600 font-semibold flex items-center justify-center shrink-0',
      sizes[size],
      className,
    )}>
      {nome ? getInitials(nome) : '?'}
    </div>
  )
}
