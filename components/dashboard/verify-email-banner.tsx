"use client";

import * as React from "react";
import { MailWarning } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/auth-client";

// Aviso para cuentas con el email sin verificar (no bloquea el uso). El enlace
// de verificación vence a las 24 h: acá se puede pedir otro.
export function VerifyEmailBanner({ email }: { email: string }) {
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function resend() {
    setSending(true);
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/dashboard" });
    setSending(false);
    if (error) {
      toast.error("No pudimos enviar el email. Intentá de nuevo en un rato.");
      return;
    }
    setSent(true);
    toast.success("Te enviamos un enlace de verificación.");
  }

  return (
    <div className="flex flex-col gap-2 border-b border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <p className="flex items-center gap-2 text-foreground">
        <MailWarning className="size-4 shrink-0 text-amber-600" />
        Confirmá tu email ({email}) para proteger tu cuenta y poder recuperar tu contraseña.
      </p>
      <Button size="sm" variant="outline" onClick={resend} disabled={sending || sent}>
        {sent ? "Enlace enviado" : "Reenviar email"}
      </Button>
    </div>
  );
}
