import { Link } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'

export function NotFound() {
  return (
    <Layout>
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
        <div className="text-6xl mb-4">🧱</div>
        <h1 className="text-2xl font-bold text-concreto-800 mb-2">Página não encontrada</h1>
        <p className="text-concreto-500 mb-6">Essa página não existe ou foi removida.</p>
        <Link to="/" className="bg-terracota-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-terracota-600 transition-colors">
          Voltar ao início
        </Link>
      </div>
    </Layout>
  )
}
