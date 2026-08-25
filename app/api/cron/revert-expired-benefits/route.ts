import { NextResponse } from "next/server";

import { revertExpiredBenefits } from "@/modules/billing/subscription";

// Mismo mecanismo que cleanup-payment-proofs/cleanup-site-assets: protegido
// con CRON_SECRET, pensado para que lo invoque un scheduler externo
// periódicamente (ej. cada hora). Vuelve al plan anterior cualquier
// Subscription cuya bonificación (otorgada a mano desde
// /superadmin/empresas o vía PromoCode) ya venció.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET no configurado." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const result = await revertExpiredBenefits();
  return NextResponse.json(result);
}
