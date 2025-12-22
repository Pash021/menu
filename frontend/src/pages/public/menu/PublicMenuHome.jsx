import React, { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { sortCategoriesForHome, getCategoryKind } from "./publicMenuUtils";
import { getPillArtForCategory } from "./menuArtwork";
import { TopBrandHeader } from "./components/TopBrandHeader";
import { CategoryPillButton } from "./components/CategoryPillButton";
import { usePublicMenuTheme } from "@/components/theme/ThemeProvider";
import shared from "./styles/shared.module.css";
import styles from "./PublicMenuHome.module.css";

export default function PublicMenuHome({ restaurant, slug, tableId, categories, basePath, mealsAvailable, rightSlot }) {
  const { t } = useI18n();
  const { categoryLayout } = usePublicMenuTheme();

  const ordered = useMemo(() => sortCategoriesForHome(categories), [categories]);

  const pills = useMemo(() => {
    return ordered
      .filter((c) => (c?.dishes || []).length > 0)
      .filter((c) => (mealsAvailable ? getCategoryKind(c) !== "meals" : true))
      .map((c, idx) => {
        const kind = getCategoryKind(c);
        const artSrc = c?.image_url || getPillArtForCategory(c, kind);
        const artPosition = idx % 2 === 0 ? "right" : "left";

        return {
          key: c.id,
          to: `${basePath}/c/${c.id}`,
          label: c.name,
          artSrc,
          artPosition,
        };
      });
  }, [ordered, basePath, mealsAvailable]);

  const layoutClass = categoryLayout === "gridCards" ? styles.grid : categoryLayout === "carousel" ? styles.carousel : styles.pills;
  const pillVariant = categoryLayout === "gridCards" ? "grid" : categoryLayout === "carousel" ? "carousel" : "pill";

  return (
    <div className={styles.page}>
      <TopBrandHeader variant="home" restaurant={restaurant} fallbackTitle={slug} tableId={tableId} rightSlot={rightSlot} />

      <main className={shared.container}>
        <div className={layoutClass}>
          {pills.length ? (
            pills.map((p) => (
              <CategoryPillButton
                key={p.key}
                to={p.to}
                label={p.label}
                artSrc={p.artSrc}
                artPosition={p.artPosition}
                variant={pillVariant}
              />
            ))
          ) : (
            <div className={styles.empty}>{t("public.menu.emptyAll.title")}</div>
          )}
        </div>

      </main>
    </div>
  );
}
