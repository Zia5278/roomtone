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

export type AvatarColor = "coral" | "blue" | "green" | "purple" | "gold";

export type User = {
  id: string;
  display_name: string;
  avatar_color: AvatarColor;
};

export type SessionResponse = {
  user: User;
};

export type StreamTokenResponse = {
  api_key: string;
  token: string;
  expires_in: number;
  user: User;
};

export type RoomStatus = "backstage" | "live" | "ended";

export type Room = {
  id: string;
  title: string;
  status: RoomStatus;
  host: User;
  is_host: boolean;
  created_at: string;
  went_live_at: string | null;
  ended_at: string | null;
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

export function getCurrentSession() {
  return apiRequest<SessionResponse>("/v1/sessions/me");
}

export function createSession(displayName: string) {
  return apiRequest<SessionResponse>("/v1/sessions", {
    method: "POST",
    body: JSON.stringify({ display_name: displayName }),
  });
}

export function createStreamToken() {
  return apiRequest<StreamTokenResponse>("/v1/stream-token", {
    method: "POST",
  });
}

export function createRoom(title: string) {
  return apiRequest<Room>("/v1/rooms", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export function getRoom(roomId: string) {
  return apiRequest<Room>(`/v1/rooms/${roomId}`);
}

export function goLive(roomId: string) {
  return apiRequest<Room>(`/v1/rooms/${roomId}/live`, {
    method: "POST",
  });
}
