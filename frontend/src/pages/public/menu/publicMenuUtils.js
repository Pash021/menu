const PHONE_PATTERN = /(\+?\d[\d\s().-]{7,}\d)/g;

export function getPublicMenuBasePath({ slug, tableId }) {
  if (!slug) return "";
  return tableId ? `/r/${slug}/table/${tableId}` : `/r/${slug}`;
}

export function normalizePhoneNumber(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;
  const trimmed = value.startsWith("+") ? `+${value.slice(1).replace(/[^\d]/g, "")}` : value.replace(/[^\d]/g, "");
  const normalized = trimmed.replace(/^00/, "+");
  if (normalized.replace(/[^\d]/g, "").length < 8) return null;
  return normalized;
}

export function extractPhoneNumbers(text) {
  const input = String(text || "");
  const matches = input.match(PHONE_PATTERN) || [];
  const numbers = matches.map((m) => normalizePhoneNumber(m)).filter(Boolean);
  return Array.from(new Set(numbers));
}

function normalizeUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

export function normalizeInstagram(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const withoutAt = value.replace(/^@/, "");
  const withoutDomain = withoutAt.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^www\./i, "");
  const handle = withoutDomain.replace(/\/+$/g, "");
  if (!handle) return null;
  if (/^instagram\.com\//i.test(handle) || /^www\.instagram\.com\//i.test(handle)) return normalizeUrl(handle);
  return `https://instagram.com/${handle}`;
}

export function normalizeFacebook(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const withoutAt = value.replace(/^@/, "");
  const withoutDomain = withoutAt.replace(/^https?:\/\/(www\.)?facebook\.com\//i, "").replace(/^www\./i, "");
  const handle = withoutDomain.replace(/\/+$/g, "");
  if (!handle) return null;
  if (/^facebook\.com\//i.test(handle) || /^www\.facebook\.com\//i.test(handle)) return normalizeUrl(handle);
  return `https://facebook.com/${handle}`;
}

export function getRestaurantContactTargets(restaurant) {
  const maybePhone = normalizePhoneNumber(restaurant?.phone || restaurant?.phone_number || restaurant?.contact_phone);
  const maybeWhatsApp = normalizePhoneNumber(restaurant?.whatsapp || restaurant?.whatsapp_number || restaurant?.contact_whatsapp);
  const instagram = normalizeInstagram(restaurant?.instagram || restaurant?.instagram_url || restaurant?.contact_instagram);
  const facebook = normalizeFacebook(restaurant?.facebook || restaurant?.facebook_url || restaurant?.contact_facebook);

  if (maybePhone || maybeWhatsApp) {
    return { phone: maybePhone, whatsapp: maybeWhatsApp, instagram, facebook };
  }

  const fromDescription = extractPhoneNumbers(restaurant?.description);
  const fallback = fromDescription[0] || null;
  return { phone: fallback, whatsapp: fallback, instagram, facebook };
}

const KIND_PATTERNS = [
  { kind: "beef", re: [/beef/i, /burger/i, /բուրգեր/i, /տավար/i, /համբուրգեր/i] },
  { kind: "chicken", re: [/chicken/i, /թռչ/i, /հավ/i, /chick/i] },
  { kind: "fries", re: [/fries/i, /fry/i, /potato/i, /կարտոֆ/i, /ֆրի/i] },
  { kind: "wings", re: [/wings?/i, /թև/i, /թեւ/i] },
  { kind: "drinks", re: [/drink/i, /drinks/i, /soda/i, /juice/i, /coffee/i, /beer/i, /wine/i, /խմիչ/i, /ըմպելի/i] },
  { kind: "meals", re: [/meal/i, /combo/i, /set\s*meal/i, /menu\s*set/i, /քոմբո/i, /մենյու/i] },
];

export function getCategoryKind(category) {
  const name = String(category?.name || "");
  const iconName = String(category?.icon_name || "");
  const haystack = `${name} ${iconName}`;
  for (const candidate of KIND_PATTERNS) {
    if (candidate.re.some((re) => re.test(haystack))) return candidate.kind;
  }
  return "other";
}

export function findMealsCategory(categories) {
  const items = Array.isArray(categories) ? categories : [];
  return items.find((c) => getCategoryKind(c) === "meals") || null;
}

export function sortCategoriesForHome(categories) {
  const items = Array.isArray(categories) ? categories : [];
  const order = ["beef", "chicken", "fries", "wings", "meals", "drinks"];
  const keyOf = (c) => order.indexOf(getCategoryKind(c));

  return [...items].sort((a, b) => {
    const aKey = keyOf(a);
    const bKey = keyOf(b);
    const aRank = aKey === -1 ? 999 : aKey;
    const bRank = bKey === -1 ? 999 : bKey;
    if (aRank !== bRank) return aRank - bRank;
    return 0;
  });
}
