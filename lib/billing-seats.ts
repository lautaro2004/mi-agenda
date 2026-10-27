// Usuarios de Nodo: incluidos en el plan + usuarios extra contratados, y
// consistencia de precios entre planes. Dinero en centavos enteros.

export function seatLimit(included: number, extraUsers: number): number {
  return Math.max(0, Math.trunc(included)) + Math.max(0, Math.trunc(extraUsers));
}

const toCents = (value: number) => Math.round(value * 100);

/** Precio del plan + usuarios extra, en la moneda de lista. */
export function priceWithExtras(basePrice: number, extraUnitPrice: number | null | undefined, extraUsers: number): number {
  const extras = Math.max(0, Math.trunc(extraUsers));
  if (extras > 0 && (extraUnitPrice === null || extraUnitPrice === undefined || extraUnitPrice <= 0)) {
    throw new Error("Este plan no admite usuarios extra.");
  }
  return (toCents(basePrice) + extras * toCents(extraUnitPrice ?? 0)) / 100;
}

export interface SeatTier {
  name: string;
  users: number;
  price: number;
  /** Precio por usuario extra (null = el plan no ofrece extras). */
  extraUserPrice: number | null;
}

/**
 * Detecta combinaciones plan + extras que dejan sin sentido al siguiente
 * plan. Para cada plan y el siguiente más grande (diff = usuarios de
 * diferencia):
 *  - llegar al mismo tamaño sumando extras no puede salir MÁS barato que el
 *    plan siguiente (si no, nadie compraría el siguiente);
 *  - un tamaño intermedio no puede costar igual o más que el plan siguiente
 *    (se pagaría más por menos usuarios).
 */
export function tierWarnings(tiers: SeatTier[]): string[] {
  const sorted = [...tiers].sort((a, b) => a.users - b.users);
  const warnings: string[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i];
    const next = sorted[i + 1];
    const diff = next.users - cur.users;
    if (diff <= 0 || !cur.extraUserPrice || cur.extraUserPrice <= 0) continue;
    const extra = toCents(cur.extraUserPrice);
    const base = toCents(cur.price);
    const target = toCents(next.price);
    if (base + diff * extra < target) {
      warnings.push(
        `${cur.name} + ${diff} usuario${diff === 1 ? "" : "s"} extra (${(base + diff * extra) / 100}) sale más barato que ${next.name} (${next.price}). Subí el precio del usuario extra a ${Math.ceil((target - base) / diff) / 100} o más.`
      );
    }
    if (diff > 1 && base + (diff - 1) * extra >= target) {
      warnings.push(
        `${cur.name} con ${cur.users + diff - 1} usuarios (${(base + (diff - 1) * extra) / 100}) cuesta igual o más que ${next.name} con ${next.users} (${next.price}). Bajá el precio del usuario extra.`
      );
    }
  }
  return warnings;
}
