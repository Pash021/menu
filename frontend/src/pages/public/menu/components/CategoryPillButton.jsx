import React from "react";
import { Link } from "react-router-dom";
import { useTransitionDirection } from "@/hooks/useTransitionDirection";
import styles from "./CategoryPillButton.module.css";

export function CategoryPillButton({
  to,
  label,
  artSrc,
  artAlt = "",
  artPosition = "right",
  disabled = false,
  variant = "pill",
}) {
  const { prepareTransition } = useTransitionDirection();
  const cls = [
    "menuCategoryPill",
    variant === "grid" ? "menuCategoryPill--grid" : variant === "carousel" ? "menuCategoryPill--carousel" : null,
  ]
    .filter(Boolean)
    .join(" ");
  const content = (
    <>
      <div className={styles.text}>
        <div className={styles.label}>{label}</div>
      </div>

      {artSrc ? (
        <img
          src={artSrc}
          alt={artAlt}
          className={styles.art}
          data-pos={artPosition}
          loading="lazy"
          width={96}
          height={96}
          draggable="false"
        />
      ) : null}
    </>
  );

  if (disabled || !to) {
    return (
      <button type="button" className={cls} disabled aria-disabled="true">
        {content}
      </button>
    );
  }

  return (
    <Link
      to={to}
      className={cls}
      onClick={(e) => {
        // Don't mess with open-in-new-tab or modified clicks.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (typeof e.button === "number" && e.button !== 0) return;
        if (!prepareTransition("forward")) e.preventDefault();
      }}
    >
      {content}
    </Link>
  );
}
