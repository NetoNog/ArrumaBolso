import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/apresentacao", "/privacidade", "/termos", "/login", "/cadastro"],
        disallow: [
          "/auth/",
          "/importar",
          "/lancamentos",
          "/fluxo",
          "/renda",
          "/faturas",
          "/assinaturas",
          "/orcamento",
          "/meu-pet",
          "/projecao",
          "/analises",
          "/fechamento",
          "/regras",
          "/configuracoes",
          "/redefinir-senha",
        ],
      },
    ],
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  };
}

