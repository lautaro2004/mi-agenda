import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// sendBusinessEmail: Gmail del negocio si está conectado; si no, Resend.
// Se usa el código real (conexión, cifrado, Gmail, Resend); solo cambian la
// base (en memoria) y la red (fetch enrutado por URL).

type Conn = {
  id: string;
  businessId: string;
  userId: string;
  googleEmail: string;
  refreshTokenEnc: string | null;
  scopes: string[];
  status: string;
};
const db = vi.hoisted(() => ({ connections: [] as Conn[] }));

vi.mock("@/lib/prisma", () => {
  const match = (r: Record<string, unknown>, w: Record<string, unknown>) => Object.entries(w).every(([k, v]) => r[k] === v);
  return {
    prisma: {
      business: { findUnique: async ({ where }: { where: { id: string } }) => ({ id: where.id, name: `Negocio ${where.id}` }) },
      membership: {
        findFirst: async ({ where }: { where: { businessId: string } }) => ({
          userId: `owner-${where.businessId}`,
          user: { email: `duenio-${where.businessId}@test.com` },
        }),
      },
      googleConnection: {
        findFirst: async ({ where }: { where: Record<string, unknown> }) => db.connections.find((c) => match(c, where)) ?? null,
        upsert: async ({ create }: { create: Conn }) => {
          db.connections.push({ ...create, id: `gc-${db.connections.length + 1}` });
        },
        updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<Conn> }) => {
          db.connections.filter((c) => match(c, where)).forEach((c) => Object.assign(c, data));
          return { count: 1 };
        },
      },
    },
  };
});

const { sendBusinessEmail } = await import("./send");
const { buildRawMessage } = await import("./gmail");
const { saveConnection } = await import("@/lib/google/connection");
const { FEATURE_SCOPES } = await import("@/lib/google/scopes");

const REFRESH = "1//refresh-super-secreto";
const ACCESS = "ya29.access-super-secreto";
const message = { businessId: "biz-a", to: "cliente@test.com", subject: "Tu turno está confirmado", html: "<p>Hola <b>Ana</b></p>", text: "Hola Ana" };

const res = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body });
let calls: Array<{ url: string; init: RequestInit }>;
let gmailResponse: () => unknown;
let tokenResponse: () => unknown;

function decodeRaw(raw: string): string {
  return Buffer.from(raw, "base64url").toString("utf8");
}

beforeEach(async () => {
  db.connections = [];
  calls = [];
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("EMAIL_FROM", "Nexo <contacto@kodexa.ar>");
  vi.stubEnv("GOOGLE_CLIENT_ID", "cid");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "csecret");
  vi.stubEnv("GOOGLE_REDIRECT_URI", "https://app.test/cb");
  vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 9).toString("base64"));

  tokenResponse = () => res({ access_token: ACCESS, expires_in: 3600 });
  gmailResponse = () => res({ id: "gmail-msg-1" });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (url.includes("oauth2.googleapis.com/token")) return tokenResponse();
      if (url.includes("gmail.googleapis.com")) return gmailResponse();
      if (url.includes("api.resend.com")) return res({ id: "resend-msg-1" });
      throw new Error(`URL inesperada ${url}`);
    })
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
  // Reinicia la caché de access tokens entre tests reconectando.
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function connectOwner(businessId: string, scopes: string[], email = "duenio@gmail.com") {
  await saveConnection({ businessId, userId: `owner-${businessId}` }, { googleEmail: email, refreshToken: REFRESH, scopes });
}

const gmailCalls = () => calls.filter((c) => c.url.includes("gmail.googleapis.com"));
const resendCalls = () => calls.filter((c) => c.url.includes("api.resend.com"));

