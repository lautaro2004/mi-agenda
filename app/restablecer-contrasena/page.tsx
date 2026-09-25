import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

// El token viaja en la URL: sin indexar y sin referrer hacia otros sitios.
export const metadata: Metadata = {
  title: "Nueva contraseña",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  return (
    <AuthShell>
      <ResetPasswordForm token={token ?? null} hasError={!!error} />
    </AuthShell>
  );
}
