import React, { createContext, useContext, useMemo } from "react";
import { useIsLowEndDevice } from "@/hooks/useIsLowEndDevice";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const MenuCardContext = createContext({
  config: null,
  layout: "grid",
  vars: {},
  lowEnd: false,
  prefersReducedMotion: false,
});

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function clamp01(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function normalizeRatio(ratio) {
  if (ratio === "4:3") return "4 / 3";
  if (ratio === "16:9") return "16 / 9";
  return "1 / 1";
}

function normalizeConfig(raw) {
  const cfg = raw && typeof raw === "object" ? raw : {};
  const layout = cfg.layout === "compact" ? "compact" : "grid";
  const imageFit = cfg.imageFit === "contain" ? "contain" : "cover";
  const imageRatio = cfg.imageRatio === "4:3" || cfg.imageRatio === "16:9" || cfg.imageRatio === "1:1" ? cfg.imageRatio : "1:1";
  const imageBgMode = cfg.imageBgMode === "solid" ? "solid" : "gradient";
  const colors = Array.isArray(cfg.imageBgColors) ? cfg.imageBgColors : [];
  const c1 = typeof colors[0] === "string" ? colors[0] : "#FFF0D9";
  const c2 = typeof colors[1] === "string" ? colors[1] : c1;

  return {
    preset: typeof cfg.preset === "string" ? cfg.preset : "warmFood",
    layout,
    cardRadius: clampInt(cfg.cardRadius, 0, 28, 24),
    cardBorderOpacity: clamp01(cfg.cardBorderOpacity, 0.12),
    cardShadow: clamp01(cfg.cardShadow, 0.18),
    imageRatio,
    imageFit,
    imagePadding: clampInt(cfg.imagePadding, 0, 18, 0),
    imageBgMode,
    imageBgColors: [c1, c2],
  };
}

function shadowFromStrength(strength) {
  const s = clamp01(strength, 0.18);
  // 0..1 -> softer shadows, tuned for mobile.
  const a1 = (0.06 + s * 0.12).toFixed(3);
  const a2 = (0.05 + s * 0.10).toFixed(3);
  const y1 = Math.round(10 + s * 14);
  const blur1 = Math.round(22 + s * 26);
  const y2 = Math.round(4 + s * 6);
  const blur2 = Math.round(10 + s * 14);
  return `0 ${y1}px ${blur1}px rgba(12, 7, 3, ${a1}), 0 ${y2}px ${blur2}px rgba(12, 7, 3, ${a2})`;
}

export function MenuCardProvider({ config, className, style, children }) {
  const lowEnd = useIsLowEndDevice();
  const prefersReducedMotion = usePrefersReducedMotion();
  const normalized = useMemo(() => normalizeConfig(config), [config]);

  const effectiveShadow = useMemo(() => {
    if (lowEnd) return shadowFromStrength(Math.min(0.12, normalized.cardShadow));
    return shadowFromStrength(normalized.cardShadow);
  }, [lowEnd, normalized.cardShadow]);

  const vars = useMemo(() => {
    const bg = normalized.imageBgMode === "solid"
      ? normalized.imageBgColors[0]
      : `linear-gradient(135deg, ${normalized.imageBgColors[0]}, ${normalized.imageBgColors[1]})`;

    return {
      "--dish-card-radius": `${normalized.cardRadius}px`,
      "--dish-card-border-opacity": String(normalized.cardBorderOpacity),
      "--dish-card-shadow": effectiveShadow,
      "--dish-image-aspect": normalizeRatio(normalized.imageRatio),
      "--dish-image-fit": normalized.imageFit,
      "--dish-image-padding": `${normalized.imagePadding}px`,
      "--dish-image-bg": bg,
    };
  }, [effectiveShadow, normalized]);

  const value = useMemo(
    () => ({ config: normalized, layout: normalized.layout, vars, lowEnd, prefersReducedMotion }),
    [lowEnd, normalized, prefersReducedMotion, vars]
  );

  return (
    <MenuCardContext.Provider value={value}>
      <div className={className} style={{ ...vars, ...style }}>
        {children}
      </div>
    </MenuCardContext.Provider>
  );
}

export function useMenuCardStyle() {
  return useContext(MenuCardContext);
}

