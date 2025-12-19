const CURRENCY_SYMBOLS = {
  AMD: "֏",
  USD: "$",
  EUR: "€",
  RUB: "₽",
  GBP: "£",
};

export function formatMoney(amount, currency = "AMD") {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) return `${amount} ${symbol}`.trim();
  const fractionDigits = currency === "AMD" ? 0 : 2;
  const formatted = new Intl.NumberFormat("hy-AM", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n);
  return `${formatted} ${symbol}`.trim();
}

