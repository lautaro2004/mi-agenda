// Layout común de los emails de Nexo: tablas + estilos inline (los clientes de
// correo ignoran <style>/clases), ancho fluido de hasta 600px, legible en
// móvil. Todo dato variable pasa por escapeHtml() antes de llegar acá.

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const BRAND = "#4f46e5";
const FONT = "-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif";

export function renderEmailLayout(params: { preheader: string; heading: string; bodyHtml: string; footerNote?: string }): string {
  const { preheader, heading, bodyHtml, footerNote } = params;
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:${FONT};color:#1f2430;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;">
<tr><td style="background:${BRAND};padding:18px 28px;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.2px;">Nexo</td></tr>
<tr><td style="padding:28px;">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#1f2430;">${escapeHtml(heading)}</h1>
${bodyHtml}
</td></tr>
<tr><td style="padding:16px 28px 24px;border-top:1px solid #ececf1;font-size:12px;line-height:1.5;color:#7a7f8c;">
${footerNote ? `${escapeHtml(footerNote)}<br>` : ""}Enviado con Nexo, un producto de Kodexa.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// Filas "etiqueta: valor" para el detalle de un turno.
export function renderDetailRows(rows: Array<[label: string, value: string]>): string {
  const cells = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 0;font-size:14px;color:#7a7f8c;width:38%;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:8px 0;font-size:15px;color:#1f2430;font-weight:600;">${escapeHtml(value)}</td></tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8fb;border-radius:10px;padding:8px 16px;">${cells}</table>`;
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3a3f4d;">${escapeHtml(text)}</p>`;
}

// Botón de llamada a la acción (a prueba de clientes de correo: tabla + <a>).
// La URL se escapa para atributo HTML.
export function renderButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;"><tr><td style="background:${BRAND};border-radius:10px;"><a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a></td></tr></table>`;
}

// Enlace de respaldo en texto por si el botón no se muestra.
export function renderFallbackLink(href: string): string {
  return `<p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:#7a7f8c;">Si el botón no funciona, copiá y pegá este enlace en tu navegador:<br><span style="word-break:break-all;color:#3a3f4d;">${escapeHtml(href)}</span></p>`;
}
