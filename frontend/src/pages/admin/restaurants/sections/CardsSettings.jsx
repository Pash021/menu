import React, { useCallback, useEffect, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/api/client";
import { listDishes, listMenuCardPresets, updateRestaurantMenuCards, getRestaurantMenuCards, duplicateMenuCardPreset } from "@/api/restaurants";
import { useI18n } from "@/lib/i18n";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { MenuCardProvider } from "@/components/menuCard/MenuCardProvider";
import { MenuItemCard } from "@/pages/public/menu/components/MenuItemCard";
import { useSettingsPanel } from "../SettingsPanelContext";

const schema = z.object({
  presetId: z.coerce.number().optional(),
  removeBgOnUpload: z.boolean().optional(),
  layout: z.enum(["grid", "compact"]).optional(),
  cardRadius: z.coerce.number().min(0).max(28).optional(),
  cardBorderOpacity: z.coerce.number().min(0).max(1).optional(),
  cardShadow: z.coerce.number().min(0).max(1).optional(),
  imageRatio: z.enum(["1:1", "4:3", "16:9"]).optional(),
  imageFit: z.enum(["cover", "contain"]).optional(),
  imagePadding: z.coerce.number().min(0).max(18).optional(),
  imageBgMode: z.enum(["solid", "gradient"]).optional(),
  imageBg1: z.string().optional(),
  imageBg2: z.string().optional(),
});

function colorPickerValue(raw, fallback) {
  const v = String(raw || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  if (/^#[0-9a-f]{8}$/i.test(v)) return v.slice(0, 7);
  const f = String(fallback || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(f)) return f;
  if (/^#[0-9a-f]{8}$/i.test(f)) return f.slice(0, 7);
  return "#000000";
}

function normalizeOverrides(values) {
  const out = {};
  if (!values) return out;
  if (values.layout) out.layout = values.layout;
  if (Number.isFinite(values.cardRadius)) out.cardRadius = Number(values.cardRadius);
  if (Number.isFinite(values.cardBorderOpacity)) out.cardBorderOpacity = Number(values.cardBorderOpacity);
  if (Number.isFinite(values.cardShadow)) out.cardShadow = Number(values.cardShadow);
  if (values.imageRatio) out.imageRatio = values.imageRatio;
  if (values.imageFit) out.imageFit = values.imageFit;
  if (Number.isFinite(values.imagePadding)) out.imagePadding = Number(values.imagePadding);
  if (values.imageBgMode) out.imageBgMode = values.imageBgMode;
  const c1 = String(values.imageBg1 || "").trim();
  const c2 = String(values.imageBg2 || "").trim();
  if (c1 && c2) out.imageBgColors = [c1, c2];
  return out;
}

function mergeConfig(base, overrides) {
  const b = base && typeof base === "object" ? base : {};
  const o = overrides && typeof overrides === "object" ? overrides : {};
  const merged = { ...b, ...o };
  if (o.imageBgColors) merged.imageBgColors = o.imageBgColors;
  return merged;
}

export default function CardsSettings() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { restaurantId, restaurant, savedTheme } = useOutletContext();
  const { setPreview, setSaveBar, setDirty } = useSettingsPanel();

  const presetsQuery = useQuery({
    queryKey: ["menuCardPresets"],
    queryFn: () => listMenuCardPresets(),
    retry: false,
  });

  const savedQuery = useQuery({
    queryKey: ["restaurantMenuCards", restaurantId],
    queryFn: () => getRestaurantMenuCards(restaurantId),
    enabled: Boolean(restaurantId),
    retry: false,
  });

  const dishesPreviewQuery = useQuery({
    queryKey: ["dishes", { restaurantId, page: 1, q: "", preview: true }],
    queryFn: () => listDishes(restaurantId, { page: 1, page_size: 3 }),
    enabled: Boolean(restaurantId),
    staleTime: 60_000,
    retry: false,
  });

  const presets = presetsQuery.data?.items ?? presetsQuery.data ?? [];
  const saved = savedQuery.data?.menu_card ?? restaurant?.menu_card ?? null;
  const savedOverrides = savedQuery.data?.overrides ?? restaurant?.menu_card_overrides_json ?? {};
  const savedRemoveBg = Boolean(savedQuery.data?.menu_card_remove_bg_on_upload ?? restaurant?.menu_card_remove_bg_on_upload);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      presetId: 0,
      removeBgOnUpload: false,
      layout: "grid",
      cardRadius: 24,
      cardBorderOpacity: 0.12,
      cardShadow: 0.18,
      imageRatio: "4:3",
      imageFit: "cover",
      imagePadding: 0,
      imageBgMode: "gradient",
      imageBg1: "#FFF0D9",
      imageBg2: "#FFE6C4",
    },
  });

  useEffect(() => {
    if (!restaurantId) return;
    const presetId = Number(saved?.preset_id || saved?.presetId || restaurant?.menu_card_preset_id || 0);
    if (!presetId) return;
    const merged = mergeConfig(saved?.config || {}, savedOverrides || {});
    const bg = Array.isArray(merged.imageBgColors) ? merged.imageBgColors : [];
    form.reset({
      presetId,
      removeBgOnUpload: savedRemoveBg,
      layout: merged.layout === "compact" ? "compact" : "grid",
      cardRadius: Number(merged.cardRadius ?? 24),
      cardBorderOpacity: Number(merged.cardBorderOpacity ?? 0.12),
      cardShadow: Number(merged.cardShadow ?? 0.18),
      imageRatio: merged.imageRatio || "4:3",
      imageFit: merged.imageFit || "cover",
      imagePadding: Number(merged.imagePadding ?? 0),
      imageBgMode: merged.imageBgMode === "solid" ? "solid" : "gradient",
      imageBg1: colorPickerValue(bg[0], "#FFF0D9"),
      imageBg2: colorPickerValue(bg[1], "#FFE6C4"),
    });
  }, [form, restaurant?.menu_card_preset_id, restaurantId, saved?.config, saved?.preset_id, saved?.presetId, savedOverrides, savedRemoveBg]);

  useUnsavedChangesGuard(form.formState.isDirty);
  const isDirty = form.formState.isDirty;

  const selectedPresetId = Number(form.watch("presetId") || 0);
  const selectedPreset = presets.find((p) => Number(p.id) === selectedPresetId) || presets[0] || null;
  const presetBaseConfig = selectedPreset?.config_json || {};
  const overrides = normalizeOverrides(form.getValues());
  const previewConfig = useMemo(() => mergeConfig(presetBaseConfig, overrides), [overrides, presetBaseConfig]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      return updateRestaurantMenuCards(restaurantId, {
        menu_card_preset_id: selectedPresetId,
        menu_card_overrides_json: normalizeOverrides(form.getValues()),
        remove_bg_on_upload: Boolean(form.getValues("removeBgOnUpload")),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["restaurantMenuCards", restaurantId] });
      await queryClient.invalidateQueries({ queryKey: ["restaurant", restaurantId] });
      toast.success(t("toast.updated"));
      form.reset(form.getValues());
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const duplicateMutation = useMutation({
    mutationFn: async () => duplicateMenuCardPreset(selectedPresetId),
    onSuccess: async (payload) => {
      await queryClient.invalidateQueries({ queryKey: ["menuCardPresets"] });
      const created = payload?.preset || null;
      if (created?.id) form.setValue("presetId", Number(created.id), { shouldDirty: true });
      toast.success(t("toast.updated"));
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const cancel = useCallback(() => {
    const presetId = Number(saved?.preset_id || saved?.presetId || restaurant?.menu_card_preset_id || 0);
    const merged = mergeConfig(saved?.config || {}, savedOverrides || {});
    const bg = Array.isArray(merged.imageBgColors) ? merged.imageBgColors : [];
    form.reset({
      presetId,
      removeBgOnUpload: savedRemoveBg,
      layout: merged.layout === "compact" ? "compact" : "grid",
      cardRadius: Number(merged.cardRadius ?? 24),
      cardBorderOpacity: Number(merged.cardBorderOpacity ?? 0.12),
      cardShadow: Number(merged.cardShadow ?? 0.18),
      imageRatio: merged.imageRatio || "4:3",
      imageFit: merged.imageFit || "cover",
      imagePadding: Number(merged.imagePadding ?? 0),
      imageBgMode: merged.imageBgMode === "solid" ? "solid" : "gradient",
      imageBg1: colorPickerValue(bg[0], "#FFF0D9"),
      imageBg2: colorPickerValue(bg[1], "#FFE6C4"),
    });
  }, [form, restaurant?.menu_card_preset_id, saved?.config, saved?.preset_id, saved?.presetId, savedOverrides, savedRemoveBg]);

  const resetOverrides = useCallback(() => {
    const id = form.getValues("presetId");
    form.reset({
      ...form.getValues(),
      presetId: id,
      layout: "grid",
      cardRadius: 24,
      cardBorderOpacity: 0.12,
      cardShadow: 0.18,
      imageRatio: "4:3",
      imageFit: "cover",
      imagePadding: 0,
      imageBgMode: "gradient",
      imageBg1: "#FFF0D9",
      imageBg2: "#FFE6C4",
    });
  }, [form]);

  const previewDishes = dishesPreviewQuery.data?.items ?? dishesPreviewQuery.data ?? [];
  const sampleDishes = useMemo(() => {
    if (Array.isArray(previewDishes) && previewDishes.length) return previewDishes.slice(0, 3);
    return [
      { id: 1, name: "Chicken Burger", description: "Crispy chicken, lettuce, sauce", price: 10.5, currency: "USD", available: true, image_url: null },
      { id: 2, name: "Beef Burger", description: "Beef patty, cheese, onion", price: 12, currency: "USD", available: true, image_url: null },
    ];
  }, [previewDishes]);

  const previewNode = useMemo(
    () => (
      <div className="space-y-3">
        <div>
          <div className="text-sm font-semibold">{t("settings.preview")}</div>
          <div className="mt-1 text-sm text-muted-foreground">{t("settings.preview.readonly")}</div>
        </div>
        <div className="pointer-events-none overflow-hidden rounded-2xl border bg-card p-3">
          <ThemeProvider theme={savedTheme} className="paper-bg" style={{ padding: 12, borderRadius: 18 }}>
            <MenuCardProvider config={previewConfig}>
              <div className={previewConfig.layout === "compact" ? "grid gap-2" : "grid grid-cols-2 gap-3"}>
                {sampleDishes.map((dish) => (
                  <MenuItemCard key={dish.id} dish={dish} onOpen={() => {}} />
                ))}
              </div>
            </MenuCardProvider>
          </ThemeProvider>
        </div>
      </div>
    ),
    [previewConfig, sampleDishes, savedTheme, t]
  );

  const saveBar = useMemo(
    () => (
      <>
        <Button type="button" variant="outline" onClick={resetOverrides} disabled={!isDirty || saveMutation.isPending}>
          {t("common.reset")}
        </Button>
        <Button type="button" variant="secondary" onClick={cancel} disabled={!isDirty || saveMutation.isPending}>
          {t("common.cancel")}
        </Button>
        <Button type="button" onClick={() => saveMutation.mutate()} disabled={!isDirty || saveMutation.isPending}>
          {saveMutation.isPending ? t("common.loading") : t("common.save")}
        </Button>
      </>
    ),
    [cancel, isDirty, resetOverrides, saveMutation, t]
  );

  useEffect(() => {
    setPreview(previewNode);
    return () => setPreview(null);
  }, [previewNode, setPreview]);

  useEffect(() => {
    setSaveBar(isDirty ? saveBar : null);
    setDirty(isDirty);
    return () => {
      setSaveBar(null);
      setDirty(false);
    };
  }, [isDirty, saveBar, setDirty, setSaveBar]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.sections.cards")}</CardTitle>
          <CardDescription>{t("cardsSettings.desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("cardsSettings.preset")}</label>
              <Select
                value={selectedPresetId ? String(selectedPresetId) : ""}
                onChange={(e) => form.setValue("presetId", Number(e.target.value), { shouldDirty: true })}
                disabled={!presets.length}
              >
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("cardsSettings.layout")}</label>
              <Select
                value={form.watch("layout") || "grid"}
                onChange={(e) => form.setValue("layout", e.target.value, { shouldDirty: true })}
              >
                <option value="grid">{t("cardsSettings.layout.grid")}</option>
                <option value="compact">{t("cardsSettings.layout.compact")}</option>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={Boolean(form.watch("removeBgOnUpload"))}
                onChange={(e) => form.setValue("removeBgOnUpload", e.target.checked, { shouldDirty: true })}
              />
              {t("cardsSettings.removeBgOnUpload")}
            </label>
            <div className="text-xs text-muted-foreground sm:ml-auto">{t("cardsSettings.workerHint")}</div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{t("cardsSettings.radius")}</label>
                <div className="text-xs text-muted-foreground">{Math.round(Number(form.watch("cardRadius") || 0))}px</div>
              </div>
              <input
                type="range"
                min="0"
                max="28"
                value={Number(form.watch("cardRadius") ?? 24)}
                onChange={(e) => form.setValue("cardRadius", Number(e.target.value), { shouldDirty: true })}
                className="w-full"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{t("cardsSettings.shadow")}</label>
                <div className="text-xs text-muted-foreground">{Math.round(Number(form.watch("cardShadow") ?? 0) * 100)}%</div>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={Number(form.watch("cardShadow") ?? 0.18)}
                onChange={(e) => form.setValue("cardShadow", Number(e.target.value), { shouldDirty: true })}
                className="w-full"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{t("cardsSettings.border")}</label>
                <div className="text-xs text-muted-foreground">{Math.round(Number(form.watch("cardBorderOpacity") ?? 0) * 100)}%</div>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={Number(form.watch("cardBorderOpacity") ?? 0.12)}
                onChange={(e) => form.setValue("cardBorderOpacity", Number(e.target.value), { shouldDirty: true })}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("cardsSettings.imageRatio")}</label>
              <Select value={form.watch("imageRatio") || "4:3"} onChange={(e) => form.setValue("imageRatio", e.target.value, { shouldDirty: true })}>
                <option value="1:1">1:1</option>
                <option value="4:3">4:3</option>
                <option value="16:9">16:9</option>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("cardsSettings.imageFit")}</label>
              <Select value={form.watch("imageFit") || "cover"} onChange={(e) => form.setValue("imageFit", e.target.value, { shouldDirty: true })}>
                <option value="cover">{t("cardsSettings.imageFit.cover")}</option>
                <option value="contain">{t("cardsSettings.imageFit.contain")}</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{t("cardsSettings.imagePadding")}</label>
                <div className="text-xs text-muted-foreground">{Math.round(Number(form.watch("imagePadding") || 0))}px</div>
              </div>
              <input
                type="range"
                min="0"
                max="18"
                value={Number(form.watch("imagePadding") ?? 0)}
                onChange={(e) => form.setValue("imagePadding", Number(e.target.value), { shouldDirty: true })}
                className="w-full"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("cardsSettings.imageBgMode")}</label>
              <Select value={form.watch("imageBgMode") || "gradient"} onChange={(e) => form.setValue("imageBgMode", e.target.value, { shouldDirty: true })}>
                <option value="solid">{t("cardsSettings.imageBgMode.solid")}</option>
                <option value="gradient">{t("cardsSettings.imageBgMode.gradient")}</option>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("cardsSettings.imageBgColors")}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colorPickerValue(form.watch("imageBg1"), "#FFF0D9")}
                  onChange={(e) => form.setValue("imageBg1", e.target.value, { shouldDirty: true })}
                  className="h-10 w-10 rounded border"
                />
                <Input value={form.watch("imageBg1") || ""} onChange={(e) => form.setValue("imageBg1", e.target.value, { shouldDirty: true })} placeholder="#FFF0D9" />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colorPickerValue(form.watch("imageBg2"), "#FFE6C4")}
                  onChange={(e) => form.setValue("imageBg2", e.target.value, { shouldDirty: true })}
                  className="h-10 w-10 rounded border"
                />
                <Input value={form.watch("imageBg2") || ""} onChange={(e) => form.setValue("imageBg2", e.target.value, { shouldDirty: true })} placeholder="#FFE6C4" />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="outline" disabled={!selectedPresetId || duplicateMutation.isPending} onClick={() => duplicateMutation.mutate()}>
              {t("cardsSettings.duplicate")}
            </Button>
            <div className="text-xs text-muted-foreground">{t("cardsSettings.overrideHint")}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

