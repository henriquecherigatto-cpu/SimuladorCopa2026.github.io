import { useState, useEffect, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Send, ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Message, Profile } from '../types'
import { Layout } from '../components/layout/Layout'
import { Avatar } from '../components/ui/Avatar'
import { Spinner } from '../components/ui/Spinner'
import { formatarDataRelativa } from '../lib/utils'

interface Conversa {
  outro: Profile
  ultima: Message
  naoLidas: number
}

export function Messages() {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const vendedorId = params.get('vendedor')
  const listingId = params.get('listing')

  const [conversas, setConversas] = useState<Conversa[]>([])
  const [conversaAtiva, setConversaAtiva] = useState<string | null>(vendedorId)
  const [mensagens, setMensagens] = useState<Message[]>([])
  const [outro, setOutro] = useState<Profile | null>(null)
  const [texto, setTexto] = useState('')
  const [loadingConversas, setLoadingConversas] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    carregarConversas()
  }, [user])

  useEffect(() => {
    if (conversaAtiva) carregarMensagens(conversaAtiva)
  }, [conversaAtiva])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  async function carregarConversas() {
    if (!user) return
    const { data } = await supabase
      .from('messages')
      .select('*, remetente:remetente_id(id,nome,foto_url), destinatario:destinatario_id(id,nome,foto_url)')
      .or(`remetente_id.eq.${user.id},destinatario_id.eq.${user.id}`)
      .order('criado_em', { ascending: false })

    if (!data) { setLoadingConversas(false); return }

    const mapa = new Map<string, Conversa>()
    for (const msg of data) {
      const outroUser = msg.remetente_id === user.id ? msg.destinatario : msg.remetente
      if (!outroUser || mapa.has(outroUser.id)) continue
      mapa.set(outroUser.id, {
        outro: outroUser as Profile,
        ultima: msg as Message,
        naoLidas: data.filter(m => m.destinatario_id === user.id && m.remetente_id === outroUser.id && !m.lido).length,
      })
    }
    setConversas(Array.from(mapa.values()))
    setLoadingConversas(false)

    if (vendedorId && !mapa.has(vendedorId)) {
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', vendedorId).single()
      if (prof) setOutro(prof)
    }
  }

  async function carregarMensagens(outroId: string) {
    if (!user) return
    setLoadingMsgs(true)
    const { data } = await supabase
      .from('messages')
      .select('*, remetente:remetente_id(id,nome,foto_url)')
      .or(`and(remetente_id.eq.${user.id},destinatario_id.eq.${outroId}),and(remetente_id.eq.${outroId},destinatario_id.eq.${user.id})`)
      .order('criado_em', { ascending: true })

    setMensagens((data || []) as Message[])
    setLoadingMsgs(false)

    const conv = conversas.find(c => c.outro.id === outroId)
    if (conv) setOutro(conv.outro)
    else {
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', outroId).single()
      if (prof) setOutro(prof)
    }

    await supabase.from('messages')
      .update({ lido: true })
      .eq('destinatario_id', user.id)
      .eq('remetente_id', outroId)
      .eq('lido', false)
  }

  async function enviarMensagem() {
    if (!texto.trim() || !conversaAtiva || !user) return
    setEnviando(true)
    const nova: Record<string, unknown> = {
      remetente_id: user.id,
      destinatario_id: conversaAtiva,
      conteudo: texto.trim(),
    }
    if (listingId) nova.listing_id = listingId

    const { data } = await supabase.from('messages').insert(nova).select('*, remetente:remetente_id(id,nome,foto_url)').single()
    if (data) setMensagens(prev => [...prev, data as Message])
    setTexto('')
    setEnviando(false)
    carregarConversas()
  }

  if (!user) return (
    <Layout>
      <div className="text-center py-20">
        <p className="text-concreto-500 mb-4">Faça login para ver suas mensagens.</p>
        <Link to="/entrar" className="text-terracota-600 font-medium hover:underline">Entrar</Link>
      </div>
    </Layout>
  )

  return (
    <Layout noPadding>
      <div className="md:pt-16 max-w-5xl mx-auto h-[calc(100vh-4rem)] flex border-x border-concreto-100">
        {/* Lista de conversas */}
        <div className={`w-full md:w-80 border-r border-concreto-100 flex flex-col ${conversaAtiva ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-concreto-100">
            <h1 className="font-bold text-concreto-800">Mensagens</h1>
          </div>
          {loadingConversas ? (
            <div className="flex justify-center py-8"><Spinner className="text-terracota-400" /></div>
          ) : conversas.length === 0 ? (
            <div className="text-center py-12 px-4">
              <p className="text-concreto-400 text-sm">Nenhuma conversa ainda.</p>
              <p className="text-concreto-400 text-xs mt-1">Entre em contato com um vendedor via botão nos anúncios.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {conversas.map(conv => (
                <button
                  key={conv.outro.id}
                  onClick={() => setConversaAtiva(conv.outro.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left ${conversaAtiva === conv.outro.id ? 'bg-terracota-50' : ''}`}
                >
                  <Avatar src={conv.outro.foto_url} nome={conv.outro.nome} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm text-concreto-800 truncate">{conv.outro.nome}</p>
                      <span className="text-xs text-concreto-400 shrink-0 ml-1">{formatarDataRelativa(conv.ultima.criado_em)}</span>
                    </div>
                    <p className="text-xs text-concreto-500 truncate">{conv.ultima.conteudo}</p>
                  </div>
                  {conv.naoLidas > 0 && (
                    <span className="bg-terracota-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                      {conv.naoLidas}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Área de mensagens */}
        {conversaAtiva ? (
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header da conversa */}
            <div className="p-4 border-b border-concreto-100 flex items-center gap-3">
              <button onClick={() => setConversaAtiva(null)} className="md:hidden text-concreto-500">
                <ArrowLeft size={20} />
              </button>
              {outro && (
                <>
                  <Avatar src={outro.foto_url} nome={outro.nome} size="sm" />
                  <Link to={`/usuario/${outro.id}`} className="font-medium text-concreto-800 hover:text-terracota-600">{outro.nome}</Link>
                </>
              )}
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingMsgs ? (
                <div className="flex justify-center"><Spinner className="text-terracota-400" /></div>
              ) : mensagens.length === 0 ? (
                <p className="text-center text-concreto-400 text-sm py-8">Inicie a conversa enviando uma mensagem.</p>
              ) : (
                mensagens.map(msg => {
                  const minha = msg.remetente_id === user.id
                  return (
                    <div key={msg.id} className={`flex ${minha ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${minha ? 'bg-terracota-500 text-white rounded-br-sm' : 'bg-white border border-concreto-100 text-concreto-700 rounded-bl-sm'}`}>
                        <p>{msg.conteudo}</p>
                        <p className={`text-xs mt-1 ${minha ? 'text-terracota-200' : 'text-concreto-400'}`}>{formatarDataRelativa(msg.criado_em)}</p>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input de mensagem */}
            <div className="p-4 border-t border-concreto-100 flex gap-2">
              <input
                type="text"
                placeholder="Digite uma mensagem..."
                value={texto}
                onChange={e => setTexto(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviarMensagem()}
                className="flex-1 border border-concreto-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracota-400"
              />
              <button
                onClick={enviarMensagem}
                disabled={!texto.trim() || enviando}
                className="bg-terracota-500 hover:bg-terracota-600 disabled:opacity-50 text-white p-2.5 rounded-xl transition-colors"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center text-center">
            <div>
              <div className="text-5xl mb-3">💬</div>
              <p className="text-concreto-500">Selecione uma conversa</p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
