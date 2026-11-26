import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "ArrumaBolso",
    short_name: "ArrumaBolso",
    description: "Faturas, parcelas, assinaturas, Meu Pet e projeção de 12 meses em um painel só.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F6F8FC",
    theme_color: "#4070F4",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Lançamentos", short_name: "Lançamentos", url: "/lancamentos" },
      { name: "Faturas & Parcelas", short_name: "Faturas", url: "/faturas" },
      { name: "Meu Pet", short_name: "Meu Pet", url: "/meu-pet" },
      { name: "Fechamento do Mês", short_name: "Fechamento", url: "/fechamento" },
    ],
  };
}
