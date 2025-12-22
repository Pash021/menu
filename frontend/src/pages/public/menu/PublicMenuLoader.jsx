import React from "react";
import { motion } from "framer-motion";
import styles from "./PublicMenuLoader.module.css";
import { useI18n } from "@/lib/i18n";

function safeVariant(raw) {
  const v = String(raw || "").trim();
  if (v === "dots" || v === "ring" || v === "spinner") return v;
  return "spinner";
}

export function PublicMenuLoader({ mode = "screen", imageUrl = null, variant = "spinner", label }) {
  const { t } = useI18n();
  const v = safeVariant(variant);
  const ariaLabel = label || t("common.loading");
  const hasImage = Boolean(imageUrl);
  const effectiveVariant = hasImage ? "image" : v;

  return (
    <motion.div
      className={`${styles.wrap} ${mode === "overlay" ? styles.overlay : styles.screen} ${hasImage ? styles.hasImage : ""}`}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      initial={mode === "overlay" ? { opacity: 0 } : false}
      animate={mode === "overlay" ? { opacity: 1 } : undefined}
      exit={mode === "overlay" ? { opacity: 0 } : undefined}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div className={styles.inner}>
        <div className={styles.avatar}>
          {!hasImage && v === "spinner" ? <div className={styles.spinnerRing} aria-hidden="true" /> : null}
          {!hasImage && v === "ring" ? <div className={styles.pulseRing} aria-hidden="true" /> : null}
          {hasImage ? (
            <img
              src={imageUrl}
              alt=""
              className={`${styles.avatarImg} ${
                effectiveVariant === "image" ? (v === "spinner" ? styles.spinImg : styles.spinImgSlow) : ""
              }`}
              loading="eager"
              decoding="async"
            />
          ) : null}
        </div>

        {!hasImage && v === "dots" ? (
          <div className={styles.dots} aria-hidden="true">
            <span className={styles.dot} style={hasImage ? { backgroundImage: `url("${imageUrl}")` } : undefined} />
            <span className={styles.dot} style={hasImage ? { backgroundImage: `url("${imageUrl}")` } : undefined} />
            <span className={styles.dot} style={hasImage ? { backgroundImage: `url("${imageUrl}")` } : undefined} />
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
