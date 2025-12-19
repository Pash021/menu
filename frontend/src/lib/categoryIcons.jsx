import React from "react";
import {
  Beef,
  Beer,
  CakeSlice,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Dessert,
  Egg,
  Fish,
  GlassWater,
  IceCream,
  Leaf,
  Milk,
  Pizza,
  Salad,
  Sandwich,
  Soup,
  UtensilsCrossed,
  Wine,
} from "lucide-react";
import { cn } from "@/lib/cn";

const MATERIAL_TO_OPTION = {
  bakery_dining: "croissant",
  local_pizza: "pizza",
  lunch_dining: "sandwich",
  ramen_dining: "soup",
  kebab_dining: "beef",
  icecream: "ice-cream",
  cake: "cake-slice",
  coffee: "coffee",
  emoji_food_beverage: "cup-soda",
  set_meal: "utensils-crossed",
  egg_alt: "egg",
  fish: "fish",
  spa: "leaf",
};

export function normalizeIconName(value) {
  if (!value) return "";
  const raw = String(value).trim();
  const mapped = MATERIAL_TO_OPTION[raw];
  return String(mapped || raw)
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

export const CATEGORY_ICON_OPTIONS = [
  { value: "", label: "Без значка", Icon: null },
  { value: "utensils-crossed", label: "Общее", Icon: UtensilsCrossed },
  { value: "sandwich", label: "Закуски", Icon: Sandwich },
  { value: "salad", label: "Салаты", Icon: Salad },
  { value: "soup", label: "Супы", Icon: Soup },
  { value: "pizza", label: "Пицца", Icon: Pizza },
  { value: "beef", label: "Мясо", Icon: Beef },
  { value: "fish", label: "Рыба", Icon: Fish },
  { value: "leaf", label: "Вегетарианское", Icon: Leaf },
  { value: "egg", label: "Завтрак", Icon: Egg },
  { value: "coffee", label: "Кофе", Icon: Coffee },
  { value: "glass-water", label: "Вода", Icon: GlassWater },
  { value: "cup-soda", label: "Напитки", Icon: CupSoda },
  { value: "milk", label: "Молочные", Icon: Milk },
  { value: "beer", label: "Пиво", Icon: Beer },
  { value: "wine", label: "Вино", Icon: Wine },
  { value: "dessert", label: "Десерты", Icon: Dessert },
  { value: "ice-cream", label: "Мороженое", Icon: IceCream },
  { value: "cake-slice", label: "Торты", Icon: CakeSlice },
  { value: "croissant", label: "Выпечка", Icon: Croissant },
  { value: "cookie", label: "Сладкое", Icon: Cookie },
];

export const CATEGORY_ICON_PRESETS = CATEGORY_ICON_OPTIONS;

const ICON_MAP = Object.fromEntries(
  CATEGORY_ICON_OPTIONS.filter((o) => o.value && o.Icon).map((o) => [o.value, o.Icon])
);

export function getCategoryIcon(iconName) {
  const key = normalizeIconName(iconName);
  return ICON_MAP[key] || null;
}

export function getCategoryIconOption(iconName) {
  const key = normalizeIconName(iconName);
  return CATEGORY_ICON_OPTIONS.find((o) => o.value === key) || CATEGORY_ICON_OPTIONS[0];
}

export function CategoryIcon({ name, className }) {
  const Icon = getCategoryIcon(name);
  if (!Icon) return null;
  return <Icon className={cn("h-4 w-4", className)} aria-hidden="true" />;
}
