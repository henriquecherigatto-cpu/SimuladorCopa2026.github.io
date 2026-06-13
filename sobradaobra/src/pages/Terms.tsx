import { Layout } from '../components/layout/Layout'

export function Terms() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto prose prose-sm">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-6 text-sm text-amber-800">
          <strong>⚠️ Placeholder:</strong> Este é um texto genérico. Consulte um advogado para adequar aos requisitos legais brasileiros (LGPD, CDC, etc.) antes de publicar.
        </div>

        <h1 className="text-2xl font-bold text-concreto-800 mb-6">Termos de Uso — SobraDaObra</h1>
        <p className="text-concreto-500 text-sm mb-6">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

        {[
          {
            titulo: '1. Aceitação dos Termos',
            texto: 'Ao acessar e utilizar a plataforma SobraDaObra, você concorda com estes Termos de Uso. Caso não concorde, não utilize a plataforma.',
          },
          {
            titulo: '2. Descrição do Serviço',
            texto: 'O SobraDaObra é uma plataforma de anúncios para compra e venda de sobras de materiais de construção e reforma. A plataforma conecta vendedores e compradores, mas não é parte das transações realizadas entre eles.',
          },
          {
            titulo: '3. Cadastro e Conta',
            texto: 'Para anunciar, é necessário criar uma conta com informações verdadeiras e manter os dados atualizados. Você é responsável por manter a confidencialidade de suas credenciais de acesso.',
          },
          {
            titulo: '4. Anúncios',
            texto: 'Os usuários são responsáveis pelo conteúdo dos seus anúncios. É proibido anunciar materiais ilegais, perigosos, falsificados ou que violem direitos de terceiros. O SobraDaObra reserva-se o direito de remover anúncios que violem estas regras.',
          },
          {
            titulo: '5. Transações',
            texto: 'O SobraDaObra não participa das negociações entre compradores e vendedores. Recomendamos cautela nas transações: combine o pagamento e entrega pessoalmente, em local seguro, sempre que possível.',
          },
          {
            titulo: '6. Avaliações',
            texto: 'O sistema de avaliações deve ser usado de forma honesta. É proibido manipular avaliações ou usar dados falsos.',
          },
          {
            titulo: '7. Privacidade',
            texto: 'O tratamento dos seus dados pessoais é regido pela nossa Política de Privacidade, disponível no site.',
          },
          {
            titulo: '8. Limitação de Responsabilidade',
            texto: 'O SobraDaObra não se responsabiliza por danos decorrentes das transações realizadas entre usuários, por informações falsas em anúncios, ou por qualquer uso indevido da plataforma.',
          },
          {
            titulo: '9. Alterações',
            texto: 'Estes Termos podem ser alterados a qualquer momento. As alterações entram em vigor na data de publicação. O uso contínuo da plataforma implica concordância com os novos termos.',
          },
          {
            titulo: '10. Foro',
            texto: 'Para dirimir quaisquer controvérsias, fica eleito o foro da comarca de [sua cidade], Estado de [seu estado], renunciando a qualquer outro, por mais privilegiado que seja.',
          },
        ].map(s => (
          <div key={s.titulo} className="mb-6">
            <h2 className="text-base font-semibold text-concreto-800 mb-2">{s.titulo}</h2>
            <p className="text-concreto-600 text-sm leading-relaxed">{s.texto}</p>
          </div>
        ))}

        <div className="bg-concreto-50 rounded-2xl p-4 mt-8">
          <p className="text-sm text-concreto-500 text-center">
            Dúvidas? Entre em contato: <a href="mailto:contato@sobradaobra.com.br" className="text-terracota-600 hover:underline">contato@sobradaobra.com.br</a>
          </p>
        </div>
      </div>
    </Layout>
  )
}
