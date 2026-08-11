// Sin dependencias de servidor a propósito (nada de Supabase/Prisma/pdf-parse):
// lo importan tanto el servidor (lib/knowledge-documents.ts,
// modules/employee/document-extract.ts) como el cliente (para validar ANTES
// de subir, ver components/ai-studio/document-uploader.tsx). Nunca confiar
// solo en la validación del cliente — el servidor siempre revalida con la
// misma fuente.
export const DOCUMENT_MIME_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "text/plain": "TXT",
};

export const DOCUMENT_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  mimeTypes: Object.keys(DOCUMENT_MIME_LABELS),
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
