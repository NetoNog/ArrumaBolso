import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseEnv } from "@/lib/supabase/env";

const LOGIN_PATH = "/login";
const SIGN_UP_PATH = "/cadastro";
/** Public landing page, served at `/` to visitors without a session. */
const LANDING_PATH = "/apresentacao";
/** Routes reachable without a session. */
const PUBLIC_PATHS = new Set([LOGIN_PATH, SIGN_UP_PATH, LANDING_PATH, "/marca", "/auth/callback"]);
/** Auth screens a signed-in user has no reason to see. */
const AUTH_PATHS = new Set([LOGIN_PATH, SIGN_UP_PATH]);

/**
 * Optimistic auth gate: refreshes the Supabase session cookies, shows the
 * landing page at `/` to visitors without a session (the dashboard otherwise)
 * and sends them to the login screen from any other private route. Data access
 * itself is still protected by Row Level Security.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.has(pathname);

  const env = getSupabaseEnv();
  if (!env) {
    // Without a backend there is no way to sign in: only public pages are reachable.
    if (pathname === "/") return rewriteTo(request, LANDING_PATH);
    return isPublic ? NextResponse.next() : redirectTo(request, LOGIN_PATH);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  // Same URL, different page: anonymous visitors get the landing page at `/`.
  if (!signedIn && pathname === "/") return rewriteTo(request, LANDING_PATH, response);
  if (!signedIn && !isPublic) return redirectTo(request, LOGIN_PATH, response);
  if (signedIn && AUTH_PATHS.has(pathname)) return redirectTo(request, "/", response);
  return response;
}

/** Serves another route under the requested URL, keeping refreshed session cookies. */
function rewriteTo(request: NextRequest, pathname: string, source?: NextResponse) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  const rewrite = NextResponse.rewrite(url, { request });
  for (const cookie of source?.cookies.getAll() ?? []) rewrite.cookies.set(cookie);
  return rewrite;
}

/** Redirects while keeping any refreshed session cookies. */
function redirectTo(request: NextRequest, pathname: string, source?: NextResponse) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  for (const cookie of source?.cookies.getAll() ?? []) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  // Skip Next internals, metadata files and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"],
};
