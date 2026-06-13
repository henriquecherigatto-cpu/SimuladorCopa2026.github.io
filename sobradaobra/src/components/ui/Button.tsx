import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { Spinner } from './Spinner'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: ReactNode
  fullWidth?: boolean
}

const variants = {
  primary: 'bg-terracota-500 hover:bg-terracota-600 text-white shadow-sm',
  secondary: 'bg-concreto-600 hover:bg-concreto-700 text-white shadow-sm',
  outline: 'border-2 border-terracota-500 text-terracota-600 hover:bg-terracota-50',
  ghost: 'text-concreto-600 hover:bg-concreto-100',
  danger: 'bg-red-500 hover:bg-red-600 text-white',
}

const sizes = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-4 py-2.5 text-sm rounded-xl',
  lg: 'px-6 py-3 text-base rounded-xl',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  fullWidth = false,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-terracota-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  )
}
