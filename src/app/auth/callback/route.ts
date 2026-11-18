import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";

/** Only same-origin relative paths are accepted as the post-login destination. */
function safeNextPath(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function redirectToLogin(origin: string, message: string) {
  const url = new URL("/login", origin);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

/**
 * Finishes OAuth (Google) and password-recovery flows: exchanges the PKCE code
 * for a session cookie and sends the user to `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  if (!code) return redirectToLogin(origin, "Link inválido ou expirado. Tente novamente.");

  const supabase = await getSupabaseServerClient();
  if (!supabase) return redirectToLogin(origin, "Autenticação indisponível.");

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return redirectToLogin(origin, "Link inválido ou expirado. Tente novamente.");

  return NextResponse.redirect(new URL(safeNextPath(searchParams.get("next")), origin));
}
