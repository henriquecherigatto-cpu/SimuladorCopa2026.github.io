import { Layout } from '../components/layout/Layout'

export function Privacy() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-6 text-sm text-amber-800">
          <strong>⚠️ Placeholder:</strong> Revise com um advogado para conformidade com a LGPD (Lei 13.709/2018) antes de publicar.
        </div>

        <h1 className="text-2xl font-bold text-concreto-800 mb-6">Política de Privacidade — SobraDaObra</h1>
        <p className="text-concreto-500 text-sm mb-6">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

        {[
          {
            titulo: '1. Dados que coletamos',
            items: [
              'Dados de cadastro: nome, e-mail, telefone (opcional)',
              'Dados dos anúncios: fotos, descrição, localização (cidade/bairro/CEP)',
              'Dados de uso: páginas visitadas, anúncios visualizados',
              'Dados de comunicação: mensagens trocadas entre usuários',
            ],
          },
          {
            titulo: '2. Como usamos seus dados',
            items: [
              'Para criar e gerenciar sua conta',
              'Para exibir seus anúncios e conectá-lo a compradores',
              'Para enviar notificações relacionadas à sua conta',
              'Para melhorar a plataforma e prevenir fraudes',
            ],
          },
          {
            titulo: '3. Compartilhamento',
            items: [
              'Não vendemos seus dados a terceiros',
              'Dados de anúncios são públicos (nome, cidade, telefone se informado)',
              'Podemos compartilhar dados com autoridades quando exigido por lei',
              'Utilizamos Supabase como provedor de infraestrutura e banco de dados',
            ],
          },
          {
            titulo: '4. Seus direitos (LGPD)',
            items: [
              'Acesso: solicitar cópia dos seus dados',
              'Correção: atualizar dados incorretos',
              'Exclusão: solicitar remoção da conta e dados',
              'Portabilidade: receber seus dados em formato estruturado',
              'Revogação de consentimento a qualquer momento',
            ],
          },
          {
            titulo: '5. Segurança',
            items: [
              'Senhas armazenadas com criptografia bcrypt',
              'Comunicação via HTTPS/TLS',
              'Autenticação gerenciada pelo Supabase Auth',
              'Acesso aos dados restrito por Row Level Security (RLS)',
            ],
          },
          {
            titulo: '6. Cookies',
            items: [
              'Utilizamos cookies essenciais para manter sua sessão',
              'Não utilizamos cookies de rastreamento de terceiros',
            ],
          },
        ].map(s => (
          <div key={s.titulo} className="mb-6">
            <h2 className="text-base font-semibold text-concreto-800 mb-3">{s.titulo}</h2>
            <ul className="space-y-1.5">
              {s.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-concreto-600">
                  <span className="text-terracota-400 mt-0.5 shrink-0">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="bg-concreto-50 rounded-2xl p-4 mt-6">
          <p className="text-sm text-concreto-600 mb-2 font-medium">Exercer seus direitos:</p>
          <p className="text-sm text-concreto-500">
            Envie um e-mail para{' '}
            <a href="mailto:privacidade@sobradaobra.com.br" className="text-terracota-600 hover:underline">
              privacidade@sobradaobra.com.br
            </a>
            {' '}com o assunto "Direitos LGPD".
          </p>
        </div>
      </div>
    </Layout>
  )
}
