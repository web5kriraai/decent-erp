export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public correlationId?: string,
    public details?: unknown,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isConflict() {
    return this.status === 409;
  }

  get isValidationError() {
    return this.status === 400;
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isBusinessRule() {
    return this.status === 422;
  }
}

export type ApiSuccess<T> = {
  data: T;
  correlationId?: string;
};

export type ApiFailure = {
  error: string;
  code?: string;
  correlationId?: string;
  details?: unknown;
};

async function parseResponse<T>(res: Response): Promise<T> {
  const json = (await res.json()) as ApiSuccess<T> & ApiFailure;

  if (!res.ok) {
    throw new ApiClientError(
      json.error ?? `Request failed (${res.status})`,
      res.status,
      json.correlationId,
      json.details,
      json.code,
    );
  }

  return json.data;
}

export async function apiGet<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, method: "GET" });
  return parseResponse<T>(res);
}

export async function apiPost<T>(
  url: string,
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    method: "POST",
    headers: { "Content-Type": "application/json", ...init?.headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return parseResponse<T>(res);
}

export async function apiPatch<T>(
  url: string,
  body: unknown,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...init?.headers },
    body: JSON.stringify(body),
  });
  return parseResponse<T>(res);
}

export async function apiDelete<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, method: "DELETE" });
  return parseResponse<T>(res);
}

export function getFieldErrors(details: unknown): Record<string, string[]> {
  if (!details || typeof details !== "object") return {};
  const flattened = details as { fieldErrors?: Record<string, string[]> };
  return flattened.fieldErrors ?? {};
}
