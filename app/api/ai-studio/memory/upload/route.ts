import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { createDocumentMemoryEntry } from "@/modules/employee/memory";
import { extractDocumentText } from "@/modules/employee/document-extract";
import {
  DOCUMENT_LIMITS,
  buildDocumentPath,
  ensureDocumentsBucketExists,
  uploadDocument,
} from "@/lib/knowledge-documents";

// businessId sale SIEMPRE de la sesión, nunca del cliente (mismo criterio
// que /api/business/assets/[kind] para logo/hero). El documento se sube a
// Storage ANTES de crear la MemoryEntry: si algo falla después (ej. la
// extracción de texto), igual queda la entrada con el archivo adjunto y
// processingStatus "error", nunca se pierde el upload.
export async function POST(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "No pudimos leer el archivo enviado." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });
  }

  if (!DOCUMENT_LIMITS.mimeTypes.includes(file.type)) {
    return NextResponse.json({ error: "Formato no permitido. Usá PDF, DOCX o TXT." }, { status: 400 });
  }
  if (file.size > DOCUMENT_LIMITS.maxBytes) {
    return NextResponse.json(
      { error: `El archivo supera el máximo de ${Math.round(DOCUMENT_LIMITS.maxBytes / (1024 * 1024))} MB.` },
      { status: 400 }
    );
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());

    await ensureDocumentsBucketExists();
    const path = buildDocumentPath(businessId, file.type);
    await uploadDocument(path, bytes, file.type);

    const { text, error } = await extractDocumentText(file.type, bytes);

    const entry = await createDocumentMemoryEntry(businessId, {
      title: file.name,
      content: text,
      filePath: path,
      fileName: file.name,
      mimeType: file.type,
      fileSizeBytes: file.size,
      processingStatus: error ? "error" : "ready",
      processingError: error,
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error("[api/ai-studio/memory/upload] Error al procesar el documento:", error);
    return NextResponse.json({ error: "No pudimos subir el documento. Intentá de nuevo." }, { status: 500 });
  }
}
