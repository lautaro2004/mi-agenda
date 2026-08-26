import { MercadoPagoError } from "mercadopago";

// ── Traducción de errores del SDK de Mercado Pago ────────────────────────
// Único lugar que sabe leer un error real devuelto por el SDK oficial
// (status/error/causes — ver node_modules/mercadopago/dist/utils/errors)
// y separarlo en dos mitades con destinos distintos:
//   - lo que se loguea en el servidor: todo lo útil para depurar un rechazo
//     real de Mercado Pago (status HTTP, slug de error, causes, mensaje).
//   - lo que se le devuelve al frontend: un mensaje humano + un detail
//     entendible (derivado de las causes cuando existen), nunca el cuerpo
//     crudo de la respuesta de Mercado Pago.
//
// El SDK ya garantiza (ver el comentario CWE-209 en utils/errors/index.d.ts)
// que el Authorization header nunca queda en el error — este archivo NUNCA
// además loguea ni devuelve MERCADOPAGO_ACCESS_TOKEN, MERCADOPAGO_WEBHOOK_SECRET
// ni datos de tarjeta (acá ni siquiera se reciben: solo status/error/causes
// de la respuesta de Mercado Pago).

export interface MercadoPagoCause {
  code?: string | number;
  description?: string;
}

export interface MercadoPagoErrorInfo {
  // Solo para el log de servidor — nunca se manda tal cual al frontend.
  httpStatus: number | null;
  mpErrorSlug: string | null;
  causes: MercadoPagoCause[];
  rawMessage: string;
  // Seguros para mostrar al usuario.
  detail: string;
  technicalCode: string | null;
}

function extractCauses(causes: unknown[]): MercadoPagoCause[] {
  return causes
    .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
    .map((c) => ({
      code: typeof c.code === "string" || typeof c.code === "number" ? c.code : undefined,
      description: typeof c.description === "string" ? c.description : undefined,
    }));
}

// Códigos de rechazo de tarjeta documentados por Mercado Pago para pruebas
// en sandbox (tarjetas de prueba). Best-effort: si Mercado Pago devuelve un
// code que no está en esta lista, se usa la description que manda MP (ya
// pensada para mostrarse) o un mensaje genérico — nunca se inventa un
// significado para un código desconocido.
const KNOWN_REJECTION_MESSAGES: Record<string, string> = {
  cc_rejected_bad_filled_card_number: "Revisá el número de la tarjeta.",
  cc_rejected_bad_filled_date: "Revisá la fecha de vencimiento.",
  cc_rejected_bad_filled_other: "Revisá los datos de la tarjeta.",
  cc_rejected_bad_filled_security_code: "Revisá el código de seguridad de la tarjeta.",
  cc_rejected_blacklist: "No pudimos procesar el pago con esa tarjeta.",
  cc_rejected_call_for_authorize: "Tu banco requiere que autorices el pago antes de reintentar.",
  cc_rejected_card_disabled: "La tarjeta está deshabilitada — llamá a tu banco para activarla.",
  cc_rejected_card_error: "No pudimos procesar el pago con esa tarjeta.",
  cc_rejected_duplicated_payment: "Ya se registró un pago con esos mismos datos.",
  cc_rejected_high_risk: "El pago fue rechazado por Mercado Pago.",
  cc_rejected_insufficient_amount: "La tarjeta no tiene fondos suficientes.",
  cc_rejected_invalid_installments: "Esa tarjeta no admite la cantidad de cuotas elegida.",
  cc_rejected_max_attempts: "Se alcanzó el límite de intentos permitidos.",
  cc_rejected_other_reason: "El medio de pago fue rechazado.",
};

function describeCauses(causes: MercadoPagoCause[]): { detail: string | null; technicalCode: string | null } {
  const withCode = causes.find((c) => c.code !== undefined);
  if (!withCode) return { detail: null, technicalCode: null };

  const technicalCode = String(withCode.code);
  const detail = KNOWN_REJECTION_MESSAGES[technicalCode] ?? withCode.description ?? null;
  return { detail, technicalCode };
}

export function describeMercadoPagoError(error: unknown): MercadoPagoErrorInfo {
  if (error instanceof MercadoPagoError) {
    const causes = extractCauses(error.causes);
    const { detail, technicalCode } = describeCauses(causes);
    const httpStatus = error.status || null;
    return {
      httpStatus,
      mpErrorSlug: error.error || null,
      causes,
      rawMessage: error.message,
      detail: detail ?? "Mercado Pago rechazó la operación.",
      // Sin cause y sin slug de error (ej. un body de la forma {message,
      // status} sin más estructura — visto en la práctica contra
      // /preapproval), el status HTTP sigue siendo un dato técnico útil y
      // no sensible para mostrar en vez de no mostrar ningún código.
      technicalCode: technicalCode ?? (error.error || null) ?? (httpStatus ? String(httpStatus) : null),
    };
  }

  return {
    httpStatus: null,
    mpErrorSlug: null,
    causes: [],
    rawMessage: error instanceof Error ? error.message : "Error desconocido.",
    detail: "No pudimos completar la operación con Mercado Pago.",
    technicalCode: null,
  };
}
