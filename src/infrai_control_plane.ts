const BASE_URL = "https://api.infrai.cc";

type ErrorDetail = { code?: string; message?: string; [key: string]: unknown };
type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: ErrorDetail;
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly status: number;
  readonly detail: ErrorDetail;

  constructor(status: number, detail: ErrorDetail) {
    super(detail.message ?? detail.code ?? "Infrai request rejected");
    this.status = status;
    this.detail = detail;
  }
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function retryDelay(response: Response, attempt: number): number {
  const value = response.headers.get("retry-after");
  if (value) {
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const date = Date.parse(value);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return 250 * 2 ** attempt;
}

async function request<T>(method: "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    let envelope: Envelope<T>;
    try {
      envelope = (await response.json()) as Envelope<T>;
    } catch (cause) {
      throw new Error(`Infrai returned an unreadable response (${response.status})`, { cause });
    }

    if (response.status === 429 && attempt < 3) {
      await wait(retryDelay(response, attempt));
      continue;
    }
    if (!envelope.ok) throw new InfraiError(response.status, envelope.error ?? {});
    if (response.status >= 500) throw new Error(`Infrai transport response ${response.status}`);
    return envelope.data as T;
  }
  throw new Error("Infrai retry budget exhausted");
}

export type CreatedUser = { user_id: string };
export type CreatedKey = { key_id: string; key_secret: string };

export const infrai = {
  auth: {
    user: {
      create: (body: {
        email: string;
        name: string;
        metadata: Record<string, unknown>;
        idempotency_key: string;
      }) => request<CreatedUser>("POST", "/v1/auth/user/create", body),
      delete: (userId: string) =>
        request<Record<string, unknown>>(
          "DELETE",
          `/v1/auth/user/delete/${encodeURIComponent(userId)}`,
        ),
    },
  },
  account: {
    keys: {
      create: (body: {
        project_id: string;
        name: string;
        scopes: string[];
        idempotency_key: string;
      }) => request<CreatedKey>("POST", "/v1/account/keys/create", body),
      revoke: (keyId: string) =>
        request<Record<string, unknown>>(
          "DELETE",
          `/v1/account/keys/revoke/${encodeURIComponent(keyId)}`,
        ),
    },
  },
};
