// Sin dependencias de servidor a propósito, mismo criterio que
// lib/document-limits.ts y lib/asset-limits.ts: server y cliente comparten
// esta única fuente para validar — nunca confiar solo en el chequeo del
// cliente, el servidor siempre revalida contra esto mismo.
//
// A diferencia de los documentos de AI Studio (PDF/DOCX/TXT), un comprobante
// de transferencia casi siempre es una foto sacada desde el celular: no
// asumimos que siempre va a ser JPG/PNG (ver sección 3 de la tarea) — WEBP y
// HEIC son comunes en capturas/fotos de iPhone y Android recientes, y un PDF
// cubre el caso de un comprobante descargado desde el home banking.
export const PAYMENT_PROOF_MIME_LABELS: Record<string, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WEBP",
  "image/heic": "HEIC",
  "application/pdf": "PDF",
};

export const PAYMENT_PROOF_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  mimeTypes: Object.keys(PAYMENT_PROOF_MIME_LABELS),
};
