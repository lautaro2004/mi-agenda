import pdfParse from "pdf-parse";
import mammoth from "mammoth";

// Sin RAG/embeddings a propósito (decisión explícita del alcance de esta
// feature): el texto extraído se guarda tal cual como el "content" de una
// MemoryEntry y viaja completo en cada prompt del empleado (ver
// buildBusinessContext → summarizeContext). Un límite es indispensable para
// no inflar el contexto (costo y calidad de respuesta) con un documento
// largo — no es una limitación de pdf-parse/mammoth, es una decisión de
// producto: documentos muy largos quedan truncados, con aviso explícito.
const MAX_EXTRACTED_CHARS = 8000;
const TRUNCATION_NOTICE =
  "\n\n[Documento truncado — se guardaron los primeros caracteres para no sobrecargar el contexto del empleado.]";

export interface ExtractResult {
  text: string;
  error: string | null;
}

async function extractRaw(mimeType: string, bytes: Buffer): Promise<string> {
  switch (mimeType) {
    case "application/pdf": {
      const data = await pdfParse(bytes);
      return data.text;
    }
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      const result = await mammoth.extractRawText({ buffer: bytes });
      return result.value;
    }
    case "text/plain":
      return bytes.toString("utf-8");
    default:
      throw new Error("Formato no soportado para extracción de texto.");
  }
}

// Nunca lanza: el caller (modules/employee/memory.ts vía el endpoint de
// upload) necesita poder guardar la entrada igual con processingStatus
// "error" — el archivo original ya está subido a Storage en ese punto, no
// tiene sentido perder la referencia solo porque la extracción falló.
export async function extractDocumentText(mimeType: string, bytes: Buffer): Promise<ExtractResult> {
  try {
    const raw = await extractRaw(mimeType, bytes);
    const trimmed = raw.trim();

    if (!trimmed) {
      return { text: "", error: "No pudimos extraer texto de este documento (¿está escaneado como imagen?)." };
    }

    const text =
      trimmed.length > MAX_EXTRACTED_CHARS ? trimmed.slice(0, MAX_EXTRACTED_CHARS) + TRUNCATION_NOTICE : trimmed;
    return { text, error: null };
  } catch (error) {
    console.error("[document-extract] Error extrayendo texto:", error);
    return { text: "", error: "No pudimos leer el contenido de este archivo." };
  }
}
