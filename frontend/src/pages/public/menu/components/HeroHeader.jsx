import React, { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useIsLowEndDevice } from "@/hooks/useIsLowEndDevice";
import shared from "../styles/shared.module.css";
import styles from "./HeroHeader.module.css";

function clamp(n, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function parseHexColor(input) {
  const v = String(input || "").trim();
  if (!v.startsWith("#")) return null;
  if (v.length !== 7 && v.length !== 9) return null;
  const hex = v.slice(1);
  if (!/^[0-9a-f]+$/i.test(hex)) return null;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return { r, g, b };
}

function relativeLuminance({ r, g, b }) {
  const srgb = [r, g, b].map((x) => x / 255);
  const lin = srgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function guessTextColors(bgHex) {
  const rgb = parseHexColor(bgHex);
  if (!rgb) return null;
  const lum = relativeLuminance(rgb);
  const darkBg = lum < 0.35;
  return darkBg
    ? { text: "rgba(255,255,255,0.96)", muted: "rgba(255,255,255,0.70)" }
    : { text: "rgba(12,7,3,0.96)", muted: "rgba(12,7,3,0.60)" };
}

const DEFAULT_CONFIG = {
  backgroundMode: "gradient",
  bgSolid: "#FFF3E6",
  bgGradient: ["#FFF3E6", "#FFE1B8"],
  accentColor: "#F39A1E",
  badgeShape: "circle",
  badgeBlur: 14,
  badgeOpacity: 0.78,
  badgeBorderOpacity: 0.35,
  logoSize: 76,
  glowStrength: 0.55,
  glowRadius: 26,
  fadeStrength: 0.75,
  paddingTop: 18,
  paddingBottom: 22,
  radius: 26,
};

export function HeroHeader({ config, restaurantName, subtitle, logoSrc, tableId, tableLabel, rightSlot }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const lowEnd = useIsLowEndDevice();

  const normalized = useMemo(() => {
    const raw = config && typeof config === "object" ? config : {};
    const backgroundMode = raw.backgroundMode === "solid" ? "solid" : "gradient";
    const bgSolid = typeof raw.bgSolid === "string" ? raw.bgSolid : DEFAULT_CONFIG.bgSolid;
    const bgGradient = Array.isArray(raw.bgGradient) && raw.bgGradient.length === 2 ? raw.bgGradient : DEFAULT_CONFIG.bgGradient;
    const accentColor = typeof raw.accentColor === "string" ? raw.accentColor : DEFAULT_CONFIG.accentColor;
    const badgeShape =
      raw.badgeShape === "rounded" || raw.badgeShape === "squircle" || raw.badgeShape === "circle"
        ? raw.badgeShape
        : DEFAULT_CONFIG.badgeShape;

    const badgeBlur = prefersReducedMotion || lowEnd ? 0 : clamp(raw.badgeBlur ?? DEFAULT_CONFIG.badgeBlur, 0, 24);
    const badgeOpacity = clamp(raw.badgeOpacity ?? DEFAULT_CONFIG.badgeOpacity, 0, 1);
    const badgeBorderOpacity = clamp(raw.badgeBorderOpacity ?? DEFAULT_CONFIG.badgeBorderOpacity, 0, 1);
    const logoSize = clamp(raw.logoSize ?? DEFAULT_CONFIG.logoSize, 40, 120);

    const glowStrength = prefersReducedMotion || lowEnd ? 0 : clamp(raw.glowStrength ?? DEFAULT_CONFIG.glowStrength, 0, 1);
    const glowRadius = clamp(raw.glowRadius ?? DEFAULT_CONFIG.glowRadius, 0, 60);
    const fadeStrength = clamp(raw.fadeStrength ?? DEFAULT_CONFIG.fadeStrength, 0, 1);
    const paddingTop = clamp(raw.paddingTop ?? DEFAULT_CONFIG.paddingTop, 0, 40);
    const paddingBottom = clamp(raw.paddingBottom ?? DEFAULT_CONFIG.paddingBottom, 0, 48);
    const radius = clamp(raw.radius ?? DEFAULT_CONFIG.radius, 0, 40);

    const bg1 = backgroundMode === "solid" ? bgSolid : bgGradient[0] || bgSolid;
    const bg2 = backgroundMode === "solid" ? bgSolid : bgGradient[1] || bgSolid;
    const inferred = guessTextColors(bg1);
    const accentRgb = parseHexColor(accentColor);
    const accentRgbCss = accentRgb ? `${accentRgb.r},${accentRgb.g},${accentRgb.b}` : undefined;

    return {
      backgroundMode,
      bg1,
      bg2,
      bgSolid,
      accentColor,
      accentRgbCss,
      badgeShape,
      badgeBlur,
      badgeOpacity,
      badgeBorderOpacity,
      logoSize,
      glowStrength,
      glowRadius,
      fadeStrength,
      paddingTop,
      paddingBottom,
      radius,
      inferredText: inferred?.text || undefined,
      inferredMuted: inferred?.muted || undefined,
    };
  }, [config, lowEnd, prefersReducedMotion]);

  const style = useMemo(
    () => ({
      "--hh-bg1": normalized.bg1,
      "--hh-bg2": normalized.bg2,
      "--hh-accent": normalized.accentColor,
      "--hero-accent-rgb": normalized.accentRgbCss,
      "--hh-logo-size": `${Math.round(normalized.logoSize)}px`,
      "--hh-glow": String(normalized.glowStrength),
      "--hh-glow-radius": `${Math.round(normalized.glowRadius)}px`,
      "--hh-fade": String(normalized.fadeStrength),
      "--hh-badge-blur": `${Math.round(normalized.badgeBlur)}px`,
      "--hh-badge-opacity": String(normalized.badgeOpacity),
      "--hh-badge-border-opacity": String(normalized.badgeBorderOpacity),
      "--hh-padding-top": `${Math.round(normalized.paddingTop)}px`,
      "--hh-padding-bottom": `${Math.round(normalized.paddingBottom)}px`,
      "--hh-radius": `${Math.round(normalized.radius)}px`,
      "--hh-text": normalized.inferredText,
      "--hh-muted": normalized.inferredMuted,
    }),
    [normalized]
  );

  return (
    <header
      className={styles.heroHeader}
      style={style}
      data-mode={normalized.backgroundMode}
      data-badge-shape={normalized.badgeShape}
      data-perf={lowEnd ? "low" : "high"}
      data-motion={prefersReducedMotion ? "reduced" : "full"}
    >
      <div className={shared.container}>
        <div className={styles.topRow}>
          <div className={styles.left} aria-hidden="true" />
          <div className={styles.right}>{rightSlot}</div>
        </div>

        <div className={styles.center}>
          <div className={styles.logoWrap} aria-hidden={logoSrc ? "false" : "true"}>
            {logoSrc ? (
              <img
                src={logoSrc}
                alt={restaurantName || ""}
                className={styles.logo}
                loading="lazy"
                decoding="async"
                draggable="false"
                width={Math.round(normalized.logoSize)}
                height={Math.round(normalized.logoSize)}
              />
            ) : (
              <Sparkles className={styles.logoFallback} aria-hidden="true" />
            )}
          </div>

          <h1 className={styles.title}>{restaurantName}</h1>
          {subtitle ? <div className={styles.subtitle}>{subtitle}</div> : null}

          {tableId ? (
            <div className={styles.tableChip}>
              <span className={styles.tableChipLabel}>{tableLabel || "Table"}</span>
              <span className={styles.tableChipValue}>{tableId}</span>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
