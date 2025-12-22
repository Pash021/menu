import React from "react";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { HeroHeader } from "@/pages/public/menu/components/HeroHeader";

export function HeroHeaderPreview({ theme, config, restaurantName, subtitle, logoUrl }) {
  return (
    <ThemeProvider theme={theme} className="overflow-hidden rounded-2xl border">
      <div style={{ background: "var(--menu-background)" }}>
        <HeroHeader
          config={config}
          restaurantName={restaurantName || "Restaurant"}
          subtitle={subtitle || ""}
          logoSrc={logoUrl || null}
          rightSlot={null}
          tableId={null}
        />
      </div>
    </ThemeProvider>
  );
}
