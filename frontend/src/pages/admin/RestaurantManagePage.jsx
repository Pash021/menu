import React, { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Layers, Table2, UtensilsCrossed } from "lucide-react";
import { getRestaurant } from "@/api/restaurants";
import { useActiveRestaurant } from "@/lib/activeRestaurant";
import { useI18n } from "@/lib/i18n";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPageSkeleton } from "@/components/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function QuickCard({ icon: Icon, title, desc, to }) {
  const { t } = useI18n();
  return (
    <Card className="transition-colors hover:border-muted-foreground/25">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </span>
          {title}
        </CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <Button asChild variant="outline" className="w-full">
          <Link to={to}>{t("common.open")}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function RestaurantManagePage() {
  const { t } = useI18n();
  const { id } = useParams();
  const restaurantId = Number(id);
  const { setRestaurantId } = useActiveRestaurant();

  useEffect(() => {
    if (Number.isFinite(restaurantId) && restaurantId > 0) setRestaurantId(restaurantId);
  }, [restaurantId, setRestaurantId]);

  const restaurantQuery = useQuery({
    queryKey: ["restaurant", restaurantId],
    queryFn: () => getRestaurant(restaurantId),
    enabled: Number.isFinite(restaurantId) && restaurantId > 0,
    retry: false,
  });

  const restaurant = restaurantQuery.data?.restaurant ?? restaurantQuery.data ?? null;

  if (restaurantQuery.isLoading) return <LoadingPageSkeleton />;
  if (restaurantQuery.isError || !restaurant) {
    return (
      <div className="container py-6">
        <EmptyState title={t("common.error")} description="Не удалось загрузить ресторан." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm text-muted-foreground">{t("admin.manage.title")}</div>
            <div className="mt-1 truncate text-2xl font-semibold tracking-tight">{restaurant.name}</div>
            <div className="mt-1 truncate text-sm text-muted-foreground">{restaurant.slug}</div>
          </div>
          {restaurant.slug ? (
            <Button asChild variant="outline" className="gap-2">
              <Link to={`/r/${restaurant.slug}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                {t("nav.publicPreview")}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <QuickCard icon={Layers} title={t("nav.categories")} desc="Управление разделами и порядком" to="/admin/categories" />
        <QuickCard icon={UtensilsCrossed} title={t("nav.dishes")} desc="Блюда, фото, цены" to="/admin/dishes" />
        <QuickCard icon={Table2} title={t("nav.tables")} desc="Столы, статусы и QR-ссылки" to="/admin/tables" />
      </div>
    </div>
  );
}