describe("sendBusinessEmail — Gmail conectado", () => {
  it("envía por Gmail desde la cuenta del dueño y NO usa Resend", async () => {
    await connectOwner("biz-a", ["openid", "email", FEATURE_SCOPES.gmail]);
    const result = await sendBusinessEmail(message);

    expect(result).toMatchObject({ ok: true, provider: "gmail", messageId: "gmail-msg-1" });
    expect(resendCalls()).toHaveLength(0);
    expect(gmailCalls()).toHaveLength(1);

    const [{ init }] = gmailCalls();
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${ACCESS}`);
    const mime = decodeRaw(JSON.parse(init.body as string).raw);
    expect(mime).toContain("From: Negocio biz-a <duenio@gmail.com>");
    expect(mime).toContain("To: cliente@test.com");
    expect(mime).toContain("Content-Type: multipart/alternative");
    expect(mime).toContain("Subject: =?UTF-8?B?"); // asunto con tildes codificado
  });

  it("respeta el reply-to explícito", async () => {
    await connectOwner("biz-a", [FEATURE_SCOPES.gmail]);
    await sendBusinessEmail({ ...message, replyTo: "ventas@negocio.com" });
    const mime = decodeRaw(JSON.parse(gmailCalls()[0].init.body as string).raw);
    expect(mime).toContain("Reply-To: ventas@negocio.com");
  });

  it("no filtra el refresh ni el access token al resultado ni a los logs", async () => {
    await connectOwner("biz-a", [FEATURE_SCOPES.gmail]);
    gmailResponse = () => res({ error: { message: `fallo con ${ACCESS}` } }, false, 500);
    const result = await sendBusinessEmail(message);

    const visible = JSON.stringify([result, (console.error as ReturnType<typeof vi.fn>).mock.calls]);
    expect(visible).not.toContain(REFRESH);
    expect(visible).not.toContain(ACCESS);
    expect(visible).not.toContain("Bearer");
  });
});

describe("sendBusinessEmail — respaldo con Resend", () => {
  it("sin conexión de Google usa Resend con el nombre del negocio y Reply-To al dueño", async () => {
    const result = await sendBusinessEmail(message);
    expect(result).toMatchObject({ ok: true, provider: "resend" });
    expect(gmailCalls()).toHaveLength(0);
    const body = JSON.parse(resendCalls()[0].init.body as string);
    expect(body.from).toBe("Negocio biz-a <contacto@kodexa.ar>");
    expect(body.reply_to).toBe("duenio-biz-a@test.com");
  });

  it("una conexión sin el scope de Gmail (solo Calendar) no se usa para enviar", async () => {
    await connectOwner("biz-a", ["openid", "email", FEATURE_SCOPES.calendar]);
    const result = await sendBusinessEmail(message);
    expect(result).toMatchObject({ provider: "resend" });
    expect(gmailCalls()).toHaveLength(0);
  });

  it("nunca usa la conexión de OTRO negocio", async () => {
    await connectOwner("biz-b", [FEATURE_SCOPES.gmail], "otro@gmail.com");
    const result = await sendBusinessEmail(message); // biz-a
    expect(result).toMatchObject({ provider: "resend" });
    expect(gmailCalls()).toHaveLength(0);
  });

  it("token inválido (invalid_grant): revoca la conexión y cae a Resend", async () => {
    await connectOwner("biz-a", [FEATURE_SCOPES.gmail]);
    tokenResponse = () => res({ error: "invalid_grant" }, false, 400);

    const result = await sendBusinessEmail(message);
    expect(result).toMatchObject({ ok: true, provider: "resend" });
    expect(db.connections[0]).toMatchObject({ status: "revoked", refreshTokenEnc: null });
  });

  it("error de Google (500) o de red: cae a Resend y el email sale igual", async () => {
    await connectOwner("biz-a", [FEATURE_SCOPES.gmail]);
    gmailResponse = () => res({}, false, 500);
    expect(await sendBusinessEmail(message)).toMatchObject({ ok: true, provider: "resend" });

    gmailResponse = () => {
      throw new Error("ECONNRESET");
    };
    expect(await sendBusinessEmail(message)).toMatchObject({ ok: true, provider: "resend" });
  });

  it("si además falla Resend, devuelve el error sin lanzar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res({ message: "dominio no verificado" }, false, 422)));
    expect(await sendBusinessEmail(message)).toEqual({ ok: false, error: "dominio no verificado" });
  });
});

describe("buildRawMessage", () => {
  it("evita la inyección de cabeceras (saltos de línea en asunto/destinatario)", () => {
    const raw = decodeRaw(
      buildRawMessage({
        fromEmail: "a@gmail.com",
        to: "x@test.com\r\nBcc: robo@evil.com",
        subject: "Hola\r\nBcc: robo@evil.com",
        html: "<p>x</p>",
      })
    );
    const headers = raw.split("\r\n\r\n")[0];
    expect(headers.split("\r\n").some((line) => line.startsWith("Bcc:"))).toBe(false);
  });
});
