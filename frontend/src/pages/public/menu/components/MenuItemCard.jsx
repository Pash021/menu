import React, { useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/format";
import { GlassCard } from "@/components/ui/GlassCard";
import { TiltWrapper } from "@/components/ui/TiltWrapper";
import { useMenuCardStyle } from "@/components/menuCard/MenuCardProvider";
import styles from "./MenuItemCard.module.css";

export const MenuItemCard = React.memo(function MenuItemCard({ dish, onOpen, isSharedActive = false }) {
  const { t } = useI18n();
  const { config: cardConfig } = useMenuCardStyle();
  const unavailable = dish?.available === false;
  const [imgLoaded, setImgLoaded] = useState(false);

  const open = () => {
    if (unavailable) return;
    onOpen?.(dish);
  };

  const layout = cardConfig?.layout || "grid";
  const preset = cardConfig?.preset || "warmFood";
  const imgSrcSet = dish?.image_srcset || null;
  const imgSizes = layout === "compact" ? "(min-width: 640px) 33vw, 96px" : "(min-width: 960px) 25vw, (min-width: 640px) 33vw, 50vw";
  const cardStyle = {
    borderRadius: "var(--dish-card-radius, var(--menu-radius-card))",
    borderColor: "rgba(12, 7, 3, var(--dish-card-border-opacity, 0.12))",
    boxShadow: "var(--dish-card-shadow, var(--menu-shadow-soft))",
  };

  return (
    <TiltWrapper
      role="button"
      tabIndex={0}
      className={styles.tilt}
      aria-disabled={unavailable ? "true" : "false"}
      data-layout={layout}
      data-preset={preset}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
    >
      <GlassCard as="article" className={styles.card} style={cardStyle} data-layout={layout} data-preset={preset}>
        <div className={styles.media} aria-hidden="true">
          {dish?.image_url ? (
            <>
              {!imgLoaded ? <div className={`skeleton ${styles.imgSkeleton}`} /> : null}
              <img
                src={dish.image_url}
                alt={dish?.name || ""}
                className={styles.image}
                loading="lazy"
                decoding="async"
                width={360}
                height={360}
                srcSet={imgSrcSet || undefined}
                sizes={imgSrcSet ? imgSizes : undefined}
                onLoad={() => setImgLoaded(true)}
              />
            </>
          ) : (
            <div className={styles.noImage}>
              <ImageIcon />
            </div>
          )}

          {unavailable ? <div className={styles.unavailable}>{t("dish.badge.unavailable")}</div> : null}
        </div>

        <div className={styles.body}>
          <div className={styles.name}>{dish?.name}</div>
          {dish?.description ? <div className={styles.desc}>{dish.description}</div> : <div className={styles.descMuted}>—</div>}

          <div className={styles.badges} aria-hidden="true">
            {dish?.is_spicy ? <span className={styles.badge}>{t("dish.badge.spicy")}</span> : null}
            {dish?.is_vegan ? <span className={styles.badgeSecondary}>{t("dish.badge.vegan")}</span> : null}
          </div>

          <div className={styles.footer}>
            <div className={styles.priceTag}>{formatMoney(dish?.price || 0, dish?.currency || "")}</div>
          </div>
        </div>
      </GlassCard>
    </TiltWrapper>
  );
});
