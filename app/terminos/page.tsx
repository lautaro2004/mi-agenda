import type { Metadata } from "next";
import Link from "next/link";

import { LEGAL_CONTACT_EMAIL, LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Términos y condiciones" };

export default function TermsPage() {
  return (
    <LegalPage title="Términos y condiciones" updatedAt="24 de septiembre de 2026">
      <p>
        Estos términos regulan el uso de Nexo, un producto de Kodexa. Al crear una cuenta o usar el servicio los
        aceptás.
      </p>

      <h2>1. El servicio</h2>
      <p>
        Nexo permite a un negocio gestionar turnos, publicar un sitio, recibir consultas y atender clientes por
        WhatsApp con un asistente de inteligencia artificial que aprende de la información que el propio negocio
        carga.
      </p>

      <h2>2. Tu cuenta</h2>
      <ul>
        <li>Debés dar información veraz y mantener segura tu contraseña.</li>
        <li>Sos responsable de la actividad realizada desde tu cuenta.</li>
        <li>Debés ser mayor de edad y tener facultades para obligar al negocio que registrás.</li>
      </ul>

      <h2>3. Uso de la IA y de WhatsApp</h2>
      <ul>
        <li>
          Las respuestas de la IA son automáticas y pueden contener errores. Sos responsable de la información que le
          cargás (precios, horarios, políticas) y de supervisar las conversaciones.
        </li>
        <li>
          Sos responsable de informar a tus clientes que interactúan con un asistente virtual y de cumplir las
          políticas de WhatsApp/Meta. Nexo agrega un aviso automático al inicio de cada conversación.
        </li>
        <li>
          La conexión de WhatsApp usa un mecanismo no oficial de la plataforma; su disponibilidad puede verse
          afectada por decisiones de Meta ajenas a Nexo.
        </li>
      </ul>

      <h2>4. Datos de tus clientes</h2>
      <p>
        Sos el responsable de los datos personales de tus clientes y te comprometés a tener una base legítima para
        tratarlos. Kodexa los trata por tu cuenta y orden, según la{" "}
        <Link href="/privacidad" className="underline underline-offset-2">
          Política de privacidad
        </Link>
        .
      </p>

      <h2>5. Planes y pagos</h2>
      <p>
        Algunos planes son pagos y se cobran de forma recurrente mediante Mercado Pago. Podés cancelar cuando
        quieras; la cancelación rige desde el fin del período ya pagado. Las señas o pagos que tus clientes te hagan
        son una relación entre vos y ellos: Nexo no interviene en ese cobro.
      </p>

      <h2>6. Uso aceptable</h2>
      <p>
        No podés usar Nexo para enviar spam, actividades ilegales, contenido engañoso, ni intentar acceder a datos
        de otros negocios o vulnerar la seguridad del servicio.
      </p>

      <h2>7. Disponibilidad y responsabilidad</h2>
      <p>
        Hacemos esfuerzos razonables por mantener el servicio disponible, pero se brinda &quot;tal cual&quot;. En la
        medida permitida por la ley, Kodexa no responde por lucro cesante ni por daños indirectos, y su
        responsabilidad total se limita a lo abonado por el servicio en los últimos 3 meses.
      </p>

      <h2>8. Cambios y baja</h2>
      <p>
        Podemos actualizar estos términos y te avisaremos por un medio razonable. Podés dar de baja tu cuenta en
        cualquier momento; podemos suspenderla ante incumplimientos.
      </p>

      <h2>9. Ley aplicable y contacto</h2>
      <p>
        Rige la ley argentina. Consultas:{" "}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="underline underline-offset-2">
          {LEGAL_CONTACT_EMAIL}
        </a>
        .
      </p>
    </LegalPage>
  );
}
