import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, Route, useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Minus, Plus, ShoppingCart, Trash2, UtensilsCrossed, X } from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence } from "framer-motion";
import { callWaiter, getPublicMenu, getPublicRestaurant } from "@/api/menu";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/modal";
import { DishDetailsRouteModal } from "@/components/menu/DishDetailsRouteModal";
import PublicMenuAnimatedRoutes from "@/routes/PublicMenuAnimatedRoutes";
import { PageCurlWrapper } from "@/components/transitions/PageCurlWrapper";
import { useTransitionDirection } from "@/hooks/useTransitionDirection";
import { useRestaurantFont } from "@/hooks/useRestaurantFont";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { MenuCardProvider } from "@/components/menuCard/MenuCardProvider";

import PublicMenuHome from "./menu/PublicMenuHome";
import CategoryPage from "./menu/CategoryPage";
import MealsPage from "./menu/MealsPage";
import ContactPage from "./menu/ContactPage";
import { PublicMenuLoader } from "./menu/PublicMenuLoader";
import { FloatingActionButton } from "./menu/components/FloatingActionButton";
import { MenuHeaderActions } from "./menu/components/MenuHeaderActions";
import {
  findMealsCategory,
  getPublicMenuBasePath,
  sortCategoriesForHome,
} from "./menu/publicMenuUtils";

import shellStyles from "./menu/PublicMenuShell.module.css";
import styles from "./menu/PublicMenuPage.module.css";

