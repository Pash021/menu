export const MENU_TOKENS = {
  background: "--menu-background",
  surface: "--menu-surface",
  border: "--menu-border",
  textPrimary: "--menu-text-primary",
  textMuted: "--menu-text-muted",
  accent: "--menu-accent",
  accentSecondary: "--menu-accent-secondary",
  accentTertiary: "--menu-accent-tertiary",
  categoryButton: "--menu-category-button",
  shadow: "--menu-shadow",
  shadowSoft: "--menu-shadow-soft",
  radiusCard: "--menu-radius-card",
  radiusHero: "--menu-radius-hero",
  success: "--menu-success",
  glassBlur: "--menu-glass-blur",
  cardGlow: "--menu-card-glow",
  meal1: "--menu-meal-1",
  meal2: "--menu-meal-2",
  meal3: "--menu-meal-3",
  meal4: "--menu-meal-4",
  meal5: "--menu-meal-5",
  fontBody: "--menu-font-body",
  fontBrand: "--menu-font-brand",
  fontCategory: "--menu-font-category",
  fontItem: "--menu-font-item",
  fontBrandSize: "--menu-font-brand-size",
  fontCategorySize: "--menu-font-category-size",
  fontItemSize: "--menu-font-item-size",
};

const LEGACY_TO_FRIENDLY = {
  "--pm-bg": MENU_TOKENS.background,
  "--pm-card": MENU_TOKENS.surface,
  "--pm-border": MENU_TOKENS.border,
  "--pm-text": MENU_TOKENS.textPrimary,
  "--pm-muted": MENU_TOKENS.textMuted,
  "--pm-accent": MENU_TOKENS.accent,
  "--pm-accent-2": MENU_TOKENS.accentSecondary,
  "--pm-accent-3": MENU_TOKENS.accentTertiary,
  "--pm-category": MENU_TOKENS.categoryButton,
  "--pm-shadow": MENU_TOKENS.shadow,
  "--pm-shadow-soft": MENU_TOKENS.shadowSoft,
  "--pm-radius-lg": MENU_TOKENS.radiusCard,
  "--pm-radius-xl": MENU_TOKENS.radiusHero,
  "--pm-green": MENU_TOKENS.success,
  "--pm-glass-blur": MENU_TOKENS.glassBlur,
  "--pm-glow": MENU_TOKENS.cardGlow,
  "--pm-meal-1": MENU_TOKENS.meal1,
  "--pm-meal-2": MENU_TOKENS.meal2,
  "--pm-meal-3": MENU_TOKENS.meal3,
  "--pm-meal-4": MENU_TOKENS.meal4,
  "--pm-meal-5": MENU_TOKENS.meal5,
  "--pm-font-family": MENU_TOKENS.fontBody,
  "--pm-font-brand-family": MENU_TOKENS.fontBrand,
  "--pm-font-category-family": MENU_TOKENS.fontCategory,
  "--pm-font-item-family": MENU_TOKENS.fontItem,
  "--pm-font-brand-size": MENU_TOKENS.fontBrandSize,
  "--pm-font-category-size": MENU_TOKENS.fontCategorySize,
  "--pm-font-item-size": MENU_TOKENS.fontItemSize,
};

const FRIENDLY_TO_LEGACY = Object.fromEntries(Object.entries(LEGACY_TO_FRIENDLY).map(([k, v]) => [v, k]));

function isVarMap(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

export function normalizeMenuTokenVars(vars) {
  const src = isVarMap(vars) ? vars : {};
  const out = {};

  for (const token of Object.values(MENU_TOKENS)) {
    const v = src[token];
    if (typeof v === "string" && v.trim()) out[token] = v.trim();
  }

  for (const [legacyKey, token] of Object.entries(LEGACY_TO_FRIENDLY)) {
    if (out[token]) continue;
    const v = src[legacyKey];
    if (typeof v === "string" && v.trim()) out[token] = v.trim();
  }

  return out;
}

export function serializeMenuTokenVarsToLegacy(vars) {
  const src = isVarMap(vars) ? vars : {};
  const out = {};

  for (const [token, legacyKey] of Object.entries(FRIENDLY_TO_LEGACY)) {
    const v = src[token];
    if (typeof v === "string" && v.trim()) out[legacyKey] = v.trim();
  }

  // Backward compatible: if callers already passed legacy keys, keep them.
  for (const [k, v] of Object.entries(src)) {
    if (typeof k !== "string" || typeof v !== "string") continue;
    if (!k.startsWith("--pm-")) continue;
    if (!v.trim()) continue;
    // If the same legacy key was already produced from a friendly token, keep the friendly value.
    if (out[k]) continue;
    out[k] = v.trim();
  }

  return out;
}
