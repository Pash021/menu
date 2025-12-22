import React from "react";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import shared from "@/pages/public/menu/styles/shared.module.css";
import headerStyles from "@/pages/public/menu/components/TopBrandHeader.module.css";

function clamp01(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function CategoryHeaderPreview({ theme, restaurantName, title, headerStyle }) {
  const effect = headerStyle?.effect || "glowGradient";
  const style = {
    "--category-header-bg": headerStyle?.headerColor || undefined,
    "--category-header-glow": String(clamp01(headerStyle?.glow, 0.55)),
    "--category-header-fade": String(clamp01(headerStyle?.fade, 0.75)),
    "--category-header-shadow": String(clamp01(headerStyle?.shadow, 0.35)),
    "--category-header-radius": `${clampInt(headerStyle?.radius, 0, 40, 24)}px`,
    "--category-header-highlight": headerStyle?.accentColor || undefined,
  };

  return (
    <ThemeProvider theme={theme} className="overflow-hidden rounded-2xl border">
      <div style={{ background: "var(--menu-background)" }}>
        <header className={headerStyles.categoryHeader} style={style} data-effect={effect}>
          <div className={shared.container}>
            <div className={headerStyles.categoryTopRow}>
              <span className={headerStyles.backSpacer} aria-hidden="true" />
              <div className={headerStyles.categoryRight} />
            </div>

            <div className={headerStyles.categoryTitleWrap}>
              <div className={headerStyles.categoryKicker}>{restaurantName || "Restaurant"}</div>
              <h1 className={headerStyles.categoryTitle}>{title || "Category"}</h1>
            </div>
          </div>
          <div className={headerStyles.categoryAccent} aria-hidden="true" />
        </header>
      </div>
    </ThemeProvider>
  );
}
