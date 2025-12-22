import React, { createContext, useContext, useMemo } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useIsLowEndDevice } from "@/hooks/useIsLowEndDevice";
import { MENU_TOKENS, normalizeMenuTokenVars } from "@/lib/menuDesignTokens";

const ThemeContext = createContext({
  theme: null,
  vars: {},
  categoryLayout: "pills",
  transition: "slide",
  cardStyle: "glass",
  lowEnd: false,
  prefersReducedMotion: false,
});

function normalizeEnum(value, allowed, fallback) {
  const v = String(value || "").trim();
  return allowed.includes(v) ? v : fallback;
}

function normalizeTheme(rawTheme) {
  const theme = rawTheme && typeof rawTheme === "object" ? rawTheme : null;
  const vars = theme?.vars && typeof theme.vars === "object" ? theme.vars : {};
  return {
    preset_key: theme?.preset_key || "burger_orange",
    name: theme?.name || "Theme",
    vars: normalizeMenuTokenVars(vars),
    category_layout: theme?.category_layout || "pills",
    transition: theme?.transition || "slide",
    card_style: theme?.card_style || "glass",
  };
}

export function ThemeProvider({ theme: rawTheme, className, style, children }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const lowEnd = useIsLowEndDevice();
  const normalized = useMemo(() => normalizeTheme(rawTheme), [rawTheme]);

  const categoryLayout = normalizeEnum(normalized.category_layout, ["pills", "gridCards", "carousel"], "pills");
  const transition = normalizeEnum(normalized.transition, ["slide", "fade", "pageFlip", "pageCurlLite"], "slide");
  const cardStyle = normalizeEnum(normalized.card_style, ["glass", "flat", "glow"], "glass");

  const vars = useMemo(() => {
    const out = { ...(normalized.vars || {}) };

    // Theme-controlled blur/visual intensity.
    let blur = cardStyle === "flat" ? 0 : cardStyle === "glow" ? 10 : 12;
    if (lowEnd) blur = Math.min(blur, 8);
    if (prefersReducedMotion) blur = Math.min(blur, 8);
    out[MENU_TOKENS.glassBlur] = `${blur}px`;

    if (cardStyle === "glow") {
      out[MENU_TOKENS.cardGlow] = lowEnd ? "0 0 0 rgba(0,0,0,0)" : "0 0 30px rgba(0, 245, 212, 0.20)";
    } else {
      out[MENU_TOKENS.cardGlow] = "0 0 0 rgba(0,0,0,0)";
    }

    return out;
  }, [normalized.vars, cardStyle, lowEnd, prefersReducedMotion]);

  const value = useMemo(
    () => ({ theme: normalized, vars, categoryLayout, transition, cardStyle, lowEnd, prefersReducedMotion }),
    [normalized, vars, categoryLayout, transition, cardStyle, lowEnd, prefersReducedMotion]
  );

  return (
    <ThemeContext.Provider value={value}>
      <div
        className={className}
        data-menu-theme={normalized.preset_key}
        data-menu-categories={categoryLayout}
        data-menu-transition={transition}
        data-menu-card-style={cardStyle}
        style={{ ...vars, ...style }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function usePublicMenuTheme() {
  return useContext(ThemeContext);
}
