"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { requestJson } from "@/lib/api-client";

interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  status: "active" | "revoked" | null;
  googleEmail: string | null;
  features: { gmail: boolean; calendar: boolean };
}

const RESULT_MESSAGES: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "Gmail conectado." },
  cancelled: { ok: false, text: "No se otorgó el permiso, así que no se conectó nada." },
  account_mismatch: { ok: false, text: "Usá la misma cuenta de Google con la que te conectaste antes, o desconectala primero." },
  no_refresh_token: { ok: false, text: "Google no entregó el acceso permanente. Probá conectar de nuevo." },
  invalid_state: { ok: false, text: "La solicitud de conexión venció. Probá de nuevo." },
  wrong_user: { ok: false, text: "La sesión cambió durante la conexión. Probá de nuevo." },
  exchange_failed: { ok: false, text: "No pudimos completar la conexión con Google. Probá de nuevo." },
};

// Conexión Google del negocio (Gmail para emails a clientes). La conexión es
// del usuario que inicia sesión: se guarda cifrada en el servidor y esta
// pantalla solo ve el estado, nunca tokens.
export function GoogleIntegrationCard() {
  const [status, setStatus] = React.useState<GoogleStatus | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(() => {
    requestJson<GoogleStatus>("/api/integrations/google/status")
      .then(setStatus)
      .catch(() => toast.error("No pudimos cargar la conexión con Google."));
  }, []);

  React.useEffect(() => {
    load();
    // Resultado del regreso desde Google (?google=connected|cancelled|...).
    const params = new URLSearchParams(window.location.search);
    const result = params.get("google");
    if (result) {
      const message = RESULT_MESSAGES[result];
      if (message) (message.ok ? toast.success : toast.error)(message.text);
      params.delete("google");
      const query = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : ""));
    }
  }, [load]);

  async function connect() {
    setBusy(true);
    try {
      const data = await requestJson<{ url?: string; alreadyGranted?: boolean }>("/api/integrations/google/connect", {
        method: "POST",
        body: JSON.stringify({ feature: "gmail", returnTo: "/dashboard/negocio" }),
      });
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos iniciar la conexión.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await requestJson("/api/integrations/google/disconnect", { method: "POST" });
      toast.success("Google desconectado. Los emails vuelven a salir por Nexo.");
      load();
    } catch {
      toast.error("No pudimos desconectar Google.");
    } finally {
      setBusy(false);
    }
  }

  if (!status) return <div className="h-32 animate-pulse rounded-2xl border border-border bg-card" />;

  const gmailOn = status.features.gmail;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Gmail para emails a tus clientes</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Conectá tu cuenta de Google y las confirmaciones y recordatorios salen desde tu propio Gmail. Sin conexión,
            salen desde Nexo con el nombre de tu negocio y tus clientes te responden a tu email.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            gmailOn ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"
          }`}
        >
          {gmailOn ? "Conectado" : status.status === "revoked" ? "Reconectar" : "No conectado"}
        </span>
      </div>

      {gmailOn && status.googleEmail && (
        <p className="mt-3 text-sm text-foreground">
          Enviando desde <strong>{status.googleEmail}</strong>
        </p>
      )}
      {status.status === "revoked" && (
        <p className="mt-3 text-sm text-amber-600">Google revocó el acceso. Volvé a conectar para seguir usando tu Gmail.</p>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Permiso que se solicita: <strong>enviar emails en tu nombre</strong>. Nexo no puede leer tu bandeja de entrada ni
        tus contactos.
      </p>

      {!status.configured && (
        <p className="mt-3 text-sm text-muted-foreground">La conexión con Google todavía no está habilitada en este entorno.</p>
      )}

      <div className="mt-4 flex justify-end gap-2">
        {status.connected && (
          <Button variant="outline" onClick={disconnect} disabled={busy}>
            Desconectar Google
          </Button>
        )}
        {!gmailOn && (
          <Button onClick={connect} disabled={busy || !status.configured}>
            {busy && <Loader2 className="size-4 animate-spin" data-icon="inline-start" />}
            {status.status === "revoked" ? "Reconectar Gmail" : "Conectar Gmail"}
          </Button>
        )}
      </div>
    </div>
  );
}
