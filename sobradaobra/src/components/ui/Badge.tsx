import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface BadgeProps {
  children: ReactNode
  variant?: 'terracota' | 'green' | 'gray' | 'yellow' | 'red' | 'blue'
  size?: 'sm' | 'md'
  className?: string
}

const variants = {
  terracota: 'bg-terracota-100 text-terracota-700',
  green: 'bg-green-100 text-green-700',
  gray: 'bg-gray-100 text-gray-600',
  yellow: 'bg-yellow-100 text-yellow-700',
  red: 'bg-red-100 text-red-600',
  blue: 'bg-blue-100 text-blue-600',
}

const sizes = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
}

export function Badge({ children, variant = 'gray', size = 'md', className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center rounded-full font-medium', variants[variant], sizes[size], className)}>
      {children}
    </span>
  )
}
