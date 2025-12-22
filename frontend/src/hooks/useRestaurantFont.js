import { useEffect, useMemo, useRef } from "react";

function isFontPath(value) {
  return typeof value === "string" && value.startsWith("fonts/");
}

function getFontFormat(ext) {
  if (ext === "woff2") return "woff2";
  if (ext === "woff") return "woff";
  if (ext === "ttf") return "truetype";
  if (ext === "otf") return "opentype";
  return null;
}

function getExt(path) {
  const filename = String(path || "").split("/").pop() || "";
  const idx = filename.lastIndexOf(".");
  if (idx === -1) return "";
  return filename.slice(idx + 1).toLowerCase();
}

function fontStackForPreset(preset) {
  if (preset === "serif") return 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif';
  if (preset === "sans") return 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, "Noto Sans", sans-serif';
  if (preset === "system") return 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, "Noto Sans", sans-serif';
  return 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif';
}

export function useRestaurantFont(restaurant, fontValue, slot = "base") {
  const menuFont = fontValue;
  const restaurantId = restaurant?.id;
  const loadedRef = useRef({ key: null });

  const computed = useMemo(() => {
    if (!menuFont) return { type: "preset", fontFamily: fontStackForPreset("serif"), cssFamily: null, url: null };
    if (!isFontPath(menuFont)) return { type: "preset", fontFamily: fontStackForPreset(menuFont), cssFamily: null, url: null };
    if (!restaurantId) return { type: "preset", fontFamily: fontStackForPreset("serif"), cssFamily: null, url: null };

    const cssFamily = `qrmenu-font-${restaurantId}-${slot}`;
    const url = `/uploads/${String(menuFont).replace(/^\/+/, "")}`;
    const fontFamily = `"${cssFamily}", ${fontStackForPreset("sans")}`;
    return { type: "uploaded", fontFamily, cssFamily, url };
  }, [menuFont, restaurantId, slot]);

  useEffect(() => {
    if (computed.type !== "uploaded" || !computed.cssFamily || !computed.url) return;
    const loadKey = `${computed.cssFamily}:${computed.url}`;
    if (loadedRef.current.key === loadKey) return;
    loadedRef.current.key = loadKey;

    // Prefer FontFace API (more reliable than injecting <style> on some mobile browsers).
    if (typeof window !== "undefined" && "FontFace" in window && document?.fonts) {
      const face = new FontFace(computed.cssFamily, `url("${computed.url}")`, { display: "swap" });
      face
        .load()
        .then((loaded) => {
          try {
            document.fonts.add(loaded);
          } catch {
            // ignore
          }
        })
        .catch(() => {
          // fallback below
        });
    }

    const ext = getExt(computed.url);
    const format = getFontFormat(ext);
    const styleId = `qrmenu-font-style-${restaurantId}-${slot}`;
    const existing = document.getElementById(styleId);
    if (existing) existing.remove();

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
@font-face {
  font-family: "${computed.cssFamily}";
  src: url("${computed.url}") format("${format || "woff2"}");
  font-display: swap;
}
`;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, [computed.cssFamily, computed.type, computed.url, restaurantId]);

  return computed;
}
