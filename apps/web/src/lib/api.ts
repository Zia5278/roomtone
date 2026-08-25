export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type HealthResponse = {
  status: "ok";
  service: string;
  version: string;
};

export type ReadinessResponse = {
  status: "ready";
  database: "ok";
};

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  const body = (await response.json().catch(() => null)) as
    | { detail?: string }
    | null;

  if (!response.ok) {
    throw new ApiError(
      body?.detail ?? "The server could not complete the request.",
      response.status,
    );
  }

  return body as T;
}

export function getHealth() {
  return apiRequest<HealthResponse>("/health");
}

export function getReadiness() {
  return apiRequest<ReadinessResponse>("/health/ready");
}
