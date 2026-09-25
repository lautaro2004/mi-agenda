import { getAccessToken, GoogleConnectionError, type GoogleScope } from "@/lib/google/connection";
import type { SendResult } from "./provider";

// Envío por la API de Gmail (users.messages.send) con el token del usuario que
// conectó su cuenta. Solo envía: el scope gmail.send no permite leer el buzón.

const SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

export interface GmailMessage {
  fromEmail: string;
  fromName?: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

// Los valores de cabecera nunca pueden contener saltos de línea (inyección de
// cabeceras).
const header = (value: string) => value.replace(/[\r\n]+/g, " ").trim();
const b64 = (value: string) => Buffer.from(value, "utf8").toString("base64");
const wrap76 = (value: string) => value.replace(/(.{76})/g, "$1\r\n");

function encodeWord(value: string): string {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${b64(value)}?=`;
}

export function buildRawMessage(message: GmailMessage): string {
  const boundary = `nexo_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const from = message.fromName
    ? `${encodeWord(header(message.fromName).replace(/"/g, ""))} <${header(message.fromEmail)}>`
    : header(message.fromEmail);

  const lines = [
    `From: ${from}`,
    `To: ${header(message.to)}`,
    ...(message.replyTo ? [`Reply-To: ${header(message.replyTo)}`] : []),
    `Subject: ${encodeWord(header(message.subject))}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(b64(message.text ?? message.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(b64(message.html)),
    `--${boundary}--`,
    "",
  ];
  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}

export async function sendViaGmail(scope: GoogleScope, message: GmailMessage): Promise<SendResult> {
  try {
    const accessToken = await getAccessToken(scope, "gmail");
    const response = await fetch(SEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: buildRawMessage(message) }),
    });
    const data = (await response.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
    if (!response.ok) return { ok: false, error: `gmail_http_${response.status}` };
    return { ok: true, simulated: false, messageId: data.id, provider: "gmail" };
  } catch (error) {
    // Solo códigos internos: nunca el token ni el detalle de la respuesta.
    if (error instanceof GoogleConnectionError) return { ok: false, error: `gmail_${error.code}` };
    return { ok: false, error: "gmail_network_error" };
  }
}
