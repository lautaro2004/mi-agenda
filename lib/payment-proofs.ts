import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { PAYMENT_PROOF_LIMITS } from "@/lib/payment-proof-limits";

export { PAYMENT_PROOF_LIMITS };

// Bucket PRIVADO y separado de "site-assets" (público, logos/hero) y de
// "knowledge-documents" (privado, pero documentos de entrenamiento de la
// IA) — un comprobante de pago es información sensible del cliente y nunca
// debe mezclarse con esos otros dos espacios (ver sección 3/15 de la
// tarea). Nunca se guarda una URL pública ni el binario en Postgres: solo el
// path, y el dueño ve el archivo vía signed URL de corta duración generada
// bajo demanda (ver getSignedProofUrl).
export const PAYMENT_PROOFS_BUCKET = "payment-proofs";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

// {businessId}/{appointmentId}/{uuid}.ext — aislamiento lógico por negocio Y
// por turno, mismo criterio que site-assets/knowledge-documents. Cuando
// todavía no sabemos a qué turno corresponde (más de un turno pendiente de
// pago para el mismo teléfono, ver modules/payments/service.ts), se usa
// "_unassigned" como carpeta intermedia hasta que se resuelve el vínculo.
export function buildPaymentProofPath(businessId: string, appointmentId: string | null, mimeType: string): string {
  const ext = EXTENSION_BY_MIME[mimeType] ?? "bin";
  return `${businessId}/${appointmentId ?? "_unassigned"}/${crypto.randomUUID()}.${ext}`;
}

export async function uploadPaymentProof(path: string, bytes: Buffer, mimeType: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .storage.from(PAYMENT_PROOFS_BUCKET)
    .upload(path, bytes, { contentType: mimeType, upsert: false });
  if (error) throw new Error(`No pudimos subir el comprobante: ${error.message}`);
}

// Sin try/catch a propósito, mismo criterio que site-assets/knowledge-documents:
// el caller decide si un fallo de borrado es fatal (nunca lo es en el barrido
// de huérfanos — ver modules/payments/cleanup.ts).
export async function deletePaymentProof(path: string): Promise<void> {
  const { error } = await getSupabaseAdmin().storage.from(PAYMENT_PROOFS_BUCKET).remove([path]);
  if (error) throw new Error(error.message);
}

// Corta duración: se genera recién cuando el dueño abre el detalle del
// turno en el dashboard, nunca se guarda ni se cachea (ver sección 3/11 de
// la tarea — nunca exponer la URL del archivo públicamente).
export async function getSignedProofUrl(path: string, expiresInSeconds = 120): Promise<string> {
  const { data, error } = await getSupabaseAdmin()
    .storage.from(PAYMENT_PROOFS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) throw new Error(error?.message ?? "No pudimos generar el link del comprobante.");
  return data.signedUrl;
}

export interface PaymentProofObject {
  name: string;
  createdAt: string | null;
}

export async function listPaymentProofsAt(prefix: string): Promise<PaymentProofObject[]> {
  const { data, error } = await getSupabaseAdmin().storage.from(PAYMENT_PROOFS_BUCKET).list(prefix);
  if (error || !data) return [];
  return data.map((object) => ({ name: object.name, createdAt: object.created_at ?? null }));
}

let bucketReady = false;

export async function ensurePaymentProofsBucketExists(): Promise<void> {
  if (bucketReady) return;

  const admin = getSupabaseAdmin();
  const { data } = await admin.storage.getBucket(PAYMENT_PROOFS_BUCKET);
  if (!data) {
    const { error: createError } = await admin.storage.createBucket(PAYMENT_PROOFS_BUCKET, {
      public: false,
      fileSizeLimit: PAYMENT_PROOF_LIMITS.maxBytes,
      allowedMimeTypes: PAYMENT_PROOF_LIMITS.mimeTypes,
    });
    if (createError && !/already exists/i.test(createError.message)) {
      throw new Error(`No pudimos preparar el almacenamiento de comprobantes: ${createError.message}`);
    }
  }

  bucketReady = true;
}
