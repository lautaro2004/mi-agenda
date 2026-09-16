# CRM — Sistema visual de Nodo (investigación de CSS + base de diseño)

**Estado: EJECUTADA.** No se encontró ningún bug real en el pipeline de Tailwind v4 (investigado con evidencia directa, no supuesta) — el hallazgo más probable de lo que se reportó como "HTML sin estilos" fue un proceso ajeno, roto, corriendo en el puerto 3000. De cualquier forma, se invirtió en una base visual real de producto SaaS (antes deliberadamente mínima, ver Fase 3 Core), aplicada a `/login`, `/registro`, el layout autenticado, el dashboard y los módulos existentes — sin rehacer ninguna lógica de negocio. `prisma validate`/`generate`/`tsc`/`lint`/`test`/`build`: **todos en verde**.
**Fecha:** 2026-09-17
**Nota de nombre de archivo:** el pedido pidió `crm-fase3-ui.md` explícitamente — se usa ese nombre literal aunque cronológicamente esta fase viene después de la Fase 4 (integración con Nexo), para no desviarse de lo pedido.

---

## 1. Causa raíz — investigación real, no asumida

Se siguió el orden pedido: auditoría de config → prueba mínima real (levantar el servidor) → recién ahí, corrección si correspondía.

**Config revisada — todo correcto:**
- `package.json`: `tailwindcss@^4` y `@tailwindcss/postcss@^4` como devDependencies.
- `postcss.config.mjs`: usa `@tailwindcss/postcss` (el plugin correcto para v4 — no `tailwindcss` a secas, que sería la sintaxis de v3).
- `app/globals.css`: `@import "tailwindcss";` (sintaxis CSS-first de v4, no un `tailwind.config.js` con `content: [...]` de v3).
- `app/layout.tsx`: importa `./globals.css`.
- Sin ningún `tailwind.config.js`/`.ts` viejo dando vueltas (confirmado con `find`).
- `node_modules/tailwindcss` y `node_modules/@tailwindcss/postcss`: ambos **v4.3.3**, instalados y coincidentes — no hay una versión vieja cacheada resolviendo por error.

**Prueba mínima real (no solo leer archivos):**
1. Se levantó `npm run dev` de verdad y se pidió `GET /login` con `curl`. El HTML devuelto **incluye** `<link rel="stylesheet" href="/_next/static/css/app/layout.css">` y cada elemento **tiene** sus clases de Tailwind (`class="rounded-xl border border-slate-200 bg-white shadow-sm..."`).
2. Se descargó ese CSS real: 22 KB, con el comentario `tailwindcss v4.3.3` y reglas reales generadas para `.bg-slate-50`, `.rounded-xl`, etc. — Tailwind **sí** estaba procesando `globals.css` y generando CSS real a partir de las clases usadas.
3. Se repitió todo con `npm run build && npm run start` (modo producción): mismo resultado — CSS real de 17 KB, linkeado correctamente, clases aplicadas.

**Conclusión: no se pudo reproducir "HTML sin estilos" en la aplicación tal como estaba.** El pipeline de Tailwind v4 funcionaba correctamente en dev y en producción, con evidencia directa en ambos casos — no había ninguna causa raíz de CSS que corregir.

**Hallazgo que probablemente explica lo reportado:** al levantar el servidor la primera vez, Next.js avisó *"Port 3000 is in use by process 12708, using available port 3001 instead"*. Se inspeccionó qué había en el puerto 3000: un proceso Next.js **con Pages Router** (`pages/_app`, `pages/_error`, `__NEXT_DATA__` — una estructura que ni Nexo ni Nodo usan, ambos son App Router) devolviendo un error 500 (`TypeError: __webpack_modules__[moduleId] is not a function`). No es Nodo. Muy probablemente sea un proceso de otro proyecto del monorepo de carpetas (`kodexa-landing`, `Gonna/`, `WT-WEBSITE`, etc.) que quedó corriendo y roto en ese puerto. **No se tocó ese proceso** (no se sabe qué es ni si hace falta) — se dejó explícitamente para que el usuario decida. En un arranque posterior del servidor, el puerto 3000 ya estaba libre y Nodo levantó ahí directamente, sirviendo el diseño nuevo correctamente (ver sección 3).

**No se modificó ningún archivo de configuración de Tailwind/PostCSS/Next** — no hacía falta, todos estaban bien.

---

## 2. Sistema visual base

Con el pipeline confirmado sano, se invirtió en la dirección visual pedida (SaaS moderno, no admin genérico) sobre la misma base de componentes de la Fase 3 — **la API pública de cada componente no cambió**, así que ninguna página que ya los usaba necesitó tocarse para heredar el rediseño.

