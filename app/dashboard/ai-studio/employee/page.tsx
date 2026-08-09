"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Check, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { PageHeader } from "@/components/dashboard/page-header";
import { cn } from "@/lib/utils";
import { requestJson } from "@/lib/api-client";
import { employeeProfileSchema, type EmployeeProfileFormValues } from "@/lib/schemas";
import {
  EMPLOYEE_CAPABILITIES,
  EMPLOYEE_COMMERCIAL_LEVEL_LEVELS,
  EMPLOYEE_COMMERCIAL_LEVEL_META,
  EMPLOYEE_EMOJI_USAGE_LEVELS,
  EMPLOYEE_EMOJI_USAGE_META,
  EMPLOYEE_FORMALITY_LEVELS,
  EMPLOYEE_FORMALITY_META,
  EMPLOYEE_RESPONSE_LENGTH_LEVELS,
  EMPLOYEE_RESPONSE_LENGTH_META,
  EMPLOYEE_WARMTH_LEVELS,
  EMPLOYEE_WARMTH_META,
  type EmployeeCapability,
  type EmployeeCapabilityKey,
  type EmployeeProfile,
} from "@/lib/types";

interface TextListItem {
  id: string;
  text: string;
  active: boolean;
}

export default function EmployeeProfilePage() {
  const [employee, setEmployee] = React.useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    requestJson<{ employee: EmployeeProfile }>("/api/ai-studio/employee")
      .then(({ employee }) => setEmployee(employee))
      .catch(() => toast.error("No pudimos cargar el perfil del empleado."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="Empleado"
        description="Definí la identidad, personalidad, objetivos y restricciones de tu AI Employee."
      />

      {loading && (
        <div className="space-y-6">
          <div className="h-64 animate-pulse rounded-2xl border border-border bg-muted/30" />
          <div className="h-48 animate-pulse rounded-2xl border border-border bg-muted/30" />
        </div>
      )}

      {!loading && !employee && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          No pudimos cargar el perfil del empleado. Recargá la página para volver a intentar.
        </div>
      )}

      {employee && (
        <div className="space-y-6">
          <ProfileForm employee={employee} onSaved={setEmployee} />

          <TextListSection
            title="Objetivos"
            description="Qué buscás que tu empleado priorice en cada conversación."
            placeholder="Ej: Conseguir reservas"
            apiPath="goals"
            responseKey="goal"
            items={employee.goals}
            onChange={(goals) => setEmployee((prev) => (prev ? { ...prev, goals } : prev))}
          />

          <TextListSection
            title="Restricciones"
            description="Reglas que tu empleado nunca debe romper."
            placeholder="Ej: Nunca confirmar un turno sin disponibilidad"
            apiPath="restrictions"
            responseKey="restriction"
            items={employee.restrictions}
            onChange={(restrictions) => setEmployee((prev) => (prev ? { ...prev, restrictions } : prev))}
          />

          <CapabilitiesSection
            capabilities={employee.capabilities}
            onChange={(capabilities) => setEmployee((prev) => (prev ? { ...prev, capabilities } : prev))}
          />
        </div>
      )}
    </div>
  );
}

