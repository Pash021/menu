import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useProgressiveList } from "@/hooks/useProgressiveList";
import { useElementSize } from "@/hooks/useElementSize";
import { useMenuCardStyle } from "@/components/menuCard/MenuCardProvider";
import { MenuItemCard } from "./components/MenuItemCard";
import { VirtualizedDishGrid } from "./components/VirtualizedDishGrid";
import { TopBrandHeader } from "./components/TopBrandHeader";
import { getCategoryKind } from "./publicMenuUtils";
import shared from "./styles/shared.module.css";
import styles from "./CategoryPage.module.css";

const HEADER_BY_KIND = {
  beef: "#F39A1E",
  chicken: "#FF7A18",
  fries: "#F15A24",
  wings: "#F15BB5",
  drinks: "#00BBF9",
  meals: "#9B5DE5",
  other: "#F39A1E",
};

const EMPTY_OBJ = {};

function CategoryPage({ restaurant, slug, tableId, category, dishes, backTo, onOpenDish, rightSlot, activeDishId }) {
  const { t } = useI18n();
  const { layout: cardLayout } = useMenuCardStyle();
  const kind = getCategoryKind(category);
  const accentColor = HEADER_BY_KIND[kind] || HEADER_BY_KIND.other;
  const categoryHeaderOverrides = category?.header_style_overrides || EMPTY_OBJ;
  const restaurantHeaderStyle = restaurant?.header_style || restaurant?.computedHeaderStyle || null;
  const restaurantHeaderOverrides = restaurant?.header_style_overrides || restaurant?.headerStyleOverrides || EMPTY_OBJ;

  const mergedHeaderStyle = useMemo(() => {
    if (restaurantHeaderStyle) return { ...restaurantHeaderStyle, ...categoryHeaderOverrides };
    return category?.header_style || null;
  }, [category?.header_style, categoryHeaderOverrides, restaurantHeaderStyle]);

  const hasExplicitHeaderColor = Boolean(categoryHeaderOverrides?.headerColor || restaurantHeaderOverrides?.headerColor);
  const headerStyle =
    mergedHeaderStyle && !hasExplicitHeaderColor ? { ...mergedHeaderStyle, headerColor: accentColor } : mergedHeaderStyle;

  const items = useMemo(() => (Array.isArray(dishes) ? dishes : []), [dishes]);
  const useVirtual = items.length > 50 && cardLayout !== "compact";
  const visibleCount = useProgressiveList(items.length, category?.id, { initial: 18, step: 18 });
  const visibleItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);

  const viewportRef = useRef(null);
  const scrollRef = useRef(null);
  const [scrollElement, setScrollElement] = useState(null);
  const { width: viewportWidth, height: viewportHeight } = useElementSize(viewportRef);

  useEffect(() => {
    if (!category?.id) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [category?.id, scrollElement]);

  const setScrollNode = useCallback((node) => {
    scrollRef.current = node;
    setScrollElement((prev) => (prev === node ? prev : node));
  }, []);

  return (
    <div className={styles.page}>
      <TopBrandHeader
        variant="category"
        restaurant={restaurant}
        fallbackTitle={slug}
        title={category?.name || t("public.category")}
        backTo={backTo}
        rightSlot={rightSlot}
        accentColor={accentColor}
        headerStyle={headerStyle}
        scrollElement={scrollElement}
      />

      <main className={[shared.container, styles.main].join(" ")}>
        {items.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>{t("public.menu.emptyAll.title")}</div>
            <div className={styles.emptyText}>{t("public.menu.emptyAll.desc")}</div>
          </div>
        ) : (
          <div ref={viewportRef} className={styles.viewport} aria-label={category?.name || t("public.category")}>
            {useVirtual && viewportWidth && viewportHeight ? (
              <VirtualizedDishGrid
                className={styles.scroller}
                outerRef={setScrollNode}
                items={items}
                width={viewportWidth}
                height={viewportHeight}
                onOpenDish={onOpenDish}
                activeDishId={activeDishId}
                paddingTop={14}
                paddingBottom={"calc(14px + env(safe-area-inset-bottom))"}
              />
            ) : (
              <div ref={setScrollNode} className={styles.scroller}>
                <section className={cardLayout === "compact" ? styles.gridCompact : styles.grid}>
                  {visibleItems.map((dish) => (
                    <MenuItemCard
                      key={dish.id}
                      dish={dish}
                      onOpen={onOpenDish}
                      isSharedActive={activeDishId != null && Number(dish?.id) === Number(activeDishId)}
                    />
                  ))}
                </section>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default React.memo(CategoryPage);