- **Tipografía:** Geist (vía `next/font/google`) — misma familia que ya usa Nexo, consistencia de marca entre productos de Kodexa sin compartir código entre repos.
- **Acento de marca:** un único color, indigo-600, aplicado con las clases estándar de Tailwind (`bg-indigo-600`, `text-indigo-600`, anillos de foco `ring-indigo-500`) — sin tokens CSS custom nuevos más allá de lo que ya había. Todo lo demás sigue en la paleta neutra `slate`.
- **Logo/wordmark:** `components/ui/logo.tsx` — "N" en un cuadrado indigo + "Nodo" en texto, usado en sidebar, login, registro, onboarding y home.
- **Íconos:** `components/ui/icons.tsx` — 10 SVG inline propios (mismo trazo, 1.75px), sin sumar `lucide-react` ni ninguna librería — decisión explícita para no repetir el problema de instalación que ya se documentó en la Fase 2 (bug de npm con peer deps).

### Componentes de `components/ui/primitives.tsx` (todos reescritos, misma API)

| Componente | Cambio visual |
|---|---|
| `Button` | Variante `primary` ahora indigo (antes slate-900); tamaños `sm`/`md`; anillo de foco visible (accesibilidad) |
| `Card` | `rounded-2xl` (antes `xl`), borde más sutil |
| `Badge` | 5 variantes (`neutral`/`brand`/`success`/`warning`/`danger`) — antes una sola |
| `Input`/`Textarea`/`Select` | Foco con anillo indigo (`ring-indigo-500/20`), `Select` con flecha custom (antes la nativa del navegador, inconsistente entre SO) |
| `PageHeader` | Título más grande (`text-2xl`), más aire |
| `EmptyState` | Fondo sutil, más padding vertical |
| `StatCard` | Número más grande (`text-3xl`) |
| `Table`/`Th`/`Td` | **Nuevos** — wrapper de tabla consistente (ver sección 4, nota sobre adopción parcial) |
| `Spinner` | **Nuevo** — usado en los estados de carga de login/registro/onboarding |

### Componentes nuevos

- `components/ui/modal.tsx` — overlay controlado simple (sin `<dialog>` nativo por inconsistencia entre navegadores, sin librería externa). **Disponible, no forzado** en ningún CRUD existente — todos los formularios de creación/edición ya viven en su propia página, no en un modal; no había ningún flujo real que lo necesitara todavía.
- `components/dashboard/topbar.tsx` — extraído del `layout.tsx` (antes un `<header>` inline) a su propio componente reutilizable, con el buscador y el `UserMenu`.

---

## 3. `/login` y `/registro`

Ambos reconstruidos con: `Logo` centrado arriba, `Card` con más padding (`p-8`), fondo con gradiente sutil (`from-slate-50 to-white`) en vez de un blanco/gris plano, título con jerarquía tipográfica más clara, estado de error con fondo rojo suave (`bg-red-50`) en vez de solo texto rojo, botón con `Spinner` animado durante el envío. La lógica de autenticación (`AuthForm`, `lib/auth/auth-client.ts`) **no se tocó** — solo presentación, tal como se pidió.

Verificado con evidencia real (no solo "debería andar"): se volvió a levantar el servidor después del rediseño, se pidió `/login`, y se confirmó que el HTML trae las clases nuevas (`bg-gradient-to-b`, `bg-indigo-600`, `rounded-2xl`) **y** que el CSS descargado (esta vez 39 KB) contiene las reglas reales `.bg-indigo-600` y `.rounded-2xl` generadas. En este segundo arranque, el puerto 3000 ya estaba libre y Nodo sirvió ahí directamente — exactamente la URL que se pidió poder abrir.

---

## 4. Layout autenticado y dashboard

- `app/dashboard/layout.tsx`: sin cambios de lógica (sigue resolviendo `resolveWorkspaceContext()` y redirigiendo a `/onboarding` si falta Business/Workspace, igual que la Fase 3). Cambios visuales: usa el nuevo `Topbar`, y el contenido principal ahora tiene un `max-w-6xl` centrado (antes ocupaba todo el ancho disponible sin límite, se sentía menos cuidado en pantallas grandes).
- `components/dashboard/sidebar.tsx`: agregado el `Logo`, un ícono propio por cada ítem de navegación, estado activo con fondo indigo suave (antes slate-900 sólido). **El comportamiento configurable por módulos (`activeModules`) no se tocó** — sigue ocultando/mostrando ítems exactamente igual que en la Fase 3.
- `components/dashboard/user-menu.tsx`: agregado un círculo con la inicial del email (mismo patrón que un avatar, sin necesitar una imagen real) + ícono de salir.
- Dashboard (`app/dashboard/page.tsx`, `modules/dashboard/service.ts`): **sin cambios** — sigue mostrando exactamente los mismos datos reales (métricas + actividad reciente + "Leads desde Nexo" de la Fase 4), ahora dentro del `Card`/`StatCard` rediseñados. No se agregó ningún dato simulado.

---

## 5. Módulos existentes (Companies, Contacts, Leads, Pipelines, Opportunities, Tasks, Activities, Tags, Custom Fields, Status Definitions)

