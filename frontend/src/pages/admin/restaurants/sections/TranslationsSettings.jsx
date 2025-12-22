import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layers } from "lucide-react";
import { listDishes } from "@/api/restaurants";
import { useI18n } from "@/lib/i18n";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TranslationEditor } from "@/components/admin/translations/TranslationEditor";
import { useSettingsPanel } from "../SettingsPanelContext";

export default function TranslationsSettings() {
  const { t } = useI18n();
  const { restaurantId } = useOutletContext();
  const { setPreview, setDirty, setSaveBar } = useSettingsPanel();
  const [q, setQ] = useState("");
  const [dishId, setDishId] = useState(null);

  const dishesQuery = useQuery({
    queryKey: ["dishes", { restaurantId }],
    queryFn: () => listDishes(restaurantId),
    enabled: Boolean(restaurantId),
    retry: false,
  });

  const rawItems = dishesQuery.data?.items ?? dishesQuery.data ?? [];
  const items = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rawItems;
    return rawItems.filter((d) => String(d.name || "").toLowerCase().includes(query));
  }, [rawItems, q]);

  const previewNode = useMemo(
    () => (
      <div className="space-y-3">
        <div>
          <div className="text-sm font-semibold">{t("settings.sections.translations")}</div>
          <div className="mt-1 text-sm text-muted-foreground">{t("admin.dishes.translations.hint")}</div>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          {dishId ? (
            <TranslationEditor dishId={dishId} open />
          ) : (
            <div className="text-sm text-muted-foreground">{t("settings.translations.pickDish")}</div>
          )}
        </div>
      </div>
    ),
    [dishId, t]
  );

  useEffect(() => {
    setDirty(false);
    setSaveBar(null);
    setPreview(previewNode);
    return () => setPreview(null);
  }, [previewNode, setDirty, setPreview, setSaveBar]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.sections.translations")}</CardTitle>
        <CardDescription>{t("admin.dishes.translations.hint")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("common.searchDish")} />

        {dishesQuery.isLoading ? (
          <div className="rounded-xl border bg-muted/10 p-4 text-sm text-muted-foreground">{t("common.loading")}</div>
        ) : dishesQuery.isError ? (
          <div className="rounded-xl border bg-card p-4 text-sm text-destructive">{t("common.error")}</div>
        ) : items.length === 0 ? (
          <EmptyState icon={Layers} title={t("public.menu.noResults.title")} description={t("public.menu.noResults.desc")} />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {items.slice(0, 40).map((d) => {
              const active = String(dishId || "") === String(d.id || "");
              return (
                <button
                  key={d.id}
                  type="button"
                  className={`rounded-xl border p-3 text-left transition-colors ${active ? "border-primary bg-muted/30" : "bg-card hover:bg-muted/10"}`}
                  onClick={() => setDishId(d.id)}
                >
                  <div className="truncate text-sm font-medium">{d.name}</div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">{d.description || "—"}</div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
