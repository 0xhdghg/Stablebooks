"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signin, signout, signup } from "../../lib/api";
import { getSessionToken, SESSION_COOKIE, resolveDestination } from "../../lib/session";

function fail(path: string, error: string) {
  redirect(`${path}?error=${encodeURIComponent(error)}`);
}

export async function signupAction(formData: FormData) {
  try {
    const session = await signup({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? "")
    });
    (await cookies()).set(SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/"
    });
    redirect(resolveDestination(session));
  } catch (error) {
    fail("/signup", error instanceof Error ? error.message : "Unable to create account.");
  }
}

export async function signinAction(formData: FormData) {
  try {
    const session = await signin({
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? "")
    });
    (await cookies()).set(SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/"
    });
    redirect(resolveDestination(session));
  } catch (error) {
    fail("/signin", error instanceof Error ? error.message : "Unable to sign in.");
  }
}

export async function signoutAction() {
  const token = await getSessionToken();

  if (token) {
    try {
      await signout(token);
    } catch {
      // Best-effort signout is enough for the shell action.
    }
  }

  (await cookies()).delete(SESSION_COOKIE);
  redirect("/signin");
}
