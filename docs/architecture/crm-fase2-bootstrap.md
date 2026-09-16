# CRM — Fase 2: Bootstrap técnico e identidad

**Estado:** ejecutada. Se creó el proyecto `crm/` (repo separado de `nexo/`, sibling en `C:\Users\aquin\Desktop\Kodexa\`), con Prisma multi-schema real contra la misma base de Supabase, Better Auth con identidad compartida, los 13 modelos Core del CRM aplicados a la base real, y una validación funcional completa de los 6 casos pedidos — todos con resultado real y verificado, no simulado.
**Fecha:** 2026-09-16
**Continúa:** [`crm-fase1-diseno.md`](./crm-fase1-diseno.md) (diseño) y toda la serie de migración de Nexo (`migracion-schemas-fase1/2/3.md`, `validacion-post-migracion.md`).
**Nota de ubicación:** este documento vive en el repo de Nexo (`nexo/docs/architecture/`) por continuidad con el resto de la serie — el repo del CRM (`crm/`) todavía no tiene su propia carpeta `docs/`; se agregó un `crm/README.md` que apunta acá. Si se prefiere que la documentación del CRM viva en su propio repo desde ya, es un simple `mv` — no hay ninguna razón técnica para que esté en uno u otro.

---

## Resumen de lo que existe ahora

```
C:\Users\aquin\Desktop\Kodexa\
├── nexo\      (sin cambios de código en esta fase)
└── crm\       (proyecto nuevo, repo separado, NO es un monorepo con Nexo)
```

`crm/` es una app Next.js 15 / App Router / TypeScript / Tailwind v4 / Prisma 7 independiente, con su propio `package.json`, su propio `node_modules`, su propio `prisma/schema.prisma` y su propia carpeta `prisma/migrations/` — apuntando a la **misma** base de Supabase que usa Nexo (mismo `DATABASE_URL`/`DIRECT_URL`, copiados literalmente de `nexo/.env.local`).

---

## A. Estructura final de schemas

Sin cambios en `public` ni en `nexo` (no se tocó ninguna tabla existente). `crm` pasó de "vacío" (Fase 3 de Nexo) a tener **13 tablas nuevas**, todas creadas en esta fase:

```
public (sin cambios)
├── User, Session, Account, Verification
├── Business, Membership
└── Lead (Kodexa — NO se usa desde el CRM, ver sección B)

nexo (sin cambios, 26 tablas — no tocadas en esta fase)

crm (nuevo — 13 tablas)
├── Workspace            (1:1 con public.Business)
├── Pipeline, PipelineStage
├── Company, Contact, Lead (propio del CRM, distinto de public.Lead)
├── Opportunity
├── Task, Activity
├── StatusDefinition
├── CustomFieldDefinition, CustomFieldValue
└── Tag
```

Verificado por consulta real contra `pg_tables` después de aplicar la migración (sección F): exactamente esas 13 tablas en `crm`, cero tablas nuevas en `public`, cero tablas nuevas en `nexo`.

**Decisión sobre `public.Lead`:** el schema de Prisma del CRM (`crm/prisma/schema.prisma`) **no** declara un modelo espejo de `public.Lead`. Motivo: `public.Lead` es el pipeline comercial de Kodexa (gente que quiere contratar Nexo/CRM), un concepto que el CRM no necesita consultar en esta fase, y declararlo hubiera colisionado de nombre con `crm.Lead` (el prospecto propio de cada negocio que usa el CRM — dos conceptos de dominio completamente distintos que comparten nombre, ya señalado como el punto de confusión más peligroso en la Fase 1 de diseño). Es una decisión tomada y documentada, no una omisión.

---

## B. Identidad

Nexo y CRM comparten `User`/`Session`/`Account`/`Verification` de la forma exacta que se diseñó en la Fase 1/2 de la migración de Nexo:

- **Dos instancias de Better Auth, una identidad.** `crm/lib/auth/auth.ts` es una copia deliberada (no importada, no un paquete compartido) de `nexo/lib/auth/auth.ts` — mismo `emailAndPassword.enabled: true`, mismo `advanced.database.generateId: false`. Cada proyecto tiene su propio `betterAuth()`, ninguno es un servicio separado.
- **Mismo `DATABASE_URL`.** `crm/.env.local` tiene el mismo valor que `nexo/.env.local` — literalmente la misma base Supabase, no un proyecto nuevo.
- **Mismo `BETTER_AUTH_SECRET`.** Copiado literal de `nexo/.env.local` a `crm/.env.local` — ver sección E para cómo se documentó esto sin exponer el valor real en este archivo.
- **Cero tablas nuevas de identidad.** `crm/prisma/schema.prisma` declara `User`/`Session`/`Account`/`Verification`/`Business`/`Membership` como modelos `@@schema("public")` — mismas tablas físicas, mismo `@@map`, sin ninguna columna nueva. Un proyecto Prisma separado necesita su propia declaración de modelo aunque la tabla ya exista; esto no crea nada, solo le permite al Prisma Client del CRM operar sobre lo que ya existe.
- **`Business` espejo deliberadamente incompleto.** Solo se declaran `id`/`name`/`createdAt`/`updatedAt` — los ~28 campos específicos de Nexo (slug, siteTemplate, deposit*, menu*, etc.) no se declaran, porque son nullable o tienen `DEFAULT` en la tabla física, así que el CRM nunca los necesita para poder crear/leer un `Business`. Verificado real en la sección F (Caso 3: `ensureBusinessMembership` crea un `Business` nuevo sin error).

**Validado empíricamente (no solo diseñado):** un usuario de prueba se registró (`auth.api.signUpEmail`), inició sesión (`auth.api.signInEmail`), su sesión se leyó (`auth.api.getSession`) y cerró sesión (`auth.api.signOut`) — todo desde el código del CRM, contra las mismas tablas `public.*` que usa Nexo. Ver sección F, Casos 1 y 2.

---

## C. Workspace

`crm.Workspace` es 1:1 con `public.Business` (`businessId` es su propia PK, con FK a `public."Business"("id")`, `ON DELETE CASCADE`). Su existencia para un `businessId` dado **es** la señal de "este negocio usa CRM" — no se creó ninguna tabla `ProductAccess` compartida, tal como se pidió explícitamente.

**Decisión de diseño no trivial, documentada acá porque no estaba 100% cerrada en el pedido:** las 13 tablas de dominio del CRM (`Company`, `Contact`, `Lead`, `Pipeline`, etc.) tienen una columna `businessId`, pero su FK real apunta a `crm."Workspace"("businessId")`, **no** directo a `public."Business"("id")`. Esto hace que la propia base de datos exija "no puede existir una `Company` sin que su `Business` tenga antes un `Workspace`" — una garantía más fuerte que confiar en que el código de aplicación lo chequee. El nombre de columna sigue siendo `businessId` en todos lados (no `workspaceId`) para que las queries se lean igual que en Nexo (`where: { businessId }`), a pesar de que la FK físicamente apunte a `Workspace`. Si se prefiere la relación directa a `Business` en cambio, es un cambio de una migración, se señala como decisión abierta a confirmar.

La cadena completa `usuario autenticado → Membership → Business → Workspace` está implementada en `crm/modules/business/current.ts` (resuelve hasta `Business`) + `crm/modules/workspace/service.ts` (`ensureWorkspace`/`getWorkspace`) y **validada de punta a punta contra la base real** — ver sección F, Casos 3 y 4.

---

## D. Migraciones — investigación de `_prisma_migrations`

Esto era la pregunta más importante de la fase, y se investigó con una prueba real y controlada, no una suposición. Procedimiento exacto:

1. **Se inspeccionó `public._prisma_migrations` de solo lectura** antes de tocar nada: 25 filas, todas de Nexo (desde `20260805055308_init_auth_and_membership` hasta `20260916000000_move_nexo_tables_to_schemas`, la última de la Fase 3).
2. **`npx prisma migrate status` desde el proyecto CRM, con la carpeta `crm/prisma/migrations/` todavía vacía:** reportó `"No migration found in prisma/migrations"` y `"Database schema is up to date!"` — sin quejarse de las 25 filas de Nexo, sin mencionarlas.
3. **Se escribió a mano** (no con `prisma migrate dev`, tal como se pidió) el SQL de la primera migración real del CRM: `CREATE SCHEMA IF NOT EXISTS crm;` + 13 `CREATE TABLE` — exclusivamente aditivo, ninguna sentencia toca `public.*` ni `nexo.*`. Se aplicó con `prisma db execute --file` y se registró con `prisma migrate resolve --applied` (mismo mecanismo, sin shadow database, que ya se usó y funcionó en la Fase 3 de Nexo).
4. **`npx prisma migrate status` desde el CRM, después de aplicar su propia migración:** `"1 migration found in prisma/migrations"` → `"Database schema is up to date!"`. Reconoce **exactamente** su propia migración, ninguna de las de Nexo.
5. **Prueba recíproca — `npx prisma migrate status` desde Nexo**, con la nueva fila del CRM ya sentada en la misma tabla `_prisma_migrations`: `"25 migrations found in prisma/migrations"` → `"Database schema is up to date!"`. Nexo sigue viendo exactamente sus 25 migraciones, sin ningún síntoma de la fila nueva del CRM.

### Respuestas concretas a las preguntas del pedido

| Pregunta | Respuesta, con evidencia |
|---|---|
| ¿Qué hace Prisma del CRM al ejecutar `migrate dev`? | No se ejecutó `migrate dev` (prohibido explícitamente) — se usó `db execute` + `migrate resolve --applied`, que es de hecho la alternativa segura que el pedido pide documentar si `migrate dev` no fuera apropiado. |
| ¿Reconoce correctamente el estado existente? | Sí — ve sus propias migraciones (0, luego 1), nunca las de Nexo. |
| ¿Intenta modificar migraciones pertenecientes a Nexo? | No, en ningún paso de la prueba. Ningún comando tocó una fila de Nexo en `_prisma_migrations` ni una tabla de `nexo.*`/`public.*`. |
| ¿Puede mantener su propio historial de migraciones? | Sí, confirmado — su carpeta local + la tabla compartida coexisten sin conflicto mientras cada proyecto solo declare (localmente) sus propias migraciones. |
| ¿Existe riesgo de que una migración del CRM afecte a Nexo? | No se observó ninguno en esta prueba — y la prueba recíproca (paso 5) confirma que Nexo tampoco se ve afectado por la existencia de la fila del CRM. El riesgo real, si existiera, sería a nivel de **contenido SQL** (si una migración del CRM alguna vez hiciera un `ALTER TABLE` sobre una tabla de `nexo.*`/`public.*`), no de la tabla `_prisma_migrations` en sí — y eso es una disciplina de código (nunca escribir esa clase de SQL desde el repo del CRM), no algo que Prisma prevenga automáticamente. |
| ¿Cómo manejar las migraciones de ambos repos de forma segura? | Ver estrategia abajo. |

### Estrategia de migraciones para ambos repos, de acá en adelante

1. **Nunca usar `prisma migrate dev`** contra esta base compartida, desde ningún proyecto — no hay una base de staging separada (confirmado en la Fase 3 de Nexo), y `migrate dev` intenta crear una shadow database y aplicar automáticamente, algo que no se quiere en este entorno.
2. **El flujo validado y recomendado, para ambos repos:** escribir el SQL a mano (revisado antes de aplicar), aplicarlo con `prisma db execute --file`, y registrarlo con `prisma migrate resolve --applied` — exactamente el mecanismo ya usado dos veces (Fase 3 de Nexo, esta fase del CRM) y ahora confirmado seguro respecto de la convivencia en `_prisma_migrations`.
3. **Disciplina de contenido, no de herramienta:** cada repo solo debe escribir DDL sobre su propio schema (`nexo/*` desde el repo de Nexo, `crm/*` desde el repo del CRM) más, cuando haga falta, una FK de solo lectura hacia `public.*` (nunca una escritura estructural sobre `public.*` desde el repo del CRM sin decisión explícita — `public.*` es territorio de Nexo históricamente, aunque ahora sea compartido).
4. Este hallazgo **resuelve** el Riesgo 1 que había quedado marcado como "no verificado" en `crm-fase1-diseno.md` — se confirma con evidencia real, ya no es una incertidumbre.

---

## E. Variables de entorno

`crm/.env.example` (documentado, sin valores reales, seguro de commitear):

```
DATABASE_URL=
DIRECT_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3001
```

`crm/.env.local` (real, nunca commiteado — `.gitignore` ya lo excluye): tiene los mismos valores de `DATABASE_URL`/`DIRECT_URL` que `nexo/.env.local` (copiados literalmente, misma base Supabase) y el **mismo** `BETTER_AUTH_SECRET` que Nexo (copiado literal, no generado de nuevo). No se repite el valor acá por higiene de secretos — vive en `nexo/.env.local` y en `crm/.env.local`, en ningún archivo versionado ni en ningún documento.

`BETTER_AUTH_URL` es `http://localhost:3001` (Nexo usa `:3000`) — dos apps distintas en desarrollo local necesitan puertos distintos; esto no afecta la identidad compartida (que depende del secret y de las tablas, no del puerto).

---

## F. Pruebas realizadas — resultados concretos

### Calidad (todos ejecutados, resultados reales)

| Comando | Resultado |
|---|---|
| `npx prisma validate` | ✅ Válido (schema con `schemas = ["public", "crm"]`, 19 modelos) |
| `npx prisma generate` | ✅ Cliente generado sin errores (Prisma 7.10.0 — `^7.8.0` resolvió a un patch más nuevo) |
| `npx tsc --noEmit` | ✅ 0 errores |
| `npm run lint` | ✅ 0 errores, 0 warnings |
| `npm test` (vitest, suite mockeada — ver nota abajo) | ✅ 9/9 tests, 3 archivos |
| `npm run build` | ✅ `Compiled successfully`, 4/4 páginas generadas |

**Nota sobre `npm test`:** igual criterio que Nexo — los tests que quedan permanentes en el repo (`modules/business/current.test.ts`, `modules/workspace/service.test.ts`, `modules/companies/service.test.ts`) mockean Prisma (`vi.mock("@/lib/prisma", ...)`, mismo patrón que ya usa `nexo/modules/leads/service.test.ts`). No hay base de staging separada (confirmado en la Fase 3 de Nexo), así que ningún test que corra regularmente vía `npm test` debe tocar la base real — la validación contra datos reales (abajo) se hizo aparte, una vez, y se limpió.

### Validación funcional real contra la base compartida (los 6 casos pedidos + 1 extra)

Se escribió un test temporal (`_tmp_bootstrap_validation.test.ts`), se corrió una vez contra la base real, y **se borró inmediatamente después** (no quedó en el repo). Los 4 usuarios/negocios de prueba que creó se eliminaron en su propio `afterAll` (cascada: borrar `Business` elimina `Membership` + `Workspace` + todo lo que cuelgue de `Workspace`; borrar `User` elimina `Session`/`Account`) — confirmado con una lectura posterior: **cero residuos**.

| Caso | Resultado | Evidencia |
|---|---|---|
| 1. Usuario se autentica desde el CRM | ✅ PASS | `signUpEmail` creó una fila real en `public.User` (verificada con `findUnique`) |
| 2. Sesión se guarda/lee en `public.Session` | ✅ PASS | `signInEmail` escribió una fila en `Session`; `getSession` la resolvió correctamente vía cookie |
| 3. CRM resuelve `User → Membership → Business` | ✅ PASS | `ensureBusinessMembership` creó `Business`+`Membership` reales; segunda llamada confirmó idempotencia (no duplica) |
| 4. CRM encuentra/crea su `Workspace` | ✅ PASS | `getWorkspace` devolvió `null` antes, `ensureWorkspace` lo creó, `getWorkspace` lo encontró después |
| 5. CRM crea y lee `crm.Company` | ✅ PASS | `createCompany`/`listCompanies`/`getCompany` funcionando de punta a punta, cruzando `crm.Company → crm.Workspace → public.Business` |
| 6. Workspace A no ve datos de Workspace B | ✅ PASS | Dos negocios de prueba reales, cero superposición confirmada explícitamente — incluido el caso "pido una Company real por id pero con el `businessId` de otro negocio" → `null`, no la fila |
| Extra: lectura conjunta `public.*` + `crm.*` | ✅ PASS | Un solo `prisma.business.findUnique(...)` con `include` anidado resolviendo `Membership→User` (public) y `Workspace→Company` (crm) en la misma query |

**Nada de esto se ejecutó a ciegas:** el primer intento falló con un error real (`SASL: client password must be a string`) por un problema de orden de carga de variables de entorno en ESM (ver "Problemas encontrados" abajo) — se diagnosticó, se corrigió, y se volvió a correr hasta obtener el resultado limpio de arriba.

---

## Problemas encontrados (reales, durante esta fase — no ocultados)

1. **`npm install` falló con un bug interno de npm** (`TypeError: Cannot read properties of null (reading 'edgesOut')`, dentro de `@npmcli/arborist`), disparado al resolver los peer dependencies de `vitest@4.1.11` (específicamente `@vitest/browser-playwright`). Es un bug conocido de esta combinación de versiones de npm/vitest, no algo de este proyecto. **Solución:** `npm install --legacy-peer-deps` — instaló sin problema (525 paquetes). Documentado acá para que nadie pierda tiempo re-descubriéndolo.
2. **`dotenv/config` (el default de `import "dotenv/config"`) solo lee `.env`, no `.env.local`.** Nexo no lo sufre porque tiene (redundantemente) ambos archivos con los mismos valores; el CRM solo tiene `.env.local` (siguiendo la convención de Next.js). Esto rompía `prisma migrate status`/`db execute` con un error de configuración. **Solución aplicada:** `crm/prisma.config.ts` ahora carga explícitamente `dotenv.config({ path: ".env.local" })` en vez de depender del default.
3. **El mismo problema, pero en runtime dentro de un test vitest:** un `import` de nivel superior (`@/lib/auth/auth`, que llama a `getPrisma()` en el momento de cargarse el módulo) se evalúa, por las reglas de ESM, **antes** que cualquier código — incluida una llamada a `dotenv.config()` — escrito en el propio archivo de test aunque esté físicamente primero. El resultado fue el mismo error SASL, ahora en tiempo de test. **Solución aplicada para la corrida puntual:** exportar las variables de entorno al shell antes de invocar `vitest` (`set -a && source .env.local && set +a`), en vez de depender de un `dotenv.config()` dentro del propio archivo de test. Esto no afecta a los tests permanentes (mockeados, no necesitan la base real) — es una nota para la próxima vez que alguien necesite correr algo contra la base real desde este repo.
4. **`BETTER_AUTH_URL is not set` (warning, no error)** apareció durante la corrida de tests reales — mismo motivo que el punto 2/3 (el env no estaba cargado en ese momento puntual del primer intento fallido). No afectó el resultado final una vez corregido el orden de carga.

Ninguno de estos 4 puntos es un problema de la arquitectura public/nexo/crm en sí — son fricciones de entorno de desarrollo (npm, orden de carga de `.env`), ya resueltas y documentadas para que no se repitan.

---

## G. Riesgos pendientes

1. **`Business` puede crearse desde el CRM sin que el usuario haya pasado nunca por Nexo** (`ensureBusinessMembership`, sección C). Es intencional y necesario para que el CRM funcione de forma standalone, pero es una decisión de producto que vale la pena confirmar: ¿un `Business` "nacido en el CRM" (sin `nexo.Subscription`, sin ningún dato de Nexo) debe verse distinto en algún lado? No se resolvió en esta fase — no había necesidad para validar la arquitectura, pero es una pregunta real de producto para cuando haya usuarios de verdad entrando por ambos caminos.
2. **FK de `businessId` hacia `Workspace` en vez de hacia `Business` directo** (sección C) — decisión tomada y documentada, pero no explícitamente confirmada por el usuario antes de implementarla (se consideró suficientemente acotada como para no bloquear toda la fase por esto). Se puede revertir con una migración chica si se prefiere el otro criterio.
3. **`EntityTag` (asociación polimórfica etiqueta↔entidad) no se implementó** — `crm.Tag` existe como catálogo, pero no hay todavía forma de etiquetar una `Company`/`Lead`/etc. Consistente con "no construir por adelantado lo que no se pidió explícitamente" (el pedido de esta fase solo listaba `Tag`, no `EntityTag`) — se documenta para que no se dé por sentado que el tagging ya funciona de punta a punta.
4. **Ningún modelo de email/calendario/automatizaciones/integración con Nexo/billing se creó** — tal como se pidió explícitamente ("pueden quedar documentados... pero no quiero que esta fase se convierta en la implementación completa de esos módulos"). El diseño conceptual ya existe en `crm-fase1-diseno.md`; nada de eso tiene tabla real todavía.
5. **No hay UI real** — `app/page.tsx` y el dashboard son placeholders mínimos. El pedido de esta fase era la base técnica (identidad + Workspace + aislamiento), no pantallas — se deja explícito para que no se lea como un olvido.
6. **El repo `crm/` no está inicializado como repositorio git todavía** (`git status` confirma "not a git repository"). No se corrió `git init` sin que se pida explícitamente — es una decisión de dónde/cómo alojar el repo (GitHub, mismo org que Nexo, etc.) que le corresponde al usuario, no algo que convenga decidir unilateralmente.
7. **Los 4 problemas de entorno de la sección anterior** (npm, orden de `.env`) están resueltos para esta sesión pero no están cubiertos por ningún test automático que los detecte si vuelven a aparecer (ej. si alguien borra `.env.local` y solo tiene `.env`) — queda como fricción conocida, no como bug activo.

---

## Resultado de esta fase — confirmación del objetivo

La cadena completa que se pidió como resultado esperado se ejecutó y verificó de punta a punta, contra la base real, con código real (no simulado):

```
Usuario de prueba → signUpEmail (Better Auth, CRM)
       ↓
public.User + public.Session (mismas tablas que Nexo)
       ↓
ensureBusinessMembership → public.Membership → public.Business
       ↓
ensureWorkspace → crm.Workspace
       ↓
createCompany → crm.Company
```

Sin duplicar identidad, sin tocar código ni datos de Nexo, con aislamiento multi-tenant confirmado entre dos negocios reales de prueba. El CRM tiene ahora una base técnica real sobre la que construir módulo por módulo, tal como se pidió.
