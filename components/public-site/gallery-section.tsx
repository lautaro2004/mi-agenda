import type { GalleryBlock } from "@/lib/types";

interface GallerySectionProps {
  blocks: GalleryBlock[];
}

// Genérico a propósito (sección 1 de la tarea): el mismo componente sirve
// para "Nuestros platos" de un restaurante o "Nuestro espacio" de una
// peluquería — nunca asume un rubro. Solo recibe bloques ya filtrados
// (activos y con al menos una imagen, ver listActiveGalleryBlocks en
// modules/business/gallery.ts) — si no hay ninguno, la sección entera no se
// renderiza, sin dejar un espacio vacío.
export function GallerySection({ blocks }: GallerySectionProps) {
  if (blocks.length === 0) return null;

  return (
    <section id="galeria" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="space-y-14">
        {blocks.map((block) => (
          <div key={block.id}>
            {(block.title || block.description) && (
              <div className="mx-auto max-w-xl text-center">
                {block.title && (
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{block.title}</h2>
                )}
                {block.description && <p className="mt-2.5 text-sm text-muted-foreground">{block.description}</p>}
              </div>
            )}

            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {block.images.map((image) => (
                <div key={image.id} className="aspect-square overflow-hidden rounded-2xl border border-border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.imageUrl}
                    alt={block.title ?? ""}
                    loading="lazy"
                    className="size-full object-cover transition-transform duration-300 hover:scale-105"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
