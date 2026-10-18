import { Link } from "wouter";
import { LegalPage, LegalSection, LegalList } from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";

export default function Privacy() {
  return (
    <LegalPage title="Política de Privacidade">
      <p>
        Esta política explica quais dados o {LEGAL.siteName} coleta, para que usa, com quem compartilha e como você
        pode exercer seus direitos, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018, a LGPD).
      </p>

      <LegalSection title="1. Quem é o responsável">
        <p>
          O responsável pelo tratamento dos seus dados é a <strong>{LEGAL.controller}</strong>, em {LEGAL.place}. O
          {" "}{LEGAL.siteName} é uma plataforma independente de participação cidadã. Para falar sobre seus dados, escreva
          para <a className="text-primary underline" href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
        </p>
      </LegalSection>

      <LegalSection title="2. Dados que coletamos">
        <LegalList
          items={[
            <><strong>Cadastro:</strong> nome, e-mail e senha. A senha é guardada de forma protegida (hash), nunca em texto legível.</>,
            <><strong>Demandas que você registra:</strong> título, descrição, endereço ou referência, coordenadas do local marcado no mapa e fotos.</>,
            <><strong>Interações:</strong> apoios (“Também me afeta”), comentários e a pontuação cívica da sua conta.</>,
            <><strong>Segurança:</strong> para limitar tentativas excessivas de login e de cadastro, guardamos o seu endereço IP e o e-mail digitado, junto com o horário da tentativa. Esses registros só valem por cerca de um dia.</>,
            <><strong>Cookie de sessão:</strong> um cookie necessário para manter você logado por até 7 dias. Não usamos cookies de publicidade nem de análise de audiência.</>,
          ]}
        />
        <p>
          Nas fotos em formato JPEG, removemos os metadados (como a posição do GPS gravada pela câmera). Mesmo assim, o
          local que você marca no mapa e as imagens enviadas fazem parte da demanda.
        </p>
      </LegalSection>

      <LegalSection title="3. Para que usamos os dados">
        <LegalList
          items={[
            "Criar e manter a sua conta e identificar quem registra cada demanda.",
            "Exibir as demandas aprovadas no mapa, na lista e no painel de transparência.",
            "Moderar o conteúdo antes da publicação e proteger a plataforma contra abuso.",
            "Calcular estatísticas e a pontuação cívica.",
          ]}
        />
        <p>
          As bases legais são o seu consentimento ao criar a conta, a execução do serviço que você pediu e o interesse
          legítimo em manter a plataforma segura.
        </p>
      </LegalSection>

      <LegalSection title="4. O que fica público">
        <p>
          Toda demanda passa por moderação. Depois de aprovada, ficam visíveis para qualquer pessoa: o título, a
          descrição, o endereço ou referência, a localização no mapa, as fotos e o seu nome abreviado (por exemplo,
          “Maria S.”). Seu e-mail e sua senha nunca são exibidos. Por isso, não escreva dados pessoais de terceiros na
          demanda e evite fotos com rostos, crianças e placas de veículos.
        </p>
      </LegalSection>

      <LegalSection title="5. Com quem compartilhamos">
        <p>Não vendemos seus dados. Usamos prestadores que processam informações para o site funcionar:</p>
        <LegalList
          items={[
            "Vercel: hospedagem do site e da API.",
            "Neon: banco de dados onde ficam as informações da plataforma.",
            "OpenStreetMap: imagens do mapa. Ao abrir um mapa, o seu navegador se conecta aos servidores dele e o seu IP é visto por eles.",
            "Google Fonts e unpkg: carregam a fonte do texto e os ícones dos pinos do mapa, e também recebem o seu IP.",
          ]}
        />
        <p>
          Alguns desses prestadores podem processar dados fora do Brasil. Também podemos compartilhar dados quando uma
          lei ou decisão judicial exigir.
        </p>
      </LegalSection>

      <LegalSection title="6. Por quanto tempo guardamos">
        <p>
          Mantemos os dados da sua conta e das suas demandas enquanto a conta existir ou enquanto forem necessários para
          a finalidade descrita aqui. Os registros de tentativas de login e de cadastro valem por cerca de um dia e são
          apagados nas limpezas automáticas seguintes. Demandas rejeitadas pela moderação não ficam visíveis ao público.
        </p>
      </LegalSection>

      <LegalSection title="7. Seus direitos">
        <p>Pela LGPD, você pode pedir, a qualquer momento:</p>
        <LegalList
          items={[
            "confirmação de que tratamos seus dados e acesso a eles;",
            "correção de dados incompletos ou desatualizados;",
            "anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desacordo com a lei;",
            "portabilidade dos dados;",
            "informação sobre com quem compartilhamos seus dados;",
            "eliminação dos dados tratados com base no seu consentimento, e revogação desse consentimento.",
          ]}
        />
        <p>
          Para exercer esses direitos, escreva para{" "}
          <a className="text-primary underline" href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>. Se
          considerar que o tratamento viola a lei, você também pode recorrer à Autoridade Nacional de Proteção de Dados
          (ANPD).
        </p>
      </LegalSection>

      <LegalSection title="8. Crianças e adolescentes">
        <p>
          O {LEGAL.siteName} não é direcionado a crianças. Menores de 18 anos só devem usar a plataforma com o
          conhecimento e o acompanhamento de um responsável.
        </p>
      </LegalSection>

      <LegalSection title="9. Segurança">
        <p>
          Protegemos as senhas com algoritmo de hash, limitamos tentativas repetidas de acesso e restringimos a
          moderação a contas autorizadas. Nenhum sistema é totalmente imune a falhas. Se houver um incidente que possa
          afetar você, comunicaremos conforme a lei.
        </p>
      </LegalSection>

      <LegalSection title="10. Mudanças nesta política">
        <p>
          Podemos atualizar este texto. A data de atualização fica no topo da página. Leia também os{" "}
          <Link href="/termos" className="text-primary underline">Termos de Uso</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
