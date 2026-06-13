import { forwardRef } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: ReactNode
  rightElement?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label, error, hint, leftIcon, rightElement, className, id, ...props
}, ref) => {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-concreto-700">
          {label}
          {props.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <div className="absolute left-3 text-concreto-400">{leftIcon}</div>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full border rounded-xl px-3 py-2.5 text-sm text-concreto-800 bg-white placeholder:text-concreto-300',
            'focus:outline-none focus:ring-2 focus:ring-terracota-400 focus:border-terracota-400 transition-all',
            'disabled:bg-gray-50 disabled:cursor-not-allowed',
            error ? 'border-red-400' : 'border-concreto-200',
            leftIcon ? 'pl-10' : undefined,
            rightElement ? 'pr-10' : undefined,
            className,
          )}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-3 text-concreto-400">{rightElement}</div>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="text-xs text-concreto-400">{hint}</p>}
    </div>
  )
})

Input.displayName = 'Input'
