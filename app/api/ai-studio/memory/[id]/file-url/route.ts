import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { getMemoryEntryFilePath } from "@/modules/employee/memory";
import { getSignedDocumentUrl } from "@/lib/knowledge-documents";

// El bucket de documentos es privado (ver lib/knowledge-documents.ts): nunca
// se guarda ni se expone una URL pública. Este endpoint genera una signed
// URL de corta duración bajo demanda, y solo si el documento pertenece al
// negocio de la sesión — nunca confía en un path enviado por el cliente.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const filePath = await getMemoryEntryFilePath(businessId, id);
  if (!filePath) {
    return NextResponse.json({ error: "No encontramos el archivo de esta entrada." }, { status: 404 });
  }

  try {
    const url = await getSignedDocumentUrl(filePath);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("[api/ai-studio/memory/[id]/file-url] Error generando signed URL:", error);
    return NextResponse.json({ error: "No pudimos generar el link de descarga." }, { status: 500 });
  }
}
