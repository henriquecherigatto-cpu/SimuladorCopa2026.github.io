import type { ReactNode } from 'react'
import { Navbar } from './Navbar'

interface LayoutProps {
  children: ReactNode
  noPadding?: boolean
}

export function Layout({ children, noPadding = false }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className={`md:pt-16 pb-16 md:pb-0 ${noPadding ? '' : 'px-4 py-4 md:px-6 md:py-6 max-w-6xl mx-auto'}`}>
        {children}
      </main>
    </div>
  )
}
