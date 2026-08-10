"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

const CONVERSATION = [
  { role: "owner" as const, text: "Somos una agencia de desarrollo web. Hacemos soluciones a medida." },
  {
    role: "ai" as const,
    text: "Entendido, ofrecen desarrollo web a medida. ¿Cuáles son sus servicios principales?",
  },
  { role: "owner" as const, text: "Landing Pages desde USD 250, sitios institucionales desde USD 500…" },
  { role: "ai" as const, text: "Perfecto. Guardo estos servicios con sus precios y seguimos con el resto." },
];

const RESULTS = [
  "Servicios creados",
  "Precios configurados",
  "FAQs guardadas",
  "Reglas configuradas",
  "Plan actualizado",
];

export function LandingTeachNotConfigure() {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-primary">El diferencial</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
              No configures un bot.
              <br />
              Enseñale tu negocio.
            </h2>
            <p className="mt-5 text-muted-foreground">
              Contale qué hacés, qué servicios ofrecés, cuánto cobrás y cómo trabajás. Mi Agenda
              organiza esa información y la convierte en la configuración real de tu asistente —
              sin que tengas que llenar un solo formulario.
            </p>

            <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-3">
              {RESULTS.map((item, index) => (
                <motion.li
                  key={item}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.4, delay: index * 0.06 }}
                  className="flex items-center gap-2 text-sm text-foreground"
                >
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  {item}
                </motion.li>
              ))}
            </ul>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-primary/5"
          >
            <div className="border-b border-border bg-muted/40 px-5 py-3">
              <p className="text-xs font-medium text-muted-foreground">Entrená a tu asistente</p>
            </div>
            <div className="flex flex-col gap-3 p-5">
              {CONVERSATION.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "owner" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                      msg.role === "owner"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
