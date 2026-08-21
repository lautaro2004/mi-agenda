"use client";

import * as React from "react";

export interface ChartPoint {
  label: string;
  value: number;
}

// Gráfico de barras mínimo, sin dependencias (no hay ninguna librería de
// charts instalada, y sumar una para un único gráfico no se justifica). SVG
// inline con viewBox proporcional para que escale con el contenedor.
export function UsageBarChart({ points, valueFormatter }: { points: ChartPoint[]; valueFormatter?: (v: number) => string }) {
  const [hovered, setHovered] = React.useState<number | null>(null);

  if (points.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Todavía no hay datos suficientes para este período.
      </div>
    );
  }

  const width = 100;
  const height = 40;
  const max = Math.max(...points.map((p) => p.value), 1);
  const barWidth = width / points.length;
  const format = valueFormatter ?? ((v: number) => String(v));

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-40 w-full overflow-visible">
        {points.map((p, i) => {
          const barHeight = (p.value / max) * (height - 2);
          const x = i * barWidth;
          const y = height - barHeight;
          const isHovered = hovered === i;
          return (
            <rect
              key={p.label}
              x={x + barWidth * 0.15}
              y={y}
              width={barWidth * 0.7}
              height={barHeight}
              rx={0.6}
              className={isHovered ? "fill-primary" : "fill-primary/60"}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}
      </svg>

      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{points[0]?.label}</span>
        {hovered !== null && (
          <span className="font-medium text-foreground">
            {points[hovered].label}: {format(points[hovered].value)}
          </span>
        )}
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}
