import { NextResponse } from "next/server";
import QRCode from "qrcode";

import { getCurrentBusinessId } from "@/modules/business/current";
import { prisma } from "@/lib/prisma";

// El QR apunta SIEMPRE a la página pública de la carta (/s/[slug]/carta),
// nunca al PDF directo (sección 5 de la tarea) — así reemplazar el PDF
// nunca invalida un QR ya impreso. Se genera al vuelo (mismo paquete que ya
// usa modules/whatsapp/connection/manager.ts para el QR de vinculación,
// QRCode.toDataURL) — no se persiste nada en Postgres ni en Storage.
export async function GET(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { slug: true, menuEnabled: true, menuPdfUrl: true },
  });

  if (!business?.slug) {
    return NextResponse.json({ error: "Tu sitio todavía no tiene una URL pública generada." }, { status: 409 });
  }
  if (!business.menuEnabled || !business.menuPdfUrl) {
    return NextResponse.json({ error: "Activá la carta y subí un PDF antes de generar el QR." }, { status: 409 });
  }

  // new URL(request.url).origin ya refleja el host público real (Next.js lo
  // resuelve a partir de los headers del request), sin necesitar una env var
  // nueva ni asumir un dominio fijo.
  const origin = new URL(request.url).origin;
  const menuUrl = `${origin}/s/${business.slug}/carta`;

  try {
    const [pngDataUrl, svg] = await Promise.all([
      QRCode.toDataURL(menuUrl, { margin: 1, width: 480 }),
      QRCode.toString(menuUrl, { type: "svg", margin: 1 }),
    ]);
    return NextResponse.json({ url: menuUrl, pngDataUrl, svg });
  } catch (error) {
    console.error("[api/business/menu/qr] Error generando QR:", error);
    return NextResponse.json({ error: "No pudimos generar el QR." }, { status: 500 });
  }
}
