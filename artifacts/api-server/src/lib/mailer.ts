import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "./logger";

/**
 * Envio de e-mail por SMTP (Nodemailer). Funciona com Gmail (senha de app) e com Brevo, só trocando
 * as variáveis de ambiente:
 *
 *   SMTP_HOST   Gmail: smtp.gmail.com        Brevo: smtp-relay.brevo.com
 *   SMTP_PORT   Gmail: 465                    Brevo: 587   (465 usa TLS direto; as outras, STARTTLS)
 *   SMTP_USER   Gmail: o endereço completo    Brevo: o login SMTP mostrado no painel
 *   SMTP_PASS   Gmail: senha de app de 16 letras (NÃO a senha da conta)   Brevo: a chave SMTP
 *   MAIL_FROM   remetente exibido, ex.: Cidade Aberta <voce@gmail.com>. No Gmail precisa ser o
 *               próprio endereço de SMTP_USER; no Brevo, um remetente verificado no painel.
 *
 * Sem essas variáveis o envio é pulado e registrado no log (o cadastro continua funcionando).
 */
let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;
  const host = process.env["SMTP_HOST"];
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];
  if (!host || !user || !pass) return null;
  const port = Number(process.env["SMTP_PORT"] ?? 465);
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    // Função serverless: falhar rápido em vez de segurar a requisição até o limite da Vercel.
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 12_000,
  });
  return transporter;
}

/** Endereço público do site, usado nos links dos e-mails. Nunca vem do cabeçalho Host da requisição. */
export function appUrl(): string | null {
  const explicit = process.env["APP_URL"]?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  // A Vercel define esta variável (sem o https://) com o domínio de produção do projeto.
  const vercel = process.env["VERCEL_PROJECT_PRODUCTION_URL"]?.trim();
  return vercel ? `https://${vercel}` : null;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Devolve true se o e-mail foi aceito pelo servidor SMTP. Nunca lança: falha de e-mail não derruba a rota. */
export async function sendVerificationEmail(to: string, name: string, token: string): Promise<boolean> {
  const t = getTransporter();
  const base = appUrl();
  if (!t || !base) {
    logger.error({ hasSmtp: !!t, hasAppUrl: !!base }, "E-mail de verificação não enviado: SMTP_* ou APP_URL não configurados");
    return false;
  }
  const link = `${base}/verificar-email?token=${encodeURIComponent(token)}`;
  const from = process.env["MAIL_FROM"] || process.env["SMTP_USER"];
  const firstName = escapeHtml(name.split(/\s+/)[0] || "olá");
  try {
    await t.sendMail({
      from,
      to,
      subject: "Confirme seu e-mail no Cidade Aberta",
      text:
        `Olá, ${name.split(/\s+/)[0] || ""}!\n\n` +
        `Para confirmar seu e-mail e poder apoiar, comentar e confirmar resoluções, abra o link abaixo (vale por 24 horas):\n\n` +
        `${link}\n\n` +
        `Se você não criou uma conta no Cidade Aberta, ignore esta mensagem.`,
      html:
        `<p>Olá, ${firstName}!</p>` +
        `<p>Para confirmar seu e-mail e poder apoiar, comentar e confirmar resoluções, clique no botão abaixo (vale por 24 horas):</p>` +
        `<p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#0f766e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Confirmar meu e-mail</a></p>` +
        `<p style="color:#555;font-size:13px">Se o botão não funcionar, copie este endereço no navegador:<br>${escapeHtml(link)}</p>` +
        `<p style="color:#555;font-size:13px">Se você não criou uma conta no Cidade Aberta, ignore esta mensagem.</p>`,
    });
    return true;
  } catch (err) {
    logger.error({ err }, "Falha ao enviar o e-mail de verificação");
    return false;
  }
}
