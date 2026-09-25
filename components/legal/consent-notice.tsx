import Link from "next/link";

// Aviso informativo de consentimiento (sin casilla ni columna en base: no se
// guarda la aceptación). "account": quien se registra o pide una evaluación.
// "customer": cliente final que deja sus datos en el sitio público de un
// negocio — ahí los datos van al negocio, y Nexo los procesa por su cuenta.
export function ConsentNotice({ variant, className }: { variant: "account" | "customer"; className?: string }) {
  const links = (
    <>
      <Link href="/terminos" target="_blank" className="underline underline-offset-2 hover:text-foreground">
        Términos y condiciones
      </Link>{" "}
      y la{" "}
      <Link href="/privacidad" target="_blank" className="underline underline-offset-2 hover:text-foreground">
        Política de privacidad
      </Link>
    </>
  );

  return (
    <p className={`text-xs leading-relaxed text-muted-foreground ${className ?? ""}`}>
      {variant === "account" ? (
        <>Al continuar aceptás los {links} de Nexo.</>
      ) : (
        <>
          Tus datos se envían a este negocio para responderte o gestionar tu reserva. Nexo los procesa en su nombre.
          Más información en la {links}.
        </>
      )}
    </p>
  );
}
