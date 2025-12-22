import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Store,
  Layers,
  UtensilsCrossed,
  Table2,
  Palette,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n";

function Brand() {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <span className="text-sm font-semibold">QR</span>
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold">{t("app.brand")}</div>
        <div className="text-xs text-muted-foreground">Админка</div>
      </div>
    </div>
  );
}

export function AdminSidebar({ onNavigate }) {
  const { t } = useI18n();

  const nav = [
    { to: "/admin", label: t("nav.dashboard"), icon: LayoutDashboard, end: true },
    { to: "/admin/restaurants", label: t("nav.restaurants"), icon: Store },
    { to: "/admin/categories", label: t("nav.categories"), icon: Layers },
    { to: "/admin/dishes", label: t("nav.dishes"), icon: UtensilsCrossed },
    { to: "/admin/tables", label: t("nav.tables"), icon: Table2 },
    { to: "/admin/themes", label: t("nav.themes"), icon: Palette },
    { to: "/admin/users", label: t("nav.users"), icon: Users },
  ];

  return (
    <div className="flex h-full flex-col">
      <Brand />
      <div className="px-2 pb-3 pt-2">
        <nav className="space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                    isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )
                }
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>
      <div className="mt-auto p-4">
        <div className="rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
          Готово к SPA-миграции (через API).
        </div>
      </div>
    </div>
  );
}
