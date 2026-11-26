import { ImageResponse } from "next/og";

export const alt = "ArrumaBolso — Seu dinheiro organizado. Sem planilha e sem susto na fatura.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PILLS = ["Vários bancos", "Quanto pode gastar hoje", "Próximos 12 meses", "App no celular"];

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(135deg, #071233 0%, #0b1b4d 52%, #142c75 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -120,
            top: -120,
            width: 520,
            height: 520,
            borderRadius: "9999px",
            background: "radial-gradient(circle, rgba(59,130,246,0.38) 0%, rgba(59,130,246,0) 70%)",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: "linear-gradient(135deg, #5484ff 0%, #2563eb 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 800,
              boxShadow: "0 12px 30px rgba(37, 99, 235, 0.45)",
            }}
          >
            A
          </div>
          <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em" }}>ArrumaBolso</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 920 }}>
          <div style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.08, letterSpacing: "-0.03em" }}>
            Seu dinheiro organizado. Sem planilha e sem susto na fatura.
          </div>
          <div style={{ fontSize: 26, color: "#cbd5e1", lineHeight: 1.4 }}>
            Acompanhe cartões, parcelas, contas fixas, metas e gastos do seu pet em um só lugar — gratuito e só seu.
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {PILLS.map((pill) => (
            <div
              key={pill}
              style={{
                padding: "10px 20px",
                borderRadius: 9999,
                background: "rgba(255, 255, 255, 0.1)",
                border: "1px solid rgba(147, 197, 253, 0.3)",
                fontSize: 20,
                fontWeight: 600,
                color: "#e0ecff",
              }}
            >
              {pill}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}