const CartItemRow = React.memo(function CartItemRow({ item, onIncrease, onDecrease, onRemove, isAnimating = false }) {
  const qty = Number(item?.qty || 0);
  const canDecrease = qty > 1;

  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl border bg-card/70 p-2">
      <div className="min-w-0 flex-1">
        <div className={styles.cartItemName}>{item.name}</div>
        <div className="mt-1 text-xs text-muted-foreground">{formatMoney(item.price, item.currency)}</div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 rounded-full"
          onClick={() => (canDecrease ? onDecrease(item.id) : onRemove(item.id))}
          aria-label={canDecrease ? "Decrease" : "Remove"}
          disabled={isAnimating}
        >
          {canDecrease ? <Minus className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
        </Button>
        <span className="w-7 text-center text-sm font-semibold tabular-nums">{qty}</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 rounded-full"
          onClick={() => onIncrease(item.id)}
          aria-label="Increase"
          disabled={isAnimating}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
});

function readPublicStyleCache(slug) {
  if (!slug) return null;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`qrmenu_public_style:${slug}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

const PublicMenuCategoryRoute = React.memo(function PublicMenuCategoryRoute({
  restaurant,
  slug,
  tableId,
  menuCategories,
  navCategories,
  mealsAvailable,
  mealsCategoryId,
  basePath,
  rightSlot,
  activeDishId,
  transitionMode,
}) {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  const pageLocation = useLocation();
  const { prepareTransition } = useTransitionDirection();

  const id = Number(categoryId);
  const category = menuCategories.find((c) => c.id === id) || null;
  const dishes = category?.dishes || [];

  const ids = navCategories.map((c) => c.id);
  const idx = ids.indexOf(id);
  const nextId = idx !== -1 ? ids[idx + 1] : null;

  const goBack = useCallback(() => {
    if (window.history.length > 1) navigate(-1);
    else navigate(basePath);
  }, [basePath, navigate]);

  const openDish = useCallback(
    (dish) => {
      const dishId = Number(dish?.id);
      if (!Number.isFinite(dishId)) return;
      if (!prepareTransition("forward")) return;
      navigate(`${basePath}/dish/${dishId}`, { state: { backgroundLocation: pageLocation } });
    },
    [basePath, navigate, pageLocation, prepareTransition]
  );

  const goNextCategory = useCallback(() => {
    if (!nextId) return;
    navigate(`${basePath}/c/${nextId}`);
  }, [basePath, navigate, nextId]);

  const goMeals = useCallback(() => {
    navigate(`${basePath}/meals`);
  }, [basePath, navigate]);

  if (mealsAvailable && mealsCategoryId && mealsCategoryId === id) return <Navigate to={`${basePath}/meals`} replace />;
  if (!category) return <Navigate to={basePath} replace />;

  return (
    <PageCurlWrapper
      mode={transitionMode}
      enableGestures
      enableArrowKeys
      onSwipeRight={goBack}
      onSwipeLeft={nextId ? goNextCategory : mealsAvailable ? goMeals : undefined}
    >
      <CategoryPage
        restaurant={restaurant}
        slug={slug}
        tableId={tableId}
        category={category}
        dishes={dishes}
        backTo={basePath}
        onOpenDish={openDish}
        rightSlot={rightSlot}
        activeDishId={activeDishId}
      />
    </PageCurlWrapper>
  );
});

const PublicMenuMealsRoute = React.memo(function PublicMenuMealsRoute({
  restaurant,
  slug,
  mealsCategory,
  basePath,
  rightSlot,
  activeDishId,
  transitionMode,
}) {
  const navigate = useNavigate();
  const pageLocation = useLocation();
  const { prepareTransition } = useTransitionDirection();

  const goBack = useCallback(() => {
    if (window.history.length > 1) navigate(-1);
    else navigate(basePath);
  }, [basePath, navigate]);

  const goContact = useCallback(() => navigate(`${basePath}/contact`), [basePath, navigate]);

  const openDish = useCallback(
    (dish) => {
      const dishId = Number(dish?.id);
      if (!Number.isFinite(dishId)) return;
      if (!prepareTransition("forward")) return;
      navigate(`${basePath}/dish/${dishId}`, { state: { backgroundLocation: pageLocation } });
    },
    [basePath, navigate, pageLocation, prepareTransition]
  );

  return (
    <PageCurlWrapper mode={transitionMode} enableGestures enableArrowKeys onSwipeRight={goBack} onSwipeLeft={goContact}>
      <MealsPage
        restaurant={restaurant}
        slug={slug}
        mealsCategory={mealsCategory}
        dishes={mealsCategory?.dishes || []}
        backTo={basePath}
        onOpenDish={openDish}
        rightSlot={rightSlot}
        activeDishId={activeDishId}
      />
    </PageCurlWrapper>
  );
});

function PublicMenuDishModalRoute({ dishById, cartQtyById, onIncrease, onDecrease, basePath }) {
  const { dishId } = useParams();
  const navigate = useNavigate();
  const { prepareTransition } = useTransitionDirection();

  const id = Number(dishId);
  const dish = Number.isFinite(id) ? dishById.get(id) || null : null;

  const close = useCallback(() => {
    if (!prepareTransition("back")) return;
    if (window.history.length > 1) navigate(-1);
    else navigate(basePath);
  }, [basePath, navigate, prepareTransition]);

  useEffect(() => {
    if (dish) return;
    if (window.history.length > 1) navigate(-1);
    else navigate(basePath, { replace: true });
  }, [basePath, dish, navigate]);

  return (
    <DishDetailsRouteModal
      dish={dish}
      quantity={dish ? cartQtyById.get(dish.id) || 0 : 0}
      onIncrease={onIncrease}
      onDecrease={onDecrease}
      onClose={close}
    />
  );
}

export default function PublicMenuPage() {
  const { slug, tableId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { lang, t } = useI18n();
  const cachedStyle = useMemo(() => readPublicStyleCache(slug), [slug]);

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
    if (!cartKey) return;
    const id =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(() => writeCart(cartKey, cartItems), { timeout: 1500 })
        : window.setTimeout(() => writeCart(cartKey, cartItems), 600);

    return () => {
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(id);
      else window.clearTimeout(id);
    };
  }, [cartKey, cartItems]);

  useEffect(() => {
    if (!cartOpen) return undefined;
    if (typeof document === "undefined") return undefined;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, [cartOpen]);

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

  const increaseCartItem = useCallback((id) => {
    const parsed = Number(id);
    if (!Number.isFinite(parsed)) return;
    setCartItems((prev) => prev.map((x) => (x.id === parsed ? { ...x, qty: x.qty + 1 } : x)));
  }, []);

  const decreaseCartItem = useCallback((id) => decreaseCart(id), []);
  const removeCartItem = useCallback((id) => removeFromCart(id), []);
  const clearCartStable = useCallback(() => clearCart(), []);

  const [waiterOpen, setWaiterOpen] = useState(false);
  const [waiterNote, setWaiterNote] = useState("");
  const [waiterReasons, setWaiterReasons] = useState({
    water: false,
    bill: false,
    help: false,
  });

  const restaurantQuery = useQuery({
    queryKey: ["publicRestaurant", slug, lang],
    queryFn: () => getPublicRestaurant(slug, { lang }),
    enabled: Boolean(slug),
    staleTime: 0,
    gcTime: 10 * 60_000,
    refetchOnMount: "always",
    refetchOnReconnect: true,
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
  const publicTheme = restaurant?.theme || null;
  const routeTransitionMode = useMemo(() => {
    const t = publicTheme?.transition;
    if (t === "slide") return "slide";
    if (t === "fade") return "fade";
    if (t === "pageFlip") return "flip";
    if (t === "pageCurlLite") return "flip";
    return "fade";
  }, [publicTheme?.transition]);
  const homeGesturesEnabled = publicTheme?.category_layout !== "carousel";
  const baseFont = useRestaurantFont(restaurant, restaurant?.menu_font, "base");
  const brandFont = useRestaurantFont(restaurant, restaurant?.menu_font_brand || restaurant?.menu_font, "brand");
  const categoryFont = useRestaurantFont(restaurant, restaurant?.menu_font_category || restaurant?.menu_font, "category");
  const itemFont = useRestaurantFont(restaurant, restaurant?.menu_font_item || restaurant?.menu_font, "item");
  const categories = menuQuery.data?.categories ?? [];
  const restaurantFontSize = useMemo(() => {
    const raw = Number(restaurant?.menu_font_size);
    if (!Number.isFinite(raw)) return null;
    if (raw < 12) return 12;
    if (raw > 26) return 26;
    return Math.round(raw);
  }, [restaurant?.menu_font_size]);

  const brandFontSize = useMemo(() => {
    const raw = Number(restaurant?.menu_font_brand_size);
    if (!Number.isFinite(raw)) return null;
    return Math.max(20, Math.min(60, Math.round(raw)));
  }, [restaurant?.menu_font_brand_size]);

  const categoryFontSize = useMemo(() => {
    const raw = Number(restaurant?.menu_font_category_size);
    if (!Number.isFinite(raw)) return null;
    return Math.max(10, Math.min(40, Math.round(raw)));
  }, [restaurant?.menu_font_category_size]);

  const itemFontSize = useMemo(() => {
    const raw = Number(restaurant?.menu_font_item_size);
    if (!Number.isFinite(raw)) return null;
    return Math.max(10, Math.min(28, Math.round(raw)));
  }, [restaurant?.menu_font_item_size]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    if (!restaurantFontSize) return undefined;
    const prev = document.documentElement.style.fontSize;
    document.documentElement.style.fontSize = `${restaurantFontSize}px`;
    return () => {
      document.documentElement.style.fontSize = prev;
    };
  }, [restaurantFontSize]);

  useEffect(() => {
    if (!slug) return;
    if (typeof window === "undefined") return;
    if (!restaurant?.id) return;
    try {
      const key = `qrmenu_public_style:${slug}`;
      const payload = {
        v: 1,
        restaurantId: restaurant.id,
        fontSize: restaurantFontSize || null,
        loaderImageUrl: restaurant?.loading_image_url || null,
        loaderStyle: restaurant?.loading_style || "spinner",
        vars: {
          "--menu-font-body": baseFont.fontFamily,
          "--menu-font-brand": brandFont.fontFamily,
          "--menu-font-category": categoryFont.fontFamily,
          "--menu-font-item": itemFont.fontFamily,
          "--menu-font-brand-size": brandFontSize ? `${brandFontSize}px` : null,
          "--menu-font-category-size": categoryFontSize ? `${categoryFontSize}px` : null,
          "--menu-font-item-size": itemFontSize ? `${itemFontSize}px` : null,
        },
        faces: [baseFont, brandFont, categoryFont, itemFont]
          .filter((f) => f?.type === "uploaded" && f?.cssFamily && f?.url)
          .map((f) => ({ family: f.cssFamily, url: f.url })),
      };
      window.localStorage.setItem(key, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [
    baseFont,
    brandFont,
    brandFontSize,
    categoryFont,
    categoryFontSize,
    itemFont,
    itemFontSize,
    restaurant?.id,
    restaurant?.loading_image_url,
    restaurant?.loading_style,
    restaurantFontSize,
    slug,
  ]);
  const hasTable = Boolean(tableId);
  const menuCategories = useMemo(() => categories.filter((c) => (c?.dishes || []).length > 0), [categories]);
  const mealsCategory = useMemo(() => findMealsCategory(menuCategories), [menuCategories]);
  const mealsAvailable = Boolean((mealsCategory?.dishes || []).length > 0);
  const basePath = useMemo(() => getPublicMenuBasePath({ slug, tableId }), [slug, tableId]);
  const navCategories = useMemo(() => {
    const items = mealsAvailable && mealsCategory ? menuCategories.filter((c) => c.id !== mealsCategory.id) : menuCategories;
    return sortCategoriesForHome(items);
  }, [mealsAvailable, mealsCategory, menuCategories]);
  const activeDishId = useMemo(() => {
    if (!location.state?.backgroundLocation) return null;
    const match = String(location.pathname || "").match(/(?:^|\/)dish\/(\d+)(?:\/|$)/);
    if (!match) return null;
    const id = Number(match[1]);
    return Number.isFinite(id) ? id : null;
  }, [location.pathname, location.state]);
  const dishById = useMemo(() => {
    const map = new Map();
    for (const category of menuCategories) {
      for (const dish of category?.dishes || []) {
        const id = Number(dish?.id);
        if (!Number.isFinite(id)) continue;
        map.set(id, dish);
      }
    }
    return map;
  }, [menuCategories]);

  const headerActionsHome = useMemo(() => <MenuHeaderActions tone="dark" />, []);
  const headerActionsInner = useMemo(() => <MenuHeaderActions tone="light" />, []);

  const goBack = useCallback(() => {
    if (window.history.length > 1) navigate(-1);
    else navigate(basePath);
  }, [basePath, navigate]);

  const homeNextPath = useMemo(() => {
    if (navCategories.length) return `${basePath}/c/${navCategories[0].id}`;
    return null;
  }, [basePath, navCategories]);

  const homeNext = useCallback(() => {
    if (!homeNextPath) return;
    navigate(homeNextPath);
  }, [navigate, homeNextPath]);

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

  const loaderImageUrl = restaurant?.loading_image_url || cachedStyle?.loaderImageUrl || null;
  const loaderVariant = restaurant?.loading_style || cachedStyle?.loaderStyle || "spinner";
  const isFetching = (restaurantQuery.isFetching && !restaurantQuery.isLoading) || (menuQuery.isFetching && !menuQuery.isLoading);
  const [showFetchLoader, setShowFetchLoader] = useState(false);
  useEffect(() => {
    if (!isFetching) {
      setShowFetchLoader(false);
      return undefined;
    }
    const id = window.setTimeout(() => setShowFetchLoader(true), 220);
    return () => window.clearTimeout(id);
  }, [isFetching]);

  if (restaurantQuery.isLoading || menuQuery.isLoading) {
    return (
      <ThemeProvider theme={publicTheme} className={shellStyles.shell}>
        <PublicMenuLoader mode="screen" imageUrl={loaderImageUrl} variant={loaderVariant} />
      </ThemeProvider>
    );
  }

  if (restaurantQuery.isError || menuQuery.isError) {
      return (
        <div className={shellStyles.shell}>
          <div style={{ paddingTop: "env(safe-area-inset-top)" }}>
            <div style={{ width: "min(100%, 1080px)", margin: "0 auto", padding: "24px 16px" }}>
              <EmptyState icon={UtensilsCrossed} title={t("common.error")} description={t("public.menu.loadFailed")} />
            </div>
          </div>
        </div>
      );
    }

  return (
    <ThemeProvider
      theme={publicTheme}
      className={shellStyles.shell}
      style={{
        "--menu-font-body": baseFont.fontFamily,
        "--menu-font-brand": brandFont.fontFamily,
        "--menu-font-category": categoryFont.fontFamily,
        "--menu-font-item": itemFont.fontFamily,
        "--menu-font-brand-size": brandFontSize ? `${brandFontSize}px` : undefined,
        "--menu-font-category-size": categoryFontSize ? `${categoryFontSize}px` : undefined,
        "--menu-font-item-size": itemFontSize ? `${itemFontSize}px` : undefined,
      }}
    >
      <MenuCardProvider config={restaurant?.menu_card?.config || null}>
        <AnimatePresence>
          {showFetchLoader ? <PublicMenuLoader key="pm-fetch-loader" mode="overlay" imageUrl={loaderImageUrl} variant={loaderVariant} /> : null}
        </AnimatePresence>
        <PublicMenuAnimatedRoutes
          lockMs={540}
          modalRoutes={
            <Route
              path="dish/:dishId"
              element={
                <PublicMenuDishModalRoute
                  dishById={dishById}
                  cartQtyById={cartQtyById}
                  onIncrease={increaseCart}
                  onDecrease={decreaseCart}
                  basePath={basePath}
                />
              }
            />
          }
        >
          <Route
            index
            element={
              <PageCurlWrapper
                mode={routeTransitionMode}
                enableGestures={homeGesturesEnabled}
                enableArrowKeys={homeGesturesEnabled}
                onSwipeLeft={homeGesturesEnabled && homeNextPath ? homeNext : undefined}
              >
                <PublicMenuHome
                  restaurant={restaurant}
                  slug={slug}
                  tableId={tableId}
                  categories={menuCategories}
                  basePath={basePath}
                  mealsAvailable={mealsAvailable}
                  rightSlot={headerActionsHome}
                />
              </PageCurlWrapper>
              }
            />
          <Route
            path="c/:categoryId"
            element={
              <PublicMenuCategoryRoute
                restaurant={restaurant}
                slug={slug}
                tableId={tableId}
                menuCategories={menuCategories}
                navCategories={navCategories}
                mealsAvailable={mealsAvailable}
                mealsCategoryId={mealsCategory?.id || null}
                basePath={basePath}
                rightSlot={headerActionsInner}
                activeDishId={activeDishId}
                transitionMode={routeTransitionMode}
              />
            }
          />
          <Route
            path="meals"
            element={
              <PublicMenuMealsRoute
                restaurant={restaurant}
                slug={slug}
                mealsCategory={mealsCategory}
                basePath={basePath}
                rightSlot={headerActionsInner}
                activeDishId={activeDishId}
                transitionMode={routeTransitionMode}
              />
            }
          />
          <Route
            path="contact"
            element={
              <PageCurlWrapper mode="sheet" enableGestures enableArrowKeys onSwipeRight={goBack}>
                <ContactPage
                  restaurant={restaurant}
                  slug={slug}
                  tableId={tableId}
                  backTo={basePath}
                  rightSlot={headerActionsInner}
                  onOpenWaiter={() => setWaiterOpen(true)}
                  waiterPending={waiterMutation.isPending}
                />
              </PageCurlWrapper>
            }
          />
          <Route path="*" element={<Navigate to={basePath} replace />} />
        </PublicMenuAnimatedRoutes>
      </MenuCardProvider>

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
        <DialogContent
          variant="bottom"
          showCloseButton={false}
          className="p-0 max-h-[85dvh] sm:max-h-[min(680px,calc(100dvh-2rem))] overflow-hidden"
        >
          <div className="flex max-h-[85dvh] flex-col sm:max-h-[min(680px,calc(100dvh-2rem))]">
            <div className="px-4 pt-3">
              <div className="mx-auto h-1.5 w-10 rounded-full bg-black/10" aria-hidden="true" />
              <div className="mt-3 flex items-center justify-between gap-3">
                <DialogHeader className="text-left">
                  <DialogTitle className="text-base">{t("public.cart")}</DialogTitle>
                </DialogHeader>
                <DialogClose asChild>
                  <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label={t("common.close")}>
                    <X className="h-5 w-5" />
                  </Button>
                </DialogClose>
              </div>

              {hasTable ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  {t("public.table")}: <span className="font-medium text-foreground">{tableId}</span>
                </div>
              ) : null}
            </div>

            <div className="mt-3 flex-1 overflow-y-auto px-4 pb-4">
              {cartItems.length ? (
                <div className="space-y-2">
                  {cartItems.map((item) => (
                    <CartItemRow
                      key={item.id}
                      item={item}
                      onIncrease={increaseCartItem}
                      onDecrease={decreaseCartItem}
                      onRemove={removeCartItem}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border bg-card/70 p-5 text-center text-sm text-muted-foreground">{t("public.cart.empty")}</div>
              )}
            </div>

            <div className="sticky bottom-0 border-t bg-background/80 backdrop-blur-sm px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
              {cartTotal ? (
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-medium">{t("public.cart.total")}</div>
                  <div className="text-sm font-semibold">{formatMoney(cartTotal.total, cartTotal.currency)}</div>
                </div>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-2 sm:items-center">
                <DialogClose asChild>
                  <Button type="button" className="w-full">
                    {t("common.close")}
                  </Button>
                </DialogClose>
                <Button type="button" variant="destructive" onClick={clearCartStable} disabled={!cartItems.length} className="w-full">
                  {t("public.cart.clear")}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <button
        type="button"
        className={[styles.cartFab, "menuFloatingAction"].join(" ")}
        style={{ "--menu-cart-offset": "86px" }}
        onClick={() => setCartOpen(true)}
        aria-label={t("public.cart.open")}
      >
        <ShoppingCart aria-hidden="true" />
        <span className={styles.cartCount}>{cartCount}</span>
      </button>

      <FloatingActionButton restaurant={restaurant} basePath={basePath} />
    </ThemeProvider>
  );
}
