import React, { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Menu, Settings2 } from "lucide-react";
import { getRestaurant } from "@/api/restaurants";
import { listThemes } from "@/api/themes";
import { useActiveRestaurant } from "@/lib/activeRestaurant";
import { useI18n } from "@/lib/i18n";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPageSkeleton } from "@/components/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/modal";
import { mergeTheme } from "@/themes";
import { normalizeThemeForProvider } from "@/components/theme/ThemeMiniPreview";
import SettingsSidebar from "./SettingsSidebar";
import { UnsavedChangesProvider } from "@/hooks/useUnsavedChangesGuard";
import { SettingsPanelProvider, useSettingsPanel } from "./SettingsPanelContext";

function RestaurantSettingsLayoutInner() {
  const { t } = useI18n();
  const { id } = useParams();
  const restaurantId = Number(id);
  const { setRestaurantId } = useActiveRestaurant();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const { preview, saveBar, isDirty } = useSettingsPanel();
  const showSaveBar = Boolean(isDirty && saveBar);

  useEffect(() => {
    if (Number.isFinite(restaurantId) && restaurantId > 0) setRestaurantId(restaurantId);
  }, [restaurantId, setRestaurantId]);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  const restaurantQuery = useQuery({
    queryKey: ["restaurant", restaurantId],
    queryFn: () => getRestaurant(restaurantId),
    enabled: Number.isFinite(restaurantId) && restaurantId > 0,
    retry: false,
  });

  const themesQuery = useQuery({
    queryKey: ["themes"],
    queryFn: () => listThemes(),
    retry: false,
    staleTime: 5 * 60_000,
  });

  const restaurant = restaurantQuery.data?.restaurant ?? restaurantQuery.data ?? null;
  const themes = themesQuery.data?.items ?? themesQuery.data ?? [];

  const savedTheme = useMemo(() => {
    const selectedThemeId = Number(restaurant?.theme_id || 0);
    const selected = themes.find((x) => Number(x.id) === selectedThemeId) || themes[0] || null;
    const merged = mergeTheme(selected?.config_json || {}, restaurant?.theme_overrides_json || {});
    return normalizeThemeForProvider({ preset_key: selected?.preset_key, name: selected?.name, config_json: merged });
  }, [restaurant?.theme_id, restaurant?.theme_overrides_json, themes]);

  if (restaurantQuery.isLoading) return <LoadingPageSkeleton />;
  if (restaurantQuery.isError || !restaurant) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6">
        <EmptyState title={t("common.error")} description="Не удалось загрузить ресторан." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/10">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 space-y-4">
        <div className="rounded-2xl border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm text-muted-foreground">{t("settings.title")}</div>
            <div className="mt-1 truncate text-2xl font-semibold tracking-tight">{restaurant.name}</div>
            <div className="mt-1 truncate text-sm text-muted-foreground">{restaurant.slug}</div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {restaurant.slug ? (
              <Button asChild variant="outline" className="gap-2">
                <Link to={`/r/${restaurant.slug}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  {t("nav.publicPreview")}
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="secondary" className="gap-2">
              <Link to="/admin/restaurants">
                <Settings2 className="h-4 w-4" />
                {t("admin.restaurants.title")}
              </Link>
            </Button>
          </div>
        </div>
        </div>

      <UnsavedChangesProvider message="You have unsaved changes. Leave without saving?">
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="hidden lg:block lg:sticky lg:top-6 lg:self-start">
            <SettingsSidebar />
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
            <div className={`min-w-0 space-y-4 ${showSaveBar ? "pb-28" : ""}`}>
              <div className="flex items-center justify-between gap-2 lg:hidden">
                <Button type="button" variant="outline" className="gap-2" onClick={() => setNavOpen(true)}>
                  <Menu className="h-4 w-4" />
                  {t("settings.sectionsTitle")}
                </Button>
              </div>

              <Dialog open={navOpen} onOpenChange={setNavOpen}>
                <DialogContent variant="bottom" className="p-4">
                  <DialogHeader>
                    <DialogTitle>{t("settings.sectionsTitle")}</DialogTitle>
                  </DialogHeader>
                  <div className="mt-3">
                    <SettingsSidebar onNavigate={() => setNavOpen(false)} />
                  </div>
                </DialogContent>
              </Dialog>

              <Outlet context={{ restaurantId, restaurant, themes, savedTheme }} />

              {showSaveBar ? (
                <div className="sticky bottom-4 z-20">
                  <div className="rounded-2xl border bg-card/92 p-3 shadow-lg backdrop-blur-sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">{saveBar}</div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="hidden lg:block">
              <div className="sticky top-4 max-h-[calc(100vh-32px)] overflow-auto rounded-2xl border bg-card p-4">
                {preview ? preview : <div className="text-sm text-muted-foreground">{t("settings.preview.readonly")}</div>}
              </div>
            </div>
          </div>

          <div className="lg:hidden">
            {preview ? (
              <details className="rounded-2xl border bg-card p-4">
                <summary className="cursor-pointer text-sm font-semibold">{t("settings.preview")}</summary>
                <div className="mt-3">{preview}</div>
              </details>
            ) : null}
          </div>
        </div>
      </UnsavedChangesProvider>
      </div>
    </div>
  );
}

export default function RestaurantSettingsLayout() {
  return (
    <SettingsPanelProvider>
      <RestaurantSettingsLayoutInner />
    </SettingsPanelProvider>
  );
}
