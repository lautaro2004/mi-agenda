import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { DOCUMENT_LIMITS } from "@/lib/document-limits";

export { DOCUMENT_LIMITS };

// A diferencia de "site-assets" (logo/hero, pensados para mostrarse en el
// sitio público), estos son documentos internos del negocio — el bucket es
// PRIVADO. Nunca se guarda una URL pública: solo el path, y para que el
// dueño pueda ver/descargar el original se genera una signed URL de corta
// duración bajo demanda (ver getSignedDocumentUrl).
export const KNOWLEDGE_DOCUMENTS_BUCKET = "knowledge-documents";

const EXTENSION_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
};

// Aislamiento lógico por negocio vía el prefijo del path — mismo criterio
// que site-assets (knowledge-documents/{businessId}/{uuid}.ext).
export function buildDocumentPath(businessId: string, mimeType: string): string {
  const ext = EXTENSION_BY_MIME[mimeType] ?? "bin";
  return `${businessId}/${crypto.randomUUID()}.${ext}`;
}

export async function uploadDocument(path: string, bytes: Buffer, mimeType: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .storage.from(KNOWLEDGE_DOCUMENTS_BUCKET)
    .upload(path, bytes, { contentType: mimeType, upsert: false });
  if (error) throw new Error(`No pudimos subir el archivo: ${error.message}`);
}

// Sin try/catch a propósito, igual que lib/site-assets.ts: el caller decide
// si un fallo de borrado es fatal (nunca lo es acá — ver DELETE en
// app/api/ai-studio/memory/[id]/route.ts, el archivo queda huérfano en vez
// de bloquear el borrado de la entrada de memoria).
export async function deleteDocument(path: string): Promise<void> {
  const { error } = await getSupabaseAdmin().storage.from(KNOWLEDGE_DOCUMENTS_BUCKET).remove([path]);
  if (error) throw new Error(error.message);
}

// Corta duración (60s por defecto): se genera recién cuando el dueño hace
// click en "Ver archivo", nunca se guarda en la base ni se cachea.
export async function getSignedDocumentUrl(path: string, expiresInSeconds = 60): Promise<string> {
  const { data, error } = await getSupabaseAdmin()
    .storage.from(KNOWLEDGE_DOCUMENTS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) throw new Error(error?.message ?? "No pudimos generar el link de descarga.");
  return data.signedUrl;
}

let bucketReady = false;

export async function ensureDocumentsBucketExists(): Promise<void> {
  if (bucketReady) return;

  const admin = getSupabaseAdmin();
  const { data } = await admin.storage.getBucket(KNOWLEDGE_DOCUMENTS_BUCKET);
  if (!data) {
    const { error: createError } = await admin.storage.createBucket(KNOWLEDGE_DOCUMENTS_BUCKET, {
      public: false,
      fileSizeLimit: DOCUMENT_LIMITS.maxBytes,
      allowedMimeTypes: DOCUMENT_LIMITS.mimeTypes,
    });
    if (createError && !/already exists/i.test(createError.message)) {
      throw new Error(`No pudimos preparar el almacenamiento de documentos: ${createError.message}`);
    }
  }

  bucketReady = true;
}
