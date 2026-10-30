import nodemailer from "nodemailer"

// Sends from the owner's own Zoho mailbox over SMTP, so the message really
// comes from that address. Configured only through environment variables:
//   SMTP_USER      e.g. darwin@lynsoluciones.es
//   SMTP_PASSWORD  a Zoho app-specific password (never the account password)
//   SMTP_HOST      optional, defaults to smtp.zoho.eu
//   SMTP_PORT      optional, defaults to 465 (SSL)

export function mailSender() {
  return process.env.SMTP_USER?.trim() || null
}

export function isMailConfigured() {
  return Boolean(mailSender() && process.env.SMTP_PASSWORD)
}

export async function sendMail(message: {
  to: string[]
  cc: string[]
  subject: string
  text: string
  attachments: { filename: string; content: Buffer; contentType: string }[]
}) {
  const user = mailSender()
  if (!user || !process.env.SMTP_PASSWORD) throw new Error("SMTP is not configured")
  const port = Number(process.env.SMTP_PORT) || 465
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST?.trim() || "smtp.zoho.eu",
    port,
    secure: port === 465,
    auth: { user, pass: process.env.SMTP_PASSWORD },
  })
  await transport.sendMail({
    from: user,
    to: message.to,
    cc: message.cc.length ? message.cc : undefined,
    // A copy for the sender, in case SMTP sends don't land in "Sent"
    bcc: user,
    subject: message.subject,
    text: message.text,
    attachments: message.attachments,
  })
}
