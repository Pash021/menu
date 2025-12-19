import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ExternalLink, Menu, Store, User } from "lucide-react";
import { toast } from "sonner";
import { listRestaurants } from "@/api/restaurants";
import { getApiErrorMessage } from "@/api/client";
import { useAuth } from "@/lib/auth";
import { useActiveRestaurant } from "@/lib/activeRestaurant";
import { useI18n } from "@/lib/i18n";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function useTitle() {
  const { pathname } = useLocation();
  const { t } = useI18n();

  return useMemo(() => {
    if (pathname === "/admin") return t("nav.dashboard");
    if (pathname.startsWith("/admin/restaurants")) return t("nav.restaurants");
    if (pathname.startsWith("/admin/categories")) return t("nav.categories");
    if (pathname.startsWith("/admin/dishes")) return t("nav.dishes");
    if (pathname.startsWith("/admin/tables")) return t("nav.tables");
    if (pathname.startsWith("/admin/users")) return t("nav.users");
    return "Админка";
  }, [pathname, t]);
}

export function AdminTopbar({ onOpenSidebar }) {
  const title = useTitle();
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const { restaurantId, setRestaurantId } = useActiveRestaurant();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const restaurantsQuery = useQuery({
    queryKey: ["restaurants", { page: 1, page_size: 100 }],
    queryFn: () => listRestaurants({ page: 1, page_size: 100 }),
    retry: false,
  });

  const restaurants = restaurantsQuery.data?.items ?? restaurantsQuery.data ?? [];
  const activeRestaurant = restaurants.find((r) => r.id === restaurantId) ?? null;

  useEffect(() => {
    if (restaurantId) return;
    if (restaurants.length === 1) setRestaurantId(restaurants[0].id);
  }, [restaurantId, restaurants, setRestaurantId]);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      toast.success(t("toast.loggedOut"));
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="container flex h-14 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenSidebar}
            className="lg:hidden"
            aria-label="Меню"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{title}</div>
            <div className="truncate text-xs text-muted-foreground">{t("app.tagline")}</div>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Store className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {activeRestaurant?.name ?? t("admin.activeRestaurant")}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-64">
              {restaurantsQuery.isLoading ? (
                <div className="px-2 py-2 text-sm text-muted-foreground">{t("common.loading")}</div>
              ) : restaurantsQuery.isError ? (
                <div className="px-2 py-2 text-sm text-muted-foreground">{t("common.error")}</div>
              ) : restaurants.length ? (
                restaurants.map((r) => (
                  <DropdownMenuItem key={r.id} onSelect={() => setRestaurantId(r.id)}>
                    <div className="flex w-full items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{r.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{r.slug}</div>
                      </div>
                      {restaurantId === r.id ? <span className="text-xs text-primary">Активный</span> : null}
                    </div>
                  </DropdownMenuItem>
                ))
              ) : (
                <div className="px-2 py-2 text-sm text-muted-foreground">{t("admin.selectRestaurant")}</div>
              )}
              {activeRestaurant?.slug ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to={`/r/${activeRestaurant.slug}`} target="_blank" rel="noreferrer">
                      <span className="flex items-center gap-2">
                        <ExternalLink className="h-4 w-4" />
                        <span>{t("nav.publicPreview")}</span>
                      </span>
                    </Link>
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>

          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="max-w-44 justify-start gap-2">
                <User className="h-4 w-4 text-muted-foreground sm:hidden" />
                <span className="hidden truncate text-sm sm:inline">{user?.email ?? "—"}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled>
                <span className="text-xs text-muted-foreground">{user?.role ?? "—"}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleLogout} disabled={isLoggingOut}>
                {t("auth.signout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
