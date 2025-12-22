import React, { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { HeroHeader } from "./HeroHeader";
import shared from "../styles/shared.module.css";
import styles from "./TopBrandHeader.module.css";

export function TopBrandHeader({
  variant = "home",
  restaurant,
  fallbackTitle,
  title,
  subtitle,
  tableId,
  backTo,
  rightSlot,
  accentColor,
  headerStyle,
  scrollElement,
}) {
  const { t } = useI18n();
  const prefersReducedMotion = usePrefersReducedMotion();
  const headerRef = useRef(null);
  const effectiveTitle = title || restaurant?.name || fallbackTitle || "";
  const effectiveSubtitle = subtitle ?? restaurant?.description ?? t("public.welcome");

  useEffect(() => {
    if (variant !== "category") return undefined;
    const el = headerRef.current;
    if (!el) return undefined;

    let rafId = null;
    const target = scrollElement && typeof scrollElement.addEventListener === "function" ? scrollElement : window;

    const update = () => {
      rafId = null;
      const y = target === window ? window.scrollY || 0 : target.scrollTop || 0;
      const t = Math.max(0, Math.min(1, y / 160));
      el.style.setProperty("--category-header-kicker-opacity", String((1 - t * 0.78).toFixed(3)));
      el.style.setProperty("--category-header-kicker-y", `${(-t * 10).toFixed(1)}px`);
      if (!prefersReducedMotion) {
        el.style.setProperty("--category-header-title-scale", String((1 - t * 0.08).toFixed(3)));
        el.style.setProperty("--category-header-title-y", `${(-t * 6).toFixed(1)}px`);
      }
    };

    const onScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(update);
    };

    target.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      target.removeEventListener("scroll", onScroll);
      window.cancelAnimationFrame(rafId);
    };
  }, [prefersReducedMotion, scrollElement, variant]);

  if (variant === "category") {
    const effect = headerStyle?.effect || "glowGradient";
    const style = {
      "--category-header-bg": headerStyle?.headerColor || accentColor || undefined,
      "--category-header-glow": headerStyle?.glow != null ? String(headerStyle.glow) : undefined,
      "--category-header-fade": headerStyle?.fade != null ? String(headerStyle.fade) : undefined,
      "--category-header-shadow": headerStyle?.shadow != null ? String(headerStyle.shadow) : undefined,
      "--category-header-radius": headerStyle?.radius != null ? `${headerStyle.radius}px` : undefined,
      "--category-header-highlight": headerStyle?.accentColor || undefined,
    };

    return (
      <header
        ref={headerRef}
        className={styles.categoryHeader}
        style={style}
        data-effect={effect}
      >
        <div className={shared.container}>
          <div className={styles.categoryTopRow}>
            <span className={styles.backSpacer} aria-hidden="true" />
            <div className={styles.categoryRight}>{rightSlot}</div>
          </div>

          <div className={styles.categoryTitleWrap}>
            <div className={styles.categoryKicker}>{restaurant?.name || fallbackTitle}</div>
            <h1 className={styles.categoryTitle}>{effectiveTitle}</h1>
          </div>
        </div>
        <div className={styles.categoryAccent} aria-hidden="true" />
      </header>
    );
  }

  const heroConfig = restaurant?.hero?.config || null;

  return (
    <HeroHeader
      config={heroConfig}
      restaurantName={effectiveTitle}
      subtitle={effectiveSubtitle}
      logoSrc={restaurant?.logo_url || null}
      tableId={tableId}
      tableLabel={t("public.table")}
      rightSlot={rightSlot}
    />
  );
}
