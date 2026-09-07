"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LeadForm } from "@/components/landing/lead-form";
import { SitePreviewMockup } from "@/components/landing-ads/site-preview-mockup";
import { trackEvent } from "@/lib/analytics";
import type { Business, Service } from "@/lib/types";

interface LandingAdsHeroProps {
  business: Business;
  services: Service[];
  slug: string;
}

// Sección 1 del pedido: mensaje directo, sin nada que explicar de más — quien
// llega acá viene de un Reel de 10 segundos, tiene que entender el valor en
// el mismo vistazo. Los dos CTA (primario "Probá Nexo" → registro directo,
// secundario "Quiero conocer Nexo" → el mismo LeadForm que ya usa la landing
// principal, sección "objetivo 3: solicitudes de demo/contacto") están acá,
// no repetidos en cada sección.
export function LandingAdsHero({ business, services, slug }: LandingAdsHeroProps) {
  const [leadDialogOpen, setLeadDialogOpen] = React.useState(false);
  const [leadResult, setLeadResult] = React.useState<{ wantsMeeting: boolean } | null>(null);

  function handleLeadDialogChange(next: boolean) {
    setLeadDialogOpen(next);
    if (next) setLeadResult(null);
  }

  return (
    <section className="relative overflow-hidden px-4 pt-14 pb-16 sm:px-6 sm:pt-20 sm:pb-24 lg:px-8">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent"
        aria-hidden
      />

      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl md:text-6xl"
        >
          Tu negocio, online y funcionando.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08 }}
          className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg"
        >
          Creá tu propio sitio, mostrale tus servicios a tus clientes y gestioná todo desde un solo
          lugar.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.16 }}
          className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Button
            size="lg"
            className="h-12 px-7 text-base"
            render={<Link href="/registro" />}
            nativeButton={false}
            onClick={() => trackEvent("click_cta_hero", { placement: "hero_primary" })}
          >
            Probá Nexo
            <ArrowRight className="ml-1 size-4" data-icon="inline-end" />
          </Button>

          <Dialog open={leadDialogOpen} onOpenChange={handleLeadDialogChange}>
            <DialogTrigger
              render={
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 px-7 text-base"
                  onClick={() => trackEvent("click_cta_hero", { placement: "hero_secondary" })}
                >
                  Quiero conocer Nexo
                </Button>
              }
            />
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
              {leadResult ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <CheckCircle2 className="size-10 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-lg font-semibold text-foreground">¡Gracias! Recibimos tu información.</h3>
                  <p className="text-sm text-muted-foreground">Vamos a revisar tu caso y nos pondremos en contacto.</p>
                  <Button variant="outline" className="mt-2" onClick={() => setLeadDialogOpen(false)}>
                    Cerrar
                  </Button>
                </div>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Contanos sobre tu negocio</DialogTitle>
                  </DialogHeader>
                  <LeadForm
                    onSuccess={(wantsMeeting) => {
                      trackEvent("lead_form_submitted", { wantsMeeting, source: "negocio-online" });
                      setLeadResult({ wantsMeeting });
                    }}
                  />
                </>
              )}
            </DialogContent>
          </Dialog>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.3 }}
        className="mx-auto mt-14 max-w-xl"
      >
        <SitePreviewMockup business={business} services={services} slug={slug} variant="compact" />
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Sitio real de {business.name}, hecho con Nexo.
        </p>
      </motion.div>
    </section>
  );
}
