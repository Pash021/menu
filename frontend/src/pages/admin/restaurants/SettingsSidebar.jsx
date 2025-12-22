import React from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/cn";
import { LayoutDashboard, Palette, PanelsTopLeft, Type, LayoutGrid, Languages, CreditCard } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useUnsavedChangesContext } from "@/hooks/useUnsavedChangesGuard";

const ITEMS = [
  { to: "general", icon: LayoutDashboard, labelKey: "settings.sections.general" },
  { to: "theme", icon: Palette, labelKey: "settings.sections.theme" },
  { to: "cards", icon: CreditCard, labelKey: "settings.sections.cards" },
  { to: "header", icon: PanelsTopLeft, labelKey: "settings.sections.header" },
  { to: "fonts", icon: Type, labelKey: "settings.sections.fonts" },
  { to: "pages", icon: LayoutGrid, labelKey: "settings.sections.pages" },
  { to: "translations", icon: Languages, labelKey: "settings.sections.translations" },
];

export default function SettingsSidebar({ onNavigate } = {}) {
  const { t } = useI18n();
  const unsaved = useUnsavedChangesContext();

  return (
    <nav className="flex flex-col gap-2 rounded-2xl border bg-card p-2">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={(e) => {
              if (!unsaved?.dirty) return;
              const ok = unsaved.confirmIfDirty ? unsaved.confirmIfDirty() : window.confirm(unsaved?.message || "You have unsaved changes. Leave without saving?");
              if (!ok) {
                e.preventDefault();
                e.stopPropagation();
                return;
              }
              if (typeof onNavigate === "function") onNavigate();
            }}
            className={({ isActive }) =>
              cn(
                "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )
            }
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className="whitespace-nowrap">{t(item.labelKey)}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
