// ═══ NÚCLEO GOOGLE COMPARTIDO ═══════════════════════════════════════════════
// Los archivos de lib/google/ (excepto context.ts) son una COPIA IDÉNTICA en
// nexo/ y crm/: no hay paquete compartido entre los dos repos. Cualquier
// cambio se hace en ambos. Ver docs/architecture/google-integration.md.
// ═══════════════════════════════════════════════════════════════════════════

export type GoogleFeature = "gmail" | "calendar";

export const IDENTITY_SCOPES = ["openid", "email"] as const;

// Solo lo mínimo por funcionalidad: gmail.send envía pero NO lee el buzón;
// calendar.events maneja eventos (sin acceso a la configuración de calendarios).
export const FEATURE_SCOPES: Record<GoogleFeature, string> = {
  gmail: "https://www.googleapis.com/auth/gmail.send",
  calendar: "https://www.googleapis.com/auth/calendar.events",
};

// Scopes a pedir para una funcionalidad: identidad + el scope propio. Los ya
// otorgados se conservan gracias a include_granted_scopes (ver oauth.ts).
export function scopesForFeature(feature: GoogleFeature): string[] {
  return [...IDENTITY_SCOPES, FEATURE_SCOPES[feature]];
}

export function hasFeature(grantedScopes: readonly string[], feature: GoogleFeature): boolean {
  return grantedScopes.includes(FEATURE_SCOPES[feature]);
}

export function isGoogleFeature(value: unknown): value is GoogleFeature {
  return value === "gmail" || value === "calendar";
}
