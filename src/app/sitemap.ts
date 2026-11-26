import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl().toString().replace(/\/$/, "");
  const lastModified = new Date("2026-11-25");

  return [
    { url: `${base}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/apresentacao`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/privacidade`, lastModified, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/termos`, lastModified, changeFrequency: "yearly", priority: 0.4 },
  ];
}

