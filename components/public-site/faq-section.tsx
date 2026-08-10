import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { FAQ } from "@/lib/types";

export function FaqSection({ faqs }: { faqs: FAQ[] }) {
  if (faqs.length === 0) return null;

  return (
    <section id="faq" className="mx-auto max-w-2xl px-4 py-14 sm:px-6 sm:py-16">
      <div className="text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Preguntas frecuentes</h2>
      </div>

      <div className="mt-7 rounded-2xl border border-border bg-card px-5 sm:px-6">
        <Accordion>
          {faqs.map((faq) => (
            <AccordionItem key={faq.id} value={faq.id}>
              <AccordionTrigger className="cursor-pointer py-3.5 text-sm font-semibold text-foreground hover:no-underline">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
