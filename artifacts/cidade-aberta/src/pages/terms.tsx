import { Link } from "wouter";
import { LegalPage, LegalSection, LegalList } from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";

export default function Terms() {
  return (
    <LegalPage title="Termos de Uso">
      <p>
        Ao criar uma conta ou usar o {LEGAL.siteName}, você concorda com estes termos. Se não concordar, não use a
        plataforma.
      </p>

      <LegalSection title="1. O que é o Cidade Aberta">
        <p>
          É uma plataforma independente, mantida pela {LEGAL.controller} ({LEGAL.place}), para moradores registrarem,
          verem e apoiarem problemas urbanos. <strong>Não é um canal oficial da Prefeitura nem de qualquer órgão
          público</strong>, e registrar uma demanda aqui não equivale a abrir um protocolo junto ao poder público.
        </p>
      </LegalSection>

      <LegalSection title="2. Não use para emergências">
        <p>
          O {LEGAL.siteName} não atende urgências. Em caso de risco, ligue para o SAMU (192), os Bombeiros (193), a
          Polícia Militar (190) ou a Defesa Civil (199).
        </p>
      </LegalSection>

      <LegalSection title="3. Sua conta">
        <LegalList
          items={[
            "Informe dados verdadeiros e mantenha sua senha em sigilo. Você responde pelo que for feito com a sua conta.",
            "Cada pessoa deve ter uma conta. Contas falsas ou usadas para enganar podem ser removidas.",
            "Tentativas repetidas de acesso são bloqueadas por um tempo, por segurança.",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Regras para o conteúdo que você envia">
        <p>Você é responsável por tudo o que publica. É proibido enviar:</p>
        <LegalList
          items={[
            "nomes, endereços ou acusações contra pessoas identificáveis. Descreva o problema e o local, não quem “é o culpado”;",
            "fotos com rostos, crianças ou placas de veículos;",
            "conteúdo ofensivo, discriminatório, ilegal, falso ou de propaganda;",
            "fotos ou textos de outras pessoas sem autorização. Envie só imagens que você mesmo fez ou que tem direito de usar.",
          ]}
        />
        <p>
          Ao enviar uma demanda, você autoriza o {LEGAL.siteName} a exibi-la publicamente na plataforma depois de
          aprovada, sem pagamento e sem exclusividade. Você continua dono do que enviou.
        </p>
      </LegalSection>

      <LegalSection title="5. Moderação">
        <p>
          Toda demanda é analisada antes de aparecer para o público. A moderação pode aprovar, rejeitar ou remover
          conteúdo que viole estes termos, e pode suspender contas que abusem da plataforma. Quando uma demanda é
          rejeitada, o autor pode ver o motivo.
        </p>
      </LegalSection>

      <LegalSection title="6. Pontos cívicos">
        <p>A pontuação e o ranking são apenas reconhecimento de participação. Não têm valor em dinheiro nem dão direito a benefícios.</p>
      </LegalSection>

      <LegalSection title="7. Limites de responsabilidade">
        <p>
          O serviço é oferecido como está, sem garantia de funcionamento ininterrupto. Não garantimos que uma demanda
          será respondida ou resolvida, nem que órgãos públicos vão atuar sobre ela. Não nos responsabilizamos pelo
          conteúdo enviado pelos usuários, mas vamos remover o que violar estes termos quando tomarmos conhecimento.
        </p>
      </LegalSection>

      <LegalSection title="8. Dados pessoais">
        <p>
          O tratamento dos seus dados está descrito na{" "}
          <Link href="/privacidade" className="text-primary underline">Política de Privacidade</Link>.
        </p>
      </LegalSection>

      <LegalSection title="9. Mudanças, lei e contato">
        <p>
          Podemos alterar estes termos, e a data de atualização fica no topo da página. Valem as leis brasileiras, e o
          foro é o da comarca de {LEGAL.place.split(",")[0]}, sem prejuízo dos direitos do consumidor. Dúvidas:{" "}
          <a className="text-primary underline" href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
