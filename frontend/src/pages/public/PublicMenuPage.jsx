import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowUp, ChevronDown, Minus, Plus, Search, ShoppingCart, Sparkles, Trash2, UtensilsCrossed } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { callWaiter, getPublicMenu, getPublicRestaurant } from "@/api/menu";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/format";
import { CategoryIcon } from "@/lib/categoryIcons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/modal";
import { DishCard } from "@/components/menu/DishCard";
import { DishDetailsModal } from "@/components/menu/DishDetailsModal";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 420, damping: 32, mass: 0.8 },
  },
};

function MenuSkeleton() {
  return (
    <div className="container py-8">
      <div className="mx-auto max-w-md text-center">
        <LoadingSkeleton className="mx-auto h-24 w-24 rounded-3xl" />
        <LoadingSkeleton className="mx-auto mt-4 h-8 w-56" />
        <LoadingSkeleton className="mx-auto mt-2 h-4 w-72" />
      </div>

      <div className="mt-6 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
        <LoadingSkeleton className="h-11 w-full rounded-2xl" />
        <LoadingSkeleton className="h-11 w-full rounded-2xl sm:w-40" />
      </div>

      <div className="mt-4 flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <LoadingSkeleton key={i} className="h-9 w-28 rounded-full" />
        ))}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card/80 p-3 shadow-sm backdrop-blur">
            <div className="flex gap-3">
              <LoadingSkeleton className="h-16 w-16 rounded-xl" />
              <div className="flex-1 space-y-2">
                <LoadingSkeleton className="h-4 w-2/3" />
                <LoadingSkeleton className="h-3 w-full" />
                <LoadingSkeleton className="h-3 w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PublicMenuPage() {
  const { slug, tableId } = useParams();
  const { lang, t } = useI18n();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [expandedCategoryId, setExpandedCategoryId] = useState(null);
  const [selectedDish, setSelectedDish] = useState(null);
  const [dishDetailsOpen, setDishDetailsOpen] = useState(false);
  const [showToTop, setShowToTop] = useState(false);
  const [compactHeader, setCompactHeader] = useState(false);

  const [waiterOpen, setWaiterOpen] = useState(false);
  const [waiterNote, setWaiterNote] = useState("");
  const [waiterReasons, setWaiterReasons] = useState({
    water: false,
    bill: false,
    help: false,
  });

  const sectionRefs = useRef({});
  const heroSentinelRef = useRef(null);
  const heroChipsRef = useRef(null);
  const stickyChipsRef = useRef(null);

  const cartKey = useMemo(() => {
    if (!slug) return null;
    return tableId ? `qrmenu_cart:${slug}:${tableId}` : `qrmenu_cart:${slug}`;
  }, [slug, tableId]);

  function readCart(key) {
    if (!key) return [];
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item) => {
          const id = Number(item?.id);
          const qty = Number(item?.qty);
          const price = Number(item?.price);
          const currency = typeof item?.currency === "string" ? item.currency : "";
          const name = typeof item?.name === "string" ? item.name : "";
          const image_url = typeof item?.image_url === "string" ? item.image_url : undefined;
          if (!Number.isFinite(id) || id <= 0) return null;
          if (!Number.isFinite(qty) || qty <= 0) return null;
          if (!Number.isFinite(price) || price < 0) return null;
          if (!name) return null;
          return { id, qty, price, currency, name, image_url };
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  function writeCart(key, items) {
    if (!key) return;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(items));
    } catch {
      // ignore
    }
  }

  const [cartOpen, setCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState(() => readCart(cartKey));

  useEffect(() => {
    setCartItems(readCart(cartKey));
  }, [cartKey]);

  useEffect(() => {
    writeCart(cartKey, cartItems);
  }, [cartKey, cartItems]);

  const cartQtyById = useMemo(() => {
    const map = new Map();
    for (const item of cartItems) map.set(item.id, item.qty);
    return map;
  }, [cartItems]);

  const cartCount = useMemo(() => cartItems.reduce((sum, item) => sum + (item.qty || 0), 0), [cartItems]);

  const cartTotal = useMemo(() => {
    if (!cartItems.length) return null;
    const currency = cartItems[0]?.currency;
    if (!currency) return null;
    if (cartItems.some((i) => i.currency !== currency)) return null;
    const total = cartItems.reduce((sum, item) => sum + item.price * item.qty, 0);
    return { total, currency };
  }, [cartItems]);

  function increaseCart(dish) {
    if (!dish?.id) return;
    if (dish.available === false) return;
    const id = Number(dish.id);
    if (!Number.isFinite(id)) return;
    const name = String(dish.name || "");
    const price = Number(dish.price || 0);
    const currency = String(dish.currency || "");
    const image_url = dish.image_url ? String(dish.image_url) : undefined;
    if (!name) return;

    setCartItems((prev) => {
      const idx = prev.findIndex((x) => x.id === id);
      if (idx === -1) return [...prev, { id, qty: 1, name, price, currency, image_url }];
      const next = [...prev];
      next[idx] = { ...next[idx], qty: next[idx].qty + 1, name, price, currency, image_url };
      return next;
    });
  }

  function decreaseCart(dishOrId) {
    const id = typeof dishOrId === "object" ? Number(dishOrId?.id) : Number(dishOrId);
    if (!Number.isFinite(id)) return;
    setCartItems((prev) => {
      const idx = prev.findIndex((x) => x.id === id);
      if (idx === -1) return prev;
      const item = prev[idx];
      const nextQty = item.qty - 1;
      if (nextQty <= 0) return prev.filter((x) => x.id !== id);
      const next = [...prev];
      next[idx] = { ...item, qty: nextQty };
      return next;
    });
  }

  function removeFromCart(id) {
    const parsed = Number(id);
    if (!Number.isFinite(parsed)) return;
    setCartItems((prev) => prev.filter((x) => x.id !== parsed));
  }

  function clearCart() {
    setCartItems([]);
  }

  useEffect(() => {
    function onScroll() {
      setShowToTop(window.scrollY > 700);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (dishDetailsOpen) return;
    if (!selectedDish) return;
    const t = window.setTimeout(() => setSelectedDish(null), 200);
    return () => window.clearTimeout(t);
  }, [dishDetailsOpen, selectedDish]);

  useEffect(() => {
    const el = heroSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setCompactHeader(!entry.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!activeCategoryId) return;
    const id = String(activeCategoryId);

    function scrollChip(container) {
      const btn = container?.querySelector?.(`[data-cat-id="${id}"]`);
      if (btn && typeof btn.scrollIntoView === "function") {
        btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }

    // Important: only scroll the chip row that is currently visible.
    // Otherwise `scrollIntoView` can scroll the whole page vertically.
    if (compactHeader) scrollChip(stickyChipsRef.current);
    else scrollChip(heroChipsRef.current);
  }, [activeCategoryId, compactHeader]);

  const restaurantQuery = useQuery({
    queryKey: ["publicRestaurant", slug, lang],
    queryFn: () => getPublicRestaurant(slug, { lang }),
    enabled: Boolean(slug),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: false,
  });

  const menuQuery = useQuery({
    queryKey: ["publicMenu", slug, lang, tableId || null],
    queryFn: () =>
      getPublicMenu(slug, {
        lang,
        table: tableId || undefined,
      }),
    enabled: Boolean(slug),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: false,
  });

  const waiterMutation = useMutation({
    mutationFn: (payload) => callWaiter(payload),
    onSuccess: () => toast.success(t("public.callWaiter.sent")),
    onError: () => toast.error(t("public.callWaiter.failed")),
  });

  const restaurant = restaurantQuery.data?.restaurant ?? null;
  const categories = menuQuery.data?.categories ?? [];
  const hasTable = Boolean(tableId);
  const menuCategories = useMemo(() => categories.filter((c) => (c?.dishes || []).length > 0), [categories]);

  useEffect(() => {
    if (!menuCategories.length) return;
    setActiveCategoryId((prev) => prev ?? menuCategories[0].id);
  }, [menuCategories]);

  const filteredCategories = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return menuCategories;
    return menuCategories
      .map((c) => {
        let dishes = c.dishes || [];
        if (q) {
          dishes = dishes.filter((d) => {
            const haystack = `${d.name || ""} ${d.description || ""}`.toLowerCase();
            return haystack.includes(q);
          });
        }
        return { ...c, dishes };
      })
      .filter((c) => (c.dishes || []).length > 0);
  }, [menuCategories, debouncedSearch]);

  const isFiltering = Boolean(debouncedSearch.trim());
  const chipCategories = isFiltering ? filteredCategories : menuCategories;

  useEffect(() => {
    if (!chipCategories.length) {
      setActiveCategoryId(null);
      return;
    }
    setActiveCategoryId((prev) => {
      if (prev && chipCategories.some((c) => c.id === prev)) return prev;
      return chipCategories[0].id;
    });
  }, [chipCategories]);

  useEffect(() => {
    if (!expandedCategoryId) return;
    if (!filteredCategories.some((c) => c.id === expandedCategoryId)) setExpandedCategoryId(null);
  }, [expandedCategoryId, filteredCategories]);

  // NOTE: We intentionally do NOT auto-switch the active category while the user scrolls.
  // The active chip changes only on user click.

  async function submitWaiter() {
    if (!hasTable) return;
    const items = [];
    if (waiterReasons.water) items.push(t("public.callWaiter.water"));
    if (waiterReasons.bill) items.push(t("public.callWaiter.bill"));
    if (waiterReasons.help) items.push(t("public.callWaiter.help"));
    if (waiterNote.trim()) items.push({ note: waiterNote.trim() });

    await waiterMutation.mutateAsync({
      slug,
      table: tableId,
      items,
    });

    setWaiterOpen(false);
    setWaiterNote("");
    setWaiterReasons({ water: false, bill: false, help: false });
  }

  if (restaurantQuery.isLoading || menuQuery.isLoading) return <MenuSkeleton />;

  if (restaurantQuery.isError || menuQuery.isError) {
    return (
      <div className="container py-10">
        <EmptyState
          icon={UtensilsCrossed}
          title={t("common.error")}
          description={t("public.menu.loadFailed")}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Sticky mini-header after scroll */}
      <AnimatePresence>
        {compactHeader ? (
          <motion.div
            initial={{ y: -14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -14, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed inset-x-0 top-0 z-40 border-b bg-background/70 pt-safe backdrop-blur-md shadow-sm"
          >
            <div className="container flex h-16 items-center gap-3">
              <div className="flex min-w-0 items-center gap-2">
                {restaurant?.logo_url ? (
                  <img
                    src={restaurant.logo_url}
                    alt={restaurant.name}
                    className="h-9 w-9 rounded-2xl border object-cover"
                    loading="lazy"
                    width={72}
                    height={72}
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl border bg-card/70">
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{restaurant?.name ?? slug}</div>
                  {hasTable ? (
                    <div className="truncate text-xs text-muted-foreground">
                      {t("public.table")}: <span className="font-medium text-foreground">{tableId}</span>
                    </div>
                  ) : (
                    <div className="truncate text-xs text-muted-foreground">{t("public.welcome")}</div>
                  )}
                </div>
              </div>

              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("common.searchDish")}
                  className="h-11 rounded-2xl pl-9"
                />
              </div>

              <LanguageSwitcher />
              <ThemeToggle />
            </div>

            <div className="container pb-3">
              <div ref={stickyChipsRef} className="flex gap-2 overflow-x-auto overflow-y-hidden pb-1 no-scrollbar">
                {chipCategories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setActiveCategoryId(c.id);
                      setExpandedCategoryId(c.id);
                      const el = sectionRefs.current[c.id];
                      el?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    data-cat-id={c.id}
                    className={[
                      "shrink-0 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors active:scale-95",
                      activeCategoryId === c.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card/70 hover:bg-card",
                    ].join(" ")}
                  >
                    {c.icon_name ? <CategoryIcon name={c.icon_name} className="h-4 w-4" /> : null}
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Hero header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 left-1/2 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute -top-12 right-[-6rem] h-64 w-64 rounded-full bg-amber-300/10 blur-3xl" />
        </div>

        <div className="container relative pt-8 pb-5">
          <div className="flex items-start justify-end gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>

          <div className="mx-auto mt-2 max-w-md text-center">
            {restaurant?.logo_url ? (
              <img
                src={restaurant.logo_url}
                alt={restaurant.name}
                className="mx-auto h-24 w-24 rounded-3xl border bg-card object-cover shadow-sm"
                loading="lazy"
                width={192}
                height={192}
              />
            ) : (
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl border bg-card/70 shadow-sm backdrop-blur">
                <Sparkles className="h-6 w-6 text-muted-foreground" />
              </div>
            )}

            <h1 className="mt-4 text-2xl font-semibold tracking-tight">{restaurant?.name ?? slug}</h1>
            <div className="mt-1 text-sm text-muted-foreground">
              {restaurant?.description ? restaurant.description : t("public.welcome")}
            </div>

            {hasTable ? (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
                <span>{t("public.table")}</span>
                <span className="font-semibold text-foreground">{tableId}</span>
              </div>
            ) : null}
          </div>

          <div className="mx-auto mt-6 grid max-w-xl gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("common.searchDish")}
                className="h-11 rounded-2xl pl-9"
              />
            </div>

            <div className="sm:flex sm:justify-end">
              {hasTable ? (
                <Button
                  type="button"
                  className="h-11 w-full rounded-2xl sm:w-auto"
                  onClick={() => setWaiterOpen(true)}
                  disabled={waiterMutation.isPending}
                >
                  {t("public.callWaiter")}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mx-auto mt-4 max-w-xl">
            <div ref={heroChipsRef} className="flex gap-2 overflow-x-auto overflow-y-hidden pb-1 no-scrollbar">
              {chipCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setActiveCategoryId(c.id);
                    setExpandedCategoryId(c.id);
                    const el = sectionRefs.current[c.id];
                    el?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  data-cat-id={c.id}
                  className={[
                    "shrink-0 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors active:scale-95",
                    activeCategoryId === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-card/70 hover:bg-card",
                  ].join(" ")}
                >
                  {c.icon_name ? <CategoryIcon name={c.icon_name} className="h-4 w-4" /> : null}
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div ref={heroSentinelRef} className="h-0.5" />
        </div>
      </div>

      <div className="container pb-10 pt-6">
        {menuCategories.length === 0 ? (
          <EmptyState icon={UtensilsCrossed} title={t("public.menu.emptyAll.title")} description={t("public.menu.emptyAll.desc")} />
        ) : filteredCategories.length === 0 ? (
          <EmptyState icon={UtensilsCrossed} title={t("public.menu.noResults.title")} description={t("public.menu.noResults.desc")} />
        ) : (
          <div className="space-y-10">
            {filteredCategories.map((c) => (
              (() => {
                const dishes = c.dishes || [];
                const isExpanded = expandedCategoryId === c.id;
                const previewDish = dishes.find((d) => d?.image_url) || dishes[0] || null;
                const extraCount = Math.max(0, dishes.length - 1);

                return (
              <section
                key={c.id}
                data-category-id={c.id}
                ref={(el) => {
                  if (el) sectionRefs.current[c.id] = el;
                }}
                className="scroll-mt-48"
              >
                <button
                  type="button"
                  className="w-full rounded-2xl border bg-card/70 px-4 py-3 text-left shadow-sm backdrop-blur transition-colors hover:bg-card active:scale-[0.99]"
                  onClick={() => {
                    setActiveCategoryId(c.id);
                    setExpandedCategoryId((prev) => (prev === c.id ? null : c.id));
                    if (!isExpanded) {
                      const el = sectionRefs.current[c.id];
                      if (el && typeof el.scrollIntoView === "function") {
                        window.requestAnimationFrame(() => {
                          el.scrollIntoView({ behavior: "smooth", block: "start" });
                        });
                      }
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {c.icon_name ? <CategoryIcon name={c.icon_name} className="h-4 w-4 text-muted-foreground" /> : null}
                        <h2 className="truncate text-base font-semibold">{c.name}</h2>
                        {extraCount > 0 && !isExpanded ? (
                          <span className="shrink-0 rounded-full border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
                            +{extraCount}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{dishes.length}</div>
                    </div>

                    <motion.span
                      className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full border bg-background/60 text-muted-foreground"
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </motion.span>
                  </div>
                </button>

                <div className="mt-3">
                  <AnimatePresence initial={false} mode="wait">
                    {isExpanded ? (
                      <motion.div
                        key="grid"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                        style={{ overflow: "hidden" }}
                      >
                        <motion.div
                          variants={gridVariants}
                          initial="hidden"
                          animate="show"
                          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                        >
                          {dishes.map((d) => (
                            <motion.div key={d.id} variants={cardVariants} layout>
                              <DishCard
                                dish={d}
                                onOpen={(dish) => {
                                  setSelectedDish(dish);
                                  setDishDetailsOpen(true);
                                }}
                              />
                            </motion.div>
                          ))}
                        </motion.div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="preview"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                      >
                        {previewDish ? (
                          <DishCard
                            dish={previewDish}
                            onOpen={(dish) => {
                              setSelectedDish(dish);
                              setDishDetailsOpen(true);
                            }}
                          />
                        ) : null}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </section>
                );
              })()
            ))}
          </div>
        )}
      </div>

      <DishDetailsModal
        dish={selectedDish}
        open={dishDetailsOpen}
        onOpenChange={setDishDetailsOpen}
        quantity={selectedDish ? cartQtyById.get(selectedDish.id) || 0 : 0}
        onIncrease={increaseCart}
        onDecrease={decreaseCart}
      />

      <Dialog open={waiterOpen} onOpenChange={setWaiterOpen}>
        <DialogContent variant="bottom" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("public.callWaiter")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <label className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={waiterReasons.water}
                onChange={(e) => setWaiterReasons((s) => ({ ...s, water: e.target.checked }))}
              />
              {t("public.callWaiter.water")}
            </label>
            <label className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={waiterReasons.bill}
                onChange={(e) => setWaiterReasons((s) => ({ ...s, bill: e.target.checked }))}
              />
              {t("public.callWaiter.bill")}
            </label>
            <label className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={waiterReasons.help}
                onChange={(e) => setWaiterReasons((s) => ({ ...s, help: e.target.checked }))}
              />
              {t("public.callWaiter.help")}
            </label>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t("public.callWaiter.note")} <span className="text-xs text-muted-foreground">({t("common.optional")})</span>
              </label>
              <Input
                value={waiterNote}
                onChange={(e) => setWaiterNote(e.target.value)}
                placeholder={t("public.callWaiter.notePlaceholder")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setWaiterOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={submitWaiter} disabled={waiterMutation.isPending}>
              {waiterMutation.isPending ? t("common.loading") : t("common.send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent variant="bottom" className="max-w-lg p-0 overflow-hidden max-h-[calc(100dvh-1.5rem)] overflow-y-auto">
          <div className="p-6 pb-4">
            <DialogHeader>
              <DialogTitle>{t("public.cart")}</DialogTitle>
            </DialogHeader>
            <div className="mt-1 text-sm text-muted-foreground">
              {hasTable ? (
                <>
                  {t("public.table")}: <span className="font-medium text-foreground">{tableId}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="px-6 pb-6">
            {cartItems.length ? (
              <div className="space-y-2">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border bg-card/70 p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{item.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatMoney(item.price, item.currency)}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-full"
                        onClick={() => decreaseCart(item.id)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center text-sm font-semibold tabular-nums">{item.qty}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-full"
                        onClick={() => setCartItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, qty: x.qty + 1 } : x)))}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-full"
                        onClick={() => removeFromCart(item.id)}
                        aria-label="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border bg-card/70 p-6 text-center text-sm text-muted-foreground">
                {t("public.cart.empty")}
              </div>
            )}

            {cartTotal ? (
              <div className="mt-4 flex items-center justify-between rounded-2xl border bg-card/70 px-4 py-3">
                <div className="text-sm font-medium">{t("public.cart.total")}</div>
                <div className="text-sm font-semibold">{formatMoney(cartTotal.total, cartTotal.currency)}</div>
              </div>
            ) : null}

            <DialogFooter className="mt-5">
              <Button type="button" variant="secondary" onClick={() => setCartOpen(false)}>
                {t("common.close")}
              </Button>
              <Button type="button" variant="destructive" onClick={clearCart} disabled={!cartItems.length}>
                {t("public.cart.clear")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <motion.button
        type="button"
        onClick={() => setCartOpen(true)}
        className="fixed right-4 z-40 inline-flex h-11 items-center gap-2 rounded-full border bg-background/80 px-3 shadow-sm backdrop-blur transition-colors hover:bg-background active:scale-95"
        style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        aria-label={t("public.cart.open")}
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        <ShoppingCart className="h-4 w-4" />
        <span className="min-w-4 text-right text-sm font-semibold tabular-nums">{cartCount}</span>
      </motion.button>

      <AnimatePresence>
        {showToTop ? (
          <motion.button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed right-4 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border bg-background/80 shadow-sm backdrop-blur transition-colors hover:bg-background active:scale-95"
            style={{ bottom: "calc(1rem + env(safe-area-inset-bottom) + 3.25rem)" }}
            aria-label={t("public.toTop")}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <ArrowUp className="h-4 w-4" />
          </motion.button>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
