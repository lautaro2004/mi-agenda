import { escapeHtml, paragraph, renderButton, renderDetailRows, renderEmailLayout, renderFallbackLink } from "./layout";
import { formatDateEs } from "./time";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const CATEGORY_NOTE = "Si no reservaste este turno, podés ignorar este mensaje.";

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(amount);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export interface BookingEmailData {
  businessName: string;
  customerName: string;
  serviceName: string;
  date: string;
  startTime: string;
  notes?: string | null;
  // Turno con seña: todavía no está confirmado hasta que el dueño valide el pago.
  pendingPayment?: boolean;
  depositAmount?: number | null;
  totalAmount?: number | null;
}

function bookingRows(data: BookingEmailData): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ["Negocio", data.businessName],
    ["Servicio", data.serviceName],
    ["Fecha", capitalize(formatDateEs(data.date))],
    ["Hora", `${data.startTime} hs`],
  ];
  if (data.totalAmount != null) rows.push(["Total", formatMoney(data.totalAmount)]);
  if (data.pendingPayment && data.depositAmount != null) rows.push(["Seña a abonar", formatMoney(data.depositAmount)]);
  if (data.notes) rows.push(["Notas", data.notes]);
  return rows;
}

function bookingText(intro: string, data: BookingEmailData): string {
  return [intro, "", ...bookingRows(data).map(([l, v]) => `${l}: ${v}`)].join("\n");
}

export function bookingConfirmationEmail(data: BookingEmailData): RenderedEmail {
  const heading = data.pendingPayment ? "Recibimos tu reserva" : "Tu turno está confirmado";
  const intro = data.pendingPayment
    ? `Hola ${data.customerName}, recibimos tu reserva. Va a quedar confirmada cuando validemos el pago de la seña.`
    : `Hola ${data.customerName}, tu turno quedó confirmado.`;
  const html = renderEmailLayout({
    preheader: `${data.serviceName} — ${capitalize(formatDateEs(data.date))}, ${data.startTime} hs`,
    heading,
    bodyHtml: paragraph(intro) + renderDetailRows(bookingRows(data)),
    footerNote: CATEGORY_NOTE,
  });
  return {
    subject: `${heading} — ${data.businessName}`,
    html,
    text: bookingText(intro, data),
  };
}

export function appointmentReminderEmail(data: BookingEmailData, leadMinutes: number): RenderedEmail {
  const when = leadMinutes >= 60 ? "en 1 hora" : `en ${leadMinutes} minutos`;
  const intro = `Hola ${data.customerName}, te recordamos que tenés un turno ${when}.`;
  const html = renderEmailLayout({
    preheader: `Tu turno es ${when} — ${data.startTime} hs`,
    heading: "Recordatorio de tu turno",
    bodyHtml: paragraph(intro) + renderDetailRows(bookingRows(data)),
  });
  return {
    subject: `Recordatorio: tu turno ${when} — ${data.businessName}`,
    html,
    text: bookingText(intro, data),
  };
}

export interface DailySummaryAppointment {
  startTime: string;
  endTime: string;
  customerName: string;
  serviceName: string;
  pendingPayment?: boolean;
}

export function dailySummaryEmail(data: {
  businessName: string;
  date: string;
  appointments: DailySummaryAppointment[];
}): RenderedEmail {
  const dateLabel = capitalize(formatDateEs(data.date));
  const list = data.appointments;

  let bodyHtml: string;
  let text: string;
  if (list.length === 0) {
    const msg = "No tenés turnos agendados para hoy.";
    bodyHtml = paragraph(msg);
    text = `${dateLabel}\n${msg}`;
  } else {
    const first = list[0];
    const last = list[list.length - 1];
    const summary = `${list.length} ${list.length === 1 ? "turno" : "turnos"} · Primero a las ${first.startTime} hs · Último a las ${last.startTime} hs`;
    const items = list
      .map(
        (a) =>
          `<tr><td style="padding:10px 0;border-bottom:1px solid #ececf1;font-size:14px;color:#1f2430;"><strong>${escapeHtml(a.startTime)}</strong> &nbsp;${escapeHtml(a.customerName)}<br><span style="color:#7a7f8c;">${escapeHtml(a.serviceName)}${a.pendingPayment ? " · pendiente de pago" : ""}</span></td></tr>`
      )
      .join("");
    bodyHtml =
      paragraph(summary) +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>`;
    text = [
      dateLabel,
      summary,
      "",
      ...list.map((a) => `${a.startTime} - ${a.customerName} (${a.serviceName}${a.pendingPayment ? ", pendiente de pago" : ""})`),
    ].join("\n");
  }

  return {
    subject: `Tu agenda de hoy — ${data.businessName}`,
    html: renderEmailLayout({
      preheader: list.length === 0 ? "No tenés turnos para hoy" : `${list.length} turnos para hoy`,
      heading: `${dateLabel} · ${data.businessName}`,
      bodyHtml,
    }),
    text,
  };
}

// ── Emails de cuenta (propios de la plataforma, salen por sendPlatformEmail) ──

export function verificationEmail(data: { name: string; url: string }): RenderedEmail {
  const intro = `Hola ${data.name}, confirmá tu email para terminar de activar tu cuenta de Nexo.`;
  return {
    subject: "Confirmá tu email — Nexo",
    html: renderEmailLayout({
      preheader: "Confirmá tu email para activar tu cuenta",
      heading: "Confirmá tu email",
      bodyHtml: paragraph(intro) + renderButton(data.url, "Confirmar mi email") + renderFallbackLink(data.url),
      footerNote: "Si no creaste una cuenta en Nexo, podés ignorar este mensaje.",
    }),
    text: `${intro}\n\nConfirmar mi email: ${data.url}\n\nSi no creaste una cuenta en Nexo, ignorá este mensaje.`,
  };
}

export function passwordResetEmail(data: { name: string; url: string; expiresInMinutes: number }): RenderedEmail {
  const intro = `Hola ${data.name}, recibimos un pedido para restablecer la contraseña de tu cuenta de Nexo. El enlace es de un solo uso y vence en ${data.expiresInMinutes} minutos.`;
  return {
    subject: "Restablecé tu contraseña — Nexo",
    html: renderEmailLayout({
      preheader: "Enlace para restablecer tu contraseña",
      heading: "Restablecé tu contraseña",
      bodyHtml: paragraph(intro) + renderButton(data.url, "Elegir una contraseña nueva") + renderFallbackLink(data.url),
      footerNote: "Si no pediste este cambio, ignorá este mensaje: tu contraseña actual sigue funcionando.",
    }),
    text: `${intro}\n\nElegir una contraseña nueva: ${data.url}\n\nSi no lo pediste, ignorá este mensaje.`,
  };
}
