import os from "node:os";
import path from "node:path";

/**
 * Carpeta donde Baileys guarda las credenciales de cada negocio.
 *
 * - WHATSAPP_SESSIONS_DIR tiene prioridad (apuntala a un volumen persistente).
 * - En serverless (Netlify/Vercel/Lambda) el filesystem del código es de solo
 *   lectura (/var/task): solo /tmp es escribible, y es efímero. Allí la sesión
 *   puede perderse al reciclarse la instancia; para uso real hace falta un
 *   servidor persistente o un store en base de datos.
 */
export function getSessionsDir(): string {
  const fromEnv = process.env.WHATSAPP_SESSIONS_DIR?.trim();
  if (fromEnv) return fromEnv;
  const serverless = Boolean(
    process.env.NETLIFY || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT,
  );
  if (serverless) return path.join(os.tmpdir(), ".whatsapp-sessions");
  return path.join(process.cwd(), ".whatsapp-sessions");
}
