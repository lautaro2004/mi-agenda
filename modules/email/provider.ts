// Envío por Resend vía REST (mismo criterio que crm/modules/email/providers.ts:
// sin SDK ni dependencias nuevas). Es el proveedor de la PLATAFORMA: la API key
// es un secreto de Kodexa (RESEND_API_KEY), nunca por negocio. Extiende el
// patrón del CRM con el header Idempotency-Key (Resend lo respeta 24 h), reply-to
// y texto plano.

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text?: string;
  // Nombre visible del remitente (ej. el negocio); la dirección siempre es la
  // de la plataforma (EMAIL_FROM), así el negocio no configura dominio ni DNS.
  fromName?: string;
  replyTo?: string;
  // Misma clave = mismo email: un reintento no genera un segundo envío.
  idempotencyKey?: string;
}

export type SendResult = { ok: true; simulated: boolean; messageId?: string } | { ok: false; error: string };

const DEFAULT_FROM = "Nexo <contacto@kodexa.ar>";

// "Nombre <a@b.c>" o "a@b.c" → { name, address }
function parseFrom(raw: string): { name: string | null; address: string } {
  const match = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return match ? { name: match[1] || null, address: match[2].trim() } : { name: null, address: raw.trim() };
}

function sanitizeName(name: string): string {
  return name.replace(/[<>"\r\n]/g, "").trim();
}

export function buildFromHeader(fromName?: string): string {
  const { name: defaultName, address } = parseFrom(process.env.EMAIL_FROM || DEFAULT_FROM);
  const display = sanitizeName(fromName ?? "") || defaultName;
  return display ? `${display} <${address}>` : address;
}

// Sin RESEND_API_KEY (desarrollo/preview) no se entrega nada: el resultado se
// marca `simulated` y el flujo completo se puede probar igual.
export async function sendViaResend(message: OutgoingEmail): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[email] RESEND_API_KEY no configurada: envío simulado (no se entregó nada).");
    return { ok: true, simulated: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: buildFromHeader(message.fromName),
        to: [message.to],
        subject: message.subject,
        html: message.html,
        ...(message.text ? { text: message.text } : {}),
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) return { ok: false, error: data.message ?? `http_${res.status}` };
    return { ok: true, simulated: false, messageId: data.id };
  } catch {
    return { ok: false, error: "network_error" };
  }
}
