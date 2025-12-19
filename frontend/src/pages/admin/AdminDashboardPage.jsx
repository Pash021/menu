import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layers, Store, Table2, UtensilsCrossed } from "lucide-react";
import { listRestaurants } from "@/api/restaurants";
import { useActiveRestaurant } from "@/lib/activeRestaurant";
import { useI18n } from "@/lib/i18n";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function StatCard({ icon: Icon, title, value, hint, to }) {
  const { t } = useI18n();
  return (
    <Card className="transition-colors hover:border-muted-foreground/25">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-col gap-3 text-base sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </span>
            <span>{title}</span>
          </span>
          {to ? (
            <Button asChild variant="ghost" size="sm" className="self-start sm:self-auto">
              <Link to={to}>{t("common.open")}</Link>
            </Button>
          ) : null}
        </CardTitle>
        {hint ? <CardDescription>{hint}</CardDescription> : null}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-3xl font-semibold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const { t } = useI18n();
  const { restaurantId } = useActiveRestaurant();

  const restaurantsQuery = useQuery({
    queryKey: ["restaurants", { page: 1, page_size: 100 }],
    queryFn: () => listRestaurants({ page: 1, page_size: 100 }),
    retry: false,
  });

  const restaurants = restaurantsQuery.data?.items ?? restaurantsQuery.data ?? [];
  const restaurantsCount = restaurants.length;
  const activeRestaurant = restaurants.find((r) => r.id === restaurantId) ?? null;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-6">
        <div className="text-sm text-muted-foreground">{t("app.tagline")}</div>
        <div className="mt-1 text-2xl font-semibold tracking-tight">{t("nav.dashboard")}</div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Активный ресторан:</span>
          <span className="rounded-full border bg-muted/40 px-3 py-1 text-foreground">
            {activeRestaurant?.name ?? "—"}
          </span>
          {activeRestaurant?.slug ? (
            <Button asChild variant="outline" size="sm">
              <Link to={`/r/${activeRestaurant.slug}`} target="_blank" rel="noreferrer">
                {t("nav.publicPreview")}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {restaurantsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-6">
              <LoadingSkeleton className="h-4 w-1/2" />
              <LoadingSkeleton className="mt-4 h-8 w-16" />
            </div>
          ))}
        </div>
      ) : restaurantsQuery.isError ? (
        <EmptyState title={t("common.error")} description="Не удалось загрузить данные." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Store} title={t("nav.restaurants")} value={restaurantsCount} hint="С доступом" to="/admin/restaurants" />
          <StatCard icon={Layers} title={t("nav.categories")} value="—" hint="Для выбранного ресторана" to="/admin/categories" />
          <StatCard icon={UtensilsCrossed} title={t("nav.dishes")} value="—" hint="Для выбранного ресторана" to="/admin/dishes" />
          <StatCard icon={Table2} title={t("nav.tables")} value="—" hint="Для выбранного ресторана" to="/admin/tables" />
        </div>
      )}
    </div>
  );
}
