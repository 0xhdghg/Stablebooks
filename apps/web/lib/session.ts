import { cookies, headers } from "next/headers";
import { getMe, SessionPayload } from "./api";

export const SESSION_COOKIE = "stablebooks_session";

export async function getSessionToken() {
  const cookieToken = (await cookies()).get(SESSION_COOKIE)?.value?.trim() ?? null;

  if (cookieToken) {
    return cookieToken;
  }

  const authorization = (await headers()).get("authorization")?.trim() ?? "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    const headerToken = authorization.slice("Bearer ".length).trim();
    if (headerToken) {
      return headerToken;
    }
  }

  return null;
}

export async function getOptionalSession(): Promise<SessionPayload | null> {
  const token = await getSessionToken();
  if (!token) {
    return null;
  }

  try {
    return await getMe(token);
  } catch {
    return null;
  }
}

export function resolveDestination(session: SessionPayload) {
  if (!session.onboarding.hasOrganization) {
    return "/onboarding/org";
  }

  if (!session.onboarding.hasDefaultSettlementWallet) {
    return "/onboarding/wallets";
  }

  return "/dashboard";
}
