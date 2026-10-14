export type ErrorCode = "AUTH_REQUIRED" | "NETWORK_ERROR" | "RATE_LIMITED" | "GARMIN_UNAVAILABLE" | "API_ERROR" | "SETUP_REQUIRED" | "LOGIN_BUSY" | "INTERNAL_ERROR";

export class GarminError extends Error {
  constructor(readonly code: ErrorCode, message: string, readonly status?: number, readonly retryAfterSeconds?: number) {
    super(message);
    this.name = "GarminError";
  }
}

export function responseError(response: Response): GarminError {
  const status = response.status;
  if (status === 401 || status === 403) return new GarminError("AUTH_REQUIRED", "Garmin session expired or access was refused. Run authenticate_garmin to sign in again.", status);
  if (status === 429) {
    const raw = response.headers.get("retry-after");
    const seconds = raw === null ? undefined : /^\d+$/.test(raw) ? Number(raw) : Math.max(0, Math.ceil((Date.parse(raw) - Date.now()) / 1000));
    return new GarminError("RATE_LIMITED", "Garmin is limiting requests. Wait before trying again; do not sign in again.", status, Number.isFinite(seconds) ? seconds : undefined);
  }
  if (status >= 500) return new GarminError("GARMIN_UNAVAILABLE", "Garmin is temporarily unavailable. Try again later; your saved session has been kept.", status);
  return new GarminError("API_ERROR", `Garmin rejected the request (HTTP ${status}).`, status);
}

/** Do not reflect transport messages, URLs, cookies, or response bodies to the caller. */
export async function garminFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(15000) });
  } catch {
    throw new GarminError("NETWORK_ERROR", "Could not reach Garmin. Check your connection and try again; your saved session has been kept.");
  }
}
