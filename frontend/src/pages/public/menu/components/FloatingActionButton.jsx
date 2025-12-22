import React from "react";
import { MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useTransitionDirection } from "@/hooks/useTransitionDirection";
import { getRestaurantContactTargets } from "../publicMenuUtils";
import styles from "./FloatingActionButton.module.css";

export function FloatingActionButton({ restaurant, basePath }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { prepareTransition } = useTransitionDirection();
  const { phone, whatsapp, instagram, facebook } = getRestaurantContactTargets(restaurant);

  const hasAnyContact = Boolean(phone || whatsapp || instagram || facebook);
  const contactTo = basePath ? `${basePath}/contact` : null;

  if (!hasAnyContact || !contactTo) {
    return (
      <button
        type="button"
        className={[styles.fab, styles.disabled, "menuFloatingAction"].join(" ")}
        aria-label={t("public.contact.title")}
      >
        <MessageCircle aria-hidden="true" />
        <span className={styles.srOnly}>{t("public.contact.title")}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={[styles.fab, "menuFloatingAction"].join(" ")}
      aria-label={t("public.contact.title")}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (typeof e.button === "number" && e.button !== 0) return;
        if (!prepareTransition("forward")) return;
        // Do NOT set backgroundLocation: contact is a normal route (not a modal).
        navigate(contactTo);
      }}
    >
      <MessageCircle aria-hidden="true" />
      <span className={styles.srOnly}>{t("public.contact.contactUs")}</span>
    </button>
  );
}
