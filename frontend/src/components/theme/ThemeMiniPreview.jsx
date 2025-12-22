import React from "react";
import { ThemeProvider } from "./ThemeProvider";

export function normalizeThemeForProvider(item) {
  const cfg = item?.config_json || item || {};
  return {
    preset_key: item?.preset_key || cfg?.preset_key || "custom",
    name: item?.name || cfg?.name || "Theme",
    vars: cfg?.vars || {},
    category_layout: cfg?.category_layout || "pills",
    transition: cfg?.transition || "slide",
    card_style: cfg?.card_style || "glass",
  };
}

export function ThemeMiniPreview({ theme }) {
  return (
    <ThemeProvider theme={theme} className="rounded-2xl border overflow-hidden">
      <div style={{ background: "var(--menu-background)" }} className="p-3">
        <div
          className="rounded-xl border p-3"
          style={{ background: "var(--menu-surface)", borderColor: "var(--menu-border)", boxShadow: "var(--menu-shadow-soft)" }}
        >
          <div className="text-sm font-semibold" style={{ color: "var(--menu-text-primary)" }}>
            Public Menu
          </div>
          <div className="text-xs" style={{ color: "var(--menu-text-muted)" }}>
            Preview
          </div>
        </div>

        <div className="mt-3 grid gap-2">
          <div
            className="rounded-full px-4 py-3 text-sm font-semibold text-white"
            style={{
              background:
                "linear-gradient(135deg, var(--menu-category-button, var(--menu-accent)) 0%, var(--menu-accent-secondary) 100%)",
            }}
          >
            CATEGORY
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div
            className="rounded-xl border p-3"
            style={{ background: "var(--menu-surface)", borderColor: "var(--menu-border)", boxShadow: "var(--menu-shadow-soft)" }}
          >
            <div className="text-sm font-semibold" style={{ color: "var(--menu-text-primary)" }}>
              Dish
            </div>
            <div className="mt-2 inline-flex rounded px-2 py-1 text-xs font-bold text-white" style={{ background: "var(--menu-accent)" }}>
              $10.50
            </div>
          </div>
          <div
            className="rounded-xl border p-3"
            style={{ background: "var(--menu-surface)", borderColor: "var(--menu-border)", boxShadow: "var(--menu-shadow-soft)" }}
          >
            <div className="text-sm font-semibold" style={{ color: "var(--menu-text-primary)" }}>
              Dish
            </div>
            <div className="mt-2 inline-flex rounded px-2 py-1 text-xs font-bold text-white" style={{ background: "var(--menu-accent-secondary)" }}>
              $8.00
            </div>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}