function ProfileForm({
  employee,
  onSaved,
}: {
  employee: EmployeeProfile;
  onSaved: (employee: EmployeeProfile) => void;
}) {
  const [justSaved, setJustSaved] = React.useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeProfileFormValues>({
    resolver: zodResolver(employeeProfileSchema),
    values: {
      name: employee.name,
      role: employee.role,
      description: employee.description,
      formality: employee.formality,
      warmth: employee.warmth,
      emojiUsage: employee.emojiUsage,
      responseLength: employee.responseLength,
      commercialLevel: employee.commercialLevel,
    },
  });

  async function onSubmit(values: EmployeeProfileFormValues) {
    try {
      const { employee: updated } = await requestJson<{ employee: EmployeeProfile }>(
        "/api/ai-studio/employee",
        { method: "PATCH", body: JSON.stringify(values) }
      );
      onSaved(updated);
      toast.success("Cambios guardados");
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch {
      toast.error("No pudimos guardar los cambios. Intentá de nuevo.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="text-base font-semibold text-foreground">Identidad</h3>
        <p className="mt-1 text-sm text-muted-foreground">Cómo se presenta tu empleado ante tus clientes.</p>

        <FieldGroup className="mt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="employee-name">Nombre</FieldLabel>
              <Input id="employee-name" placeholder="Ej: Sofía" aria-invalid={!!errors.name} {...register("name")} />
              <FieldError errors={[errors.name]} />
            </Field>

            <Field data-invalid={!!errors.role}>
              <FieldLabel htmlFor="employee-role">Rol</FieldLabel>
              <Input
                id="employee-role"
                placeholder="Ej: Recepcionista Virtual"
                aria-invalid={!!errors.role}
                {...register("role")}
              />
              <FieldError errors={[errors.role]} />
            </Field>
          </div>

          <Field data-invalid={!!errors.description}>
            <FieldLabel htmlFor="employee-description">Descripción</FieldLabel>
            <Textarea
              id="employee-description"
              rows={3}
              placeholder="Ej: Especialista en atención al cliente y gestión de reservas."
              aria-invalid={!!errors.description}
              {...register("description")}
            />
            <FieldError errors={[errors.description]} />
          </Field>
        </FieldGroup>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="text-base font-semibold text-foreground">Personalidad</h3>
        <p className="mt-1 text-sm text-muted-foreground">Cómo se comunica con tus clientes.</p>

        <FieldGroup className="mt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="formality">Formalidad</FieldLabel>
              <Controller
                control={control}
                name="formality"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="formality" className="w-full">
                      <SelectValue placeholder="Seleccioná una opción" />
                    </SelectTrigger>
                    <SelectContent>
                      {EMPLOYEE_FORMALITY_LEVELS.map((level) => (
                        <SelectItem key={level} value={level}>
                          {EMPLOYEE_FORMALITY_META[level].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="warmth">Cercanía</FieldLabel>
              <Controller
                control={control}
                name="warmth"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="warmth" className="w-full">
                      <SelectValue placeholder="Seleccioná una opción" />
                    </SelectTrigger>
                    <SelectContent>
                      {EMPLOYEE_WARMTH_LEVELS.map((level) => (
                        <SelectItem key={level} value={level}>
                          {EMPLOYEE_WARMTH_META[level].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="emojiUsage">Uso de emojis</FieldLabel>
              <Controller
                control={control}
                name="emojiUsage"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="emojiUsage" className="w-full">
                      <SelectValue placeholder="Seleccioná una opción" />
                    </SelectTrigger>
                    <SelectContent>
                      {EMPLOYEE_EMOJI_USAGE_LEVELS.map((level) => (
                        <SelectItem key={level} value={level}>
                          {EMPLOYEE_EMOJI_USAGE_META[level].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="responseLength">Longitud de respuestas</FieldLabel>
              <Controller
                control={control}
                name="responseLength"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="responseLength" className="w-full">
                      <SelectValue placeholder="Seleccioná una opción" />
                    </SelectTrigger>
                    <SelectContent>
                      {EMPLOYEE_RESPONSE_LENGTH_LEVELS.map((level) => (
                        <SelectItem key={level} value={level}>
                          {EMPLOYEE_RESPONSE_LENGTH_META[level].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="commercialLevel">Nivel comercial</FieldLabel>
              <Controller
                control={control}
                name="commercialLevel"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="commercialLevel" className="w-full">
                      <SelectValue placeholder="Seleccioná una opción" />
                    </SelectTrigger>
                    <SelectContent>
                      {EMPLOYEE_COMMERCIAL_LEVEL_LEVELS.map((level) => (
                        <SelectItem key={level} value={level}>
                          {EMPLOYEE_COMMERCIAL_LEVEL_META[level].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>
        </FieldGroup>
      </div>

      <Field>
        <Button type="submit" disabled={isSubmitting} className="w-fit">
          {justSaved ? (
            <>
              <Check className="size-4" data-icon="inline-start" />
              Guardado
            </>
          ) : (
            "Guardar cambios"
          )}
        </Button>
      </Field>
    </form>
  );
}

function TextListSection({
  title,
  description,
  placeholder,
  apiPath,
  responseKey,
  items,
  onChange,
}: {
  title: string;
  description: string;
  placeholder: string;
  apiPath: "goals" | "restrictions";
  responseKey: "goal" | "restriction";
  items: TextListItem[];
  onChange: (items: TextListItem[]) => void;
}) {
  const [text, setText] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function add() {
    const value = text.trim();
    if (value.length < 3) {
      toast.error("Ingresá al menos 3 caracteres.");
      return;
    }

    setSubmitting(true);
    try {
      const body = await requestJson<Record<string, TextListItem>>(`/api/ai-studio/employee/${apiPath}`, {
        method: "POST",
        body: JSON.stringify({ text: value, active: true }),
      });
      onChange([...items, body[responseKey]]);
      setText("");
    } catch {
      toast.error("No pudimos guardar el cambio. Intentá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggle(item: TextListItem) {
    const next = { ...item, active: !item.active };
    onChange(items.map((i) => (i.id === item.id ? next : i)));
    try {
      await requestJson(`/api/ai-studio/employee/${apiPath}/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ text: item.text, active: next.active }),
      });
    } catch {
      onChange(items);
      toast.error("No pudimos actualizar el cambio.");
    }
  }

  async function remove(item: TextListItem) {
    onChange(items.filter((i) => i.id !== item.id));
    try {
      await requestJson(`/api/ai-studio/employee/${apiPath}/${item.id}`, { method: "DELETE" });
    } catch {
      onChange(items);
      toast.error("No pudimos eliminar el ítem.");
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>

      <div className="mt-4 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void add();
            }
          }}
        />
        <Button type="button" onClick={() => void add()} disabled={submitting}>
          <Plus className="size-4" data-icon="inline-start" />
          Agregar
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Todavía no agregaste nada acá.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
            >
              <span className={cn("text-sm", !item.active && "text-muted-foreground line-through")}>
                {item.text}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <Switch
                  checked={item.active}
                  onCheckedChange={() => void toggle(item)}
                  aria-label={`Activar o desactivar: ${item.text}`}
                  size="sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive"
                  onClick={() => void remove(item)}
                  aria-label={`Eliminar: ${item.text}`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CapabilitiesSection({
  capabilities,
  onChange,
}: {
  capabilities: EmployeeCapability[];
  onChange: (capabilities: EmployeeCapability[]) => void;
}) {
  async function toggle(key: EmployeeCapabilityKey, enabled: boolean) {
    onChange(capabilities.map((c) => (c.key === key ? { ...c, enabled } : c)));
    try {
      await requestJson(`/api/ai-studio/employee/capabilities/${key}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      });
    } catch {
      onChange(capabilities);
      toast.error("No pudimos actualizar la capacidad.");
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="text-base font-semibold text-foreground">Capacidades</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Habilitá o deshabilitá qué puede hacer tu empleado. La lógica de cada capacidad se irá conectando en
        próximas etapas.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {EMPLOYEE_CAPABILITIES.map((capability) => {
          const current = capabilities.find((c) => c.key === capability.id);
          return (
            <div
              key={capability.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
            >
              <span className="text-sm text-foreground">{capability.label}</span>
              <Switch
                checked={current?.enabled ?? true}
                onCheckedChange={(enabled) => void toggle(capability.id, enabled)}
                aria-label={`Habilitar ${capability.label}`}
                size="sm"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
