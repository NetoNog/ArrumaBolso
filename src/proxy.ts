import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const LOGIN_PATH = "/login";
/** Routes reachable without a session. */
const PUBLIC_PATHS = new Set([LOGIN_PATH, "/marca"]);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Optimistic auth gate: refreshes the Supabase session cookies and sends
 * visitors without a session to the login screen. Data access itself is still
 * protected by Row Level Security.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.has(pathname);

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    // Without a backend there is no way to sign in: everything leads to the login screen.
    return isPublic ? NextResponse.next() : redirectTo(request, LOGIN_PATH);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
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

  if (!signedIn && !isPublic) return redirectTo(request, LOGIN_PATH, response);
  if (signedIn && pathname === LOGIN_PATH) return redirectTo(request, "/", response);
  return response;
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
