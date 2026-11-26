/** Canonical base URL used for metadataBase, sitemap, robots and OpenGraph cards. */
export function getSiteUrl(): URL {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  if (configured) {
    try {
      return new URL(configured.startsWith("http") ? configured : `https://${configured}`);
    } catch {
      // Fall through to localhost fallback.
    }
  }
  return new URL("http://localhost:3000");
}

