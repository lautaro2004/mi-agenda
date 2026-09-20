import { InquiryForm } from "@/components/public-site/inquiry-form";

export function BookingInquirySection({ slug }: { slug: string }) {
  return (
    <section id="consultas" className="px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-xl">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground">¿Tenés una consulta?</h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Dejanos tu mensaje y nos ponemos en contacto.
        </p>
        <div className="mt-6">
          <InquiryForm slug={slug} />
        </div>
      </div>
    </section>
  );
}
