import type { Metadata } from "next";

import { LEGAL_CONTACT_EMAIL, LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Política de privacidad" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de privacidad" updatedAt="24 de septiembre de 2026">
      <p>
        Nexo es un producto de Kodexa (&quot;nosotros&quot;). Esta política explica qué datos personales tratamos,
        para qué y qué derechos tenés. Nos regimos por la Ley 25.326 de Protección de Datos Personales de la
        República Argentina.
      </p>

      <h2>1. Quién es responsable de qué</h2>
      <ul>
        <li>
          <strong>Dueños de negocios (usuarios de Nexo):</strong> Kodexa es responsable de los datos de tu cuenta y de
          tu negocio.
        </li>
        <li>
          <strong>Clientes de un negocio:</strong> cuando le escribís a un negocio por WhatsApp, reservás un turno o
          dejás una consulta en su sitio, el responsable de esos datos es ese negocio. Kodexa los trata por cuenta y
          orden del negocio, únicamente para prestarle el servicio.
        </li>
      </ul>

      <h2>2. Datos que tratamos</h2>
      <ul>
        <li>Cuenta: nombre, email y contraseña (guardada de forma cifrada).</li>
        <li>Negocio: nombre, servicios, horarios, datos de contacto y de cobro que el dueño decida cargar.</li>
        <li>Clientes del negocio: nombre, teléfono, email, mensajes, turnos y comprobantes de pago.</li>
        <li>Consultas comerciales: los datos del formulario de evaluación de la landing.</li>
        <li>Técnicos: dirección IP y navegador (por seguridad y prevención de abuso).</li>
      </ul>

      <h2>3. Para qué los usamos</h2>
      <ul>
        <li>Prestar el servicio: agenda, respuestas automáticas, reservas, notificaciones y cobros.</li>
        <li>Seguridad, prevención de fraude y abuso.</li>
        <li>Responder consultas comerciales sobre Nexo.</li>
        <li>Cumplir obligaciones legales.</li>
      </ul>

      <h2>4. Uso de inteligencia artificial</h2>
      <p>
        Nexo usa modelos de IA para responder mensajes de clientes en nombre del negocio. Los mensajes y el
        contexto necesario del negocio se envían a nuestro proveedor de IA (Google Gemini) para generar la
        respuesta. Al inicio de cada conversación de WhatsApp se informa que quien responde es un asistente virtual,
        y la persona puede pedir hablar con un humano en cualquier momento. La IA puede equivocarse: los negocios
        son responsables de revisar lo que configuran.
      </p>

      <h2>5. Con quién compartimos datos</h2>
      <p>Solo con proveedores necesarios para operar, que actúan bajo nuestras instrucciones:</p>
      <ul>
        <li>Supabase (base de datos y almacenamiento de archivos).</li>
        <li>Google (Gemini, para respuestas con IA).</li>
        <li>Mercado Pago (cobro de suscripciones).</li>
        <li>Meta / WhatsApp (mensajería).</li>
        <li>Proveedores de hosting.</li>
      </ul>
      <p>
        Algunos están fuera de Argentina, por lo que los datos pueden transferirse internacionalmente con las
        garantías que exige la ley. No vendemos datos personales.
      </p>

      <h2>6. Cuánto tiempo los conservamos</h2>
      <p>
        Mientras la cuenta esté activa o sea necesario para prestar el servicio. Al cerrar una cuenta, eliminamos o
        anonimizamos los datos, salvo los que debamos conservar por obligación legal.
      </p>

      <h2>7. Tus derechos</h2>
      <p>
        Podés acceder, rectificar, actualizar y suprimir tus datos. Si sos cliente de un negocio, escribile primero
        al negocio; también podés escribirnos a{" "}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="underline underline-offset-2">
          {LEGAL_CONTACT_EMAIL}
        </a>{" "}
        y te ayudamos a canalizar el pedido. La Agencia de Acceso a la Información Pública (AAIP) es el órgano de
        control de la Ley 25.326 y atiende denuncias y reclamos.
      </p>

      <h2>8. Seguridad</h2>
      <p>
        Aplicamos medidas técnicas y organizativas razonables (cifrado en tránsito, control de acceso por negocio,
        almacenamiento privado de comprobantes). Ningún sistema es infalible; si ocurre un incidente que te afecte,
        te lo informaremos según corresponda.
      </p>

      <h2>9. Cambios</h2>
      <p>Si actualizamos esta política, publicaremos la nueva versión acá con su fecha.</p>
    </LegalPage>
  );
}
