import { backendClient } from "./client";

export type AuthUser = { id: string; email: string | null };

function toUser(user: { id: string; email?: string | null } | null): AuthUser | null {
  return user ? { id: user.id, email: user.email ?? null } : null;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const { data, error } = await backendClient.auth.getUser();
  if (error) return null;
  return toUser(data.user);
}

/**
 * The current session's access token, for the one caller that cannot rely on
 * the middleware: a server FUNCTION gets its bearer token attached
 * automatically by `attachSupabaseAuth`, but a plain `fetch` to an HTTP route
 * (src/routes/api/*) does not, so it has to send the header itself.
 *
 * Null when nobody is signed in; the route answers 401 either way.
 */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await backendClient.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function signInWithPassword(email: string, password: string) {
  const { error } = await backendClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUpWithPassword(email: string, password: string) {
  const { data, error } = await backendClient.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/roster` },
  });
  if (error) throw error;
  return { needsEmailConfirmation: data.session === null };
}

export async function signInWithGoogle() {
  const { lovable } = await import("@/integrations/lovable/index");
  const result = await lovable.auth.signInWithOAuth("google", {
    redirect_uri: window.location.origin,
  });
  if (result.error) throw result.error;
  return { redirected: Boolean(result.redirected) };
}

export async function sendPasswordReset(email: string) {
  const { error } = await backendClient.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await backendClient.auth.signOut();
  if (error) throw error;
}

export function onAuthChange(cb: (user: AuthUser | null) => void) {
  const { data } = backendClient.auth.onAuthStateChange((_event, session) => {
    cb(toUser(session?.user ?? null));
  });
  return () => data.subscription.unsubscribe();
}
