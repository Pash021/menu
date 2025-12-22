import React from "react";
import { useI18n } from "@/lib/i18n";
import { TopBrandHeader } from "./components/TopBrandHeader";
import { getRestaurantContactTargets } from "./publicMenuUtils";
import shared from "./styles/shared.module.css";
import styles from "./ContactPage.module.css";

export default function ContactPage({ restaurant, slug, tableId, backTo, rightSlot, onOpenWaiter, waiterPending }) {
  const { t } = useI18n();
  const { phone, whatsapp, instagram, facebook } = getRestaurantContactTargets(restaurant);
  const effectiveHeaderStyle = restaurant?.header_style || restaurant?.computedHeaderStyle || null;
  const headerOverrides = restaurant?.header_style_overrides || restaurant?.headerStyleOverrides || {};
  const headerStyle =
    effectiveHeaderStyle && !headerOverrides?.headerColor
      ? { ...effectiveHeaderStyle, headerColor: "#F15BB5" }
      : effectiveHeaderStyle;

  return (
    <div className={styles.page}>
      <TopBrandHeader
        variant="category"
        restaurant={restaurant}
        fallbackTitle={slug}
        title={t("public.contact.title")}
        backTo={backTo}
        rightSlot={rightSlot}
        accentColor="#F15BB5"
        headerStyle={headerStyle}
      />

      <main className={shared.container}>
        <section className={styles.card}>
          <div className={styles.row}>
            <div className={styles.label}>{t("public.contact.restaurant")}</div>
            <div className={styles.value}>{restaurant?.name || slug}</div>
          </div>

          {phone ? (
            <div className={styles.row}>
              <div className={styles.label}>{t("public.contact.phone")}</div>
              <div className={styles.value}>
                <a className={styles.link} href={`tel:${phone}`}>
                  {phone}
                </a>
              </div>
            </div>
          ) : null}

          {whatsapp ? (
            <div className={styles.row}>
              <div className={styles.label}>{t("public.contact.whatsapp")}</div>
              <div className={styles.value}>
                <a
                  className={styles.link}
                  href={`https://wa.me/${whatsapp.replace(/[^\d]/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {whatsapp}
                </a>
              </div>
            </div>
          ) : null}

          {instagram ? (
            <div className={styles.row}>
              <div className={styles.label}>{t("public.contact.instagram")}</div>
              <div className={styles.value}>
                <a className={styles.link} href={instagram} target="_blank" rel="noopener noreferrer">
                  {instagram.replace(/^https?:\/\//i, "")}
                </a>
              </div>
            </div>
          ) : null}

          {facebook ? (
            <div className={styles.row}>
              <div className={styles.label}>{t("public.contact.facebook")}</div>
              <div className={styles.value}>
                <a className={styles.link} href={facebook} target="_blank" rel="noopener noreferrer">
                  {facebook.replace(/^https?:\/\//i, "")}
                </a>
              </div>
            </div>
          ) : null}

          {tableId ? (
            <button
              type="button"
              className={styles.callWaiterButton}
              onClick={onOpenWaiter}
              disabled={waiterPending}
            >
              {waiterPending ? t("common.loading") : t("public.callWaiter")}
            </button>
          ) : null}
        </section>
      </main>
    </div>
  );
}
