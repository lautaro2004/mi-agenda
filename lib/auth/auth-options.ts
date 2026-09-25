import type { BetterAuthOptions } from "better-auth";

import { sendPlatformEmail } from "@/modules/email/send";
import { passwordResetEmail, verificationEmail } from "@/modules/email/templates";

// Vigencia de los tokens. Better Auth los guarda en la tabla `verification`
// (reset) o los firma (verificación de email); el reset se borra al usarse, así
// que es de UN solo uso, y vence solo a los RESET_TOKEN_TTL_SECONDS.
export const RESET_TOKEN_TTL_SECONDS = 60 * 60;
export const VERIFICATION_TOKEN_TTL_SECONDS = 60 * 60 * 24;

// Emails PROPIOS de la plataforma → sendPlatformEmail (Resend / Kodexa). Nunca
// sendBusinessEmail: no son comunicaciones en nombre de ningún negocio.
//
// Se espera el envío (en serverless un fetch sin await puede cortarse al
// devolver la respuesta). Un fallo de Resend se loguea SIN url ni token y no
// rompe el flujo: la respuesta del endpoint no debe revelar si el email
// existe ni cambiar según el resultado del envío.
async function deliver(label: string, message: Parameters<typeof sendPlatformEmail>[0]) {
  try {
    const result = await sendPlatformEmail(message);
    if (!result.ok) console.error(`[auth-email] Falló el envío de ${label}:`, result.error);
  } catch (error) {
    console.error(`[auth-email] Error enviando ${label}:`, error instanceof Error ? error.message : "desconocido");
  }
}

// Opciones de Better Auth SIN la base de datos: las comparten lib/auth/auth.ts
// (Prisma) y los tests (adaptador en memoria), para probar la configuración
// real y no una copia.
export function createAuthOptions(): BetterAuthOptions {
  return {
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    emailAndPassword: {
      enabled: true,
      // No se exige verificar el email para iniciar sesión: hay cuentas
      // existentes sin verificar que quedarían bloqueadas. La verificación se
      // muestra como aviso en el dashboard (ver VerifyEmailBanner).
      resetPasswordTokenExpiresIn: RESET_TOKEN_TTL_SECONDS,
      // Cambiar la contraseña cierra las demás sesiones abiertas (si alguien
      // más tenía acceso, deja de tenerlo).
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        const email = passwordResetEmail({
          name: user.name,
          url,
          expiresInMinutes: RESET_TOKEN_TTL_SECONDS / 60,
        });
        await deliver("recuperación de contraseña", { to: user.email, ...email });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: VERIFICATION_TOKEN_TTL_SECONDS,
      sendVerificationEmail: async ({ user, url }) => {
        const email = verificationEmail({ name: user.name, url });
        await deliver("verificación de cuenta", { to: user.email, ...email });
      },
    },
    advanced: {
      database: {
        generateId: false,
      },
    },
  };
}
