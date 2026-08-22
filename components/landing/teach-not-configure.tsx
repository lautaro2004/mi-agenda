"use client";

import { motion } from "framer-motion";
import { ArrowRight, Brain, CheckCircle2, MessageCircle, Sparkles } from "lucide-react";

const CONVERSATION = [
  { role: "owner" as const, text: "Somos una agencia de desarrollo web. Hacemos soluciones a medida." },
  {
    role: "ai" as const,
    text: "Entendido, ofrecen desarrollo web a medida. ¿Cuáles son sus servicios principales?",
  },
  { role: "owner" as const, text: "Landing Pages desde USD 250, sitios institucionales desde USD 500…" },
  { role: "ai" as const, text: "Perfecto. Guardo estos servicios con sus precios y seguimos con el resto." },
];

const FLOW_STEPS = [
  { icon: MessageCircle, label: "Conversás con Nexo" },
  { icon: Brain, label: "Nexo entiende tu negocio" },
  { icon: Sparkles, label: "Tu negocio queda configurado" },
];

// Sección 4 del rediseño: el diferencial más importante del producto. El
// concepto visual pedido (usuario → conversación → conocimiento → Nexo
// configurado) se resuelve con FLOW_STEPS arriba del bloque de conversación.
export function LandingTeachNotConfigure() {
  return (
    <section id="producto" className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium text-primary">El diferencial</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            Primero entiende tu negocio.
            <br />
            Después empieza a ayudarte.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Nexo se configura conversando con vos, no llenando formularios. Contale qué hacés y él
            transforma esa charla en la configuración real de tu negocio.
          </p>
        </div>

        <div className="mx-auto mt-12 flex max-w-2xl items-center justify-center gap-3">
          {FLOW_STEPS.map((step, index) => (
            <div key={step.label} className="flex items-center gap-3">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="flex flex-col items-center gap-2 text-center"
              >
                <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-card text-primary">
                  <step.icon className="size-5" />
                </span>
                <p className="max-w-20 text-xs font-medium text-muted-foreground">{step.label}</p>
              </motion.div>
              {index < FLOW_STEPS.length - 1 && (
                <ArrowRight className="mb-6 size-4 shrink-0 text-muted-foreground/50" />
              )}
            </div>
          ))}
        </div>

        <div className="mt-14 grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-foreground">Durante la conversación, Nexo puede aprender:</p>
            <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3">
              {[
                "Qué hace tu negocio",
                "Servicios y precios",
                "Horarios de atención",
                "Preguntas frecuentes",
                "Proceso de trabajo",
                "Objetivos y restricciones",
                "Información adicional",
                "Documentos y recursos",
              ].map((item, index) => (
                <motion.li
                  key={item}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="flex items-start gap-2 text-sm text-foreground"
                >
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
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
              <p className="text-xs font-medium text-muted-foreground">Configurando con Nexo</p>
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
