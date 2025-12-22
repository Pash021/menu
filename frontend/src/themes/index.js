import burgerOrange from "./presets/burger_orange";
import coffeeMinimal from "./presets/coffee_minimal";
import sushiNeon from "./presets/sushi_neon";

export const themePresets = [burgerOrange, coffeeMinimal, sushiNeon];
export const themePresetByKey = Object.fromEntries(themePresets.map((p) => [p.preset_key, p]));

export function mergeTheme(baseConfig, overrides) {
  const base = baseConfig && typeof baseConfig === "object" ? baseConfig : {};
  const ov = overrides && typeof overrides === "object" ? overrides : {};
  const out = { ...base, ...ov };
  const baseVars = base.vars && typeof base.vars === "object" ? base.vars : {};
  const ovVars = ov.vars && typeof ov.vars === "object" ? ov.vars : {};
  out.vars = { ...baseVars, ...ovVars };
  return out;
}

