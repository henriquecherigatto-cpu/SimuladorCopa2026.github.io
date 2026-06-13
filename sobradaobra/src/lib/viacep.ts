import type { AddressData } from '../types'

export async function buscarCep(cep: string): Promise<AddressData | null> {
  const cleaned = cep.replace(/\D/g, '')
  if (cleaned.length !== 8) return null

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`)
    const data: AddressData = await res.json()
    if (data.erro) return null
    return data
  } catch {
    return null
  }
}

export function formatarCep(valor: string): string {
  const n = valor.replace(/\D/g, '').slice(0, 8)
  if (n.length > 5) return `${n.slice(0, 5)}-${n.slice(5)}`
  return n
}
