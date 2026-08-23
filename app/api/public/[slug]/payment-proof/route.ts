import { NextResponse } from "next/server";

import { getBusinessIdBySlug } from "@/modules/business/slug";
import { PaymentProofValidationError, submitProofForAppointment } from "@/modules/payments/service";

// Subida de comprobante desde el sitio público (ver sección 6/7 de la
// tarea) — mismo motor que el comprobante recibido por WhatsApp
// (submitProofForAppointment, modules/payments/service.ts): valida tipo/
// tamaño/archivo vacío, sube a Storage privado, y revalida que el turno sea
// realmente de ESTE negocio antes de tocar nada (nunca confía en el
// appointmentId del body sin cruzarlo con el slug). Sin sesión: el
// appointmentId (cuid, no adivinable) es el único "secreto" que tiene quien
// acaba de reservar — mismo modelo de confianza que ya usa WhatsApp, donde
// el teléfono cumple ese rol.
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const businessId = await getBusinessIdBySlug(slug);
  if (!businessId) {
    return NextResponse.json({ error: "Negocio no encontrado." }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "No pudimos leer el archivo enviado." }, { status: 400 });
  }

  const file = formData.get("file");
  const appointmentId = formData.get("appointmentId");
  if (!(file instanceof File) || typeof appointmentId !== "string" || !appointmentId) {
    return NextResponse.json({ error: "Faltan datos del comprobante." }, { status: 400 });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await submitProofForAppointment({
      businessId,
      appointmentId,
      file: { bytes, mimeType: file.type, fileName: file.name },
    });

    if ("error" in result) {
      const message =
        result.error === "not_found"
          ? "No encontramos esa reserva."
          : "Esta reserva ya no admite un comprobante nuevo.";
      return NextResponse.json({ error: message }, { status: result.error === "not_found" ? 404 : 409 });
    }

    return NextResponse.json({ appointment: result.appointment }, { status: 201 });
  } catch (error) {
    if (error instanceof PaymentProofValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[api/public/[slug]/payment-proof] Error al subir el comprobante:", error);
    return NextResponse.json({ error: "No pudimos subir el comprobante. Intentá de nuevo." }, { status: 500 });
  }
}
