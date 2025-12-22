const ASSET_GLOB = import.meta.glob("./assets/*.{svg,png,jpg,jpeg,webp,avif}", {
  eager: true,
  import: "default",
});

const EXT_PRIORITY = {
  avif: 6,
  webp: 5,
  png: 4,
  jpg: 3,
  jpeg: 3,
  svg: 1,
};

function getBaseName(path) {
  const filename = String(path).split("/").pop() || "";
  return filename.replace(/\.[^/.]+$/, "");
}

function getExt(path) {
  const filename = String(path).split("/").pop() || "";
  const idx = filename.lastIndexOf(".");
  if (idx === -1) return "";
  return filename.slice(idx + 1).toLowerCase();
}

const ASSET_BY_BASE = Object.entries(ASSET_GLOB).reduce((acc, [path, url]) => {
  const base = getBaseName(path);
  const ext = getExt(path);
  const score = EXT_PRIORITY[ext] || 0;
  const existing = acc[base];
  if (!existing || score > existing.score) acc[base] = { url, score };
  return acc;
}, {});

export function getMenuAsset(baseName) {
  if (!baseName) return null;
  return ASSET_BY_BASE[String(baseName)]?.url || null;
}

const KIND_TO_ASSET = {
  beef: "beef",
  chicken: "chicken",
  fries: "fries",
  wings: "wings",
  drinks: "drinks",
  meals: "meals",
};

export function getPillArtForCategory(category, kind) {
  const id = Number(category?.id);
  if (Number.isFinite(id)) {
    const byId = getMenuAsset(`category-${id}`);
    if (byId) return byId;
  }

  const base = KIND_TO_ASSET[kind];
  const byKind = base ? getMenuAsset(base) : null;
  if (byKind) return byKind;

  if (kind === "beef" || kind === "meals") return getMenuAsset("burger");
  return null;
}