**Ninguno se reescribió.** Todos ya usaban `Card`/`Badge`/`Button`/`PageHeader`/`EmptyState`/`StatusSelect`/`OwnerAssign`/`TagPicker` de `components/ui/primitives.tsx` — al rediseñar esos componentes una sola vez, los ~20 páginas que los consumen heredan el sistema visual nuevo automáticamente, sin tocarlas.

**Decisión de alcance explícita:** 3 listas (`empresas`, `contactos`, `leads`) todavía arman su `<table>` con markup HTML directo en vez de los nuevos `Table`/`Th`/`Td`. Se revisó y esas clases ya coinciden exactamente con las del sistema nuevo (mismo padding, mismos colores) — el resultado visual es el mismo que si usaran el wrapper. No se hizo el swap mecánico a `Table`/`Th`/`Td` en esos 3 archivos por ser trabajo repetitivo de bajo impacto visual real; quedan como el próximo paso obvio si se sigue iterando el sistema de componentes, no como una inconsistencia visible.

---

## 6. Validaciones realizadas

| Comando | Resultado |
|---|---|
| `npx prisma validate` | ✅ |
| `npx prisma generate` | ✅ |
| `npx tsc --noEmit` | ✅ 0 errores |
| `npm run lint` | ✅ 0 errores, 0 warnings |
| `npm test` | ✅ **49/49** (mismos tests de las Fases 3/4, ninguno tocado — cero lógica de negocio modificada) |
| `npm run build` | ✅ 42 rutas, `Compiled successfully` |
| Verificación visual real (no solo build) | ✅ servidor levantado dos veces (antes y después del rediseño), HTML + CSS reales descargados y confirmados con las clases/reglas esperadas en cada caso |

No se corrió ningún test nuevo específico de UI (no había lógica nueva que testear — esto fue exclusivamente presentación). Los 49 tests existentes siguen pasando exactamente igual, confirmando que no se tocó ninguna lógica de negocio.

---

## Archivos modificados/creados

**Modificados:** `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/registro/page.tsx`, `app/dashboard/layout.tsx`, `components/ui/primitives.tsx`, `components/auth/auth-form.tsx`, `components/onboarding/onboarding-form.tsx`, `components/dashboard/sidebar.tsx`, `components/dashboard/user-menu.tsx`.

**Nuevos:** `components/ui/logo.tsx`, `components/ui/icons.tsx`, `components/ui/modal.tsx`, `components/dashboard/topbar.tsx`.

**No tocados:** todo `modules/*`, todo `app/api/*`, `prisma/schema.prisma`, cualquier archivo de Nexo, `lib/auth/*`, `lib/workspace.ts`.

---

## Decisiones de diseño (resumen)

1. Un solo acento de marca (indigo) sobre una base neutra — no una paleta completa todavía, evita sobre-invertir antes de tener feedback real de uso.
2. Íconos propios en SVG en vez de una librería — evita repetir la fricción de instalación ya documentada en la Fase 2, y mantiene el bundle liviano.
3. `Modal` construido y disponible pero no forzado en ningún flujo existente — ningún CRUD actual lo necesitaba.
4. `Table`/`Th`/`Td` creados pero no retro-adoptados en las 3 listas que ya tenían markup equivalente a mano — bajo impacto visual, se documenta como pendiente menor, no como deuda oculta.
5. No se tocó ninguna lógica de negocio, ninguna migración, ningún archivo de Nexo — tal como se pidió explícitamente.

---

## Resultado final

## ✅ PASS

1. **Causa raíz:** no se encontró un bug real en el pipeline de Tailwind v4 — verificado con evidencia directa (HTML + CSS reales, dev y producción). El síntoma reportado probablemente correspondía a un proceso ajeno y roto en el puerto 3000, no a Nodo.
2. **Archivos modificados:** 11 modificados + 4 nuevos, todos de presentación (`app/`, `components/ui/`, `components/dashboard/`, `components/auth/`, `components/onboarding/`) — cero `modules/*`, cero `app/api/*`, cero Prisma, cero Nexo.
3. **Solución aplicada:** sistema visual con acento indigo, tipografía Geist, logo/wordmark, íconos propios, componentes rediseñados con la misma API.
4. **Estado visual de `/login`:** confirmado con HTML+CSS reales — logo, card con sombra, gradiente de fondo, campos con foco indigo, botón con spinner de carga, error con fondo suave.
5. **Estado visual del dashboard:** layout con sidebar (logo + íconos + estado activo indigo) + topbar + contenido centrado con métricas reales en `StatCard` y actividad reciente en `Card`.
6. **Estado visual de los módulos:** consistente en las ~20 páginas existentes, heredado automáticamente del sistema de componentes central — sin reescribir ninguna.
7. **Tests:** 49/49, sin cambios (cero lógica tocada).
8. **Build:** ✅ 42 rutas.

**Nodo ahora se ve, y se puede confirmar con evidencia real (no solo "debería andar"), como un producto SaaS con identidad propia — no como HTML sin estilos ni como un panel administrativo genérico.**
