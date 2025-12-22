import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { getApiErrorMessage } from "@/api/client";
import {
  duplicateHeroPreset,
  getRestaurantHero,
  getCategoryHeaderStyle,
  getRestaurantHeaderStyle,
  listHeroPresets,
  listCategories,
  updateHeroPreset,
  updateCategoryHeaderStyle,
  updateRestaurantHeaderStyle,
  updateRestaurantHero,
} from "@/api/restaurants";
import { useI18n } from "@/lib/i18n";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/modal";
import { CategoryHeaderPreview } from "@/components/admin/CategoryHeaderPreview";
import { HeroHeaderPreview } from "@/components/admin/HeroHeaderPreview";
import { useSettingsPanel } from "../SettingsPanelContext";

const headerStyleSchema = z.object({
  headerColor: z.string().optional(),
  effect: z.string().optional(),
  glow: z.coerce.number().optional(),
  fade: z.coerce.number().optional(),
  radius: z.coerce.number().optional(),
  shadow: z.coerce.number().optional(),
  accentColor: z.string().optional(),
});

const HEADER_STYLE_DEFAULTS = {
  headerColor: "",
  effect: "glowGradient",
  glow: 0.55,
  fade: 0.75,
  radius: 24,
  shadow: 0.35,
  accentColor: "#FFFFFF33",
};

function colorPickerValue(raw, fallback) {
  const v = String(raw || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  if (/^#[0-9a-f]{8}$/i.test(v)) return v.slice(0, 7);
  return fallback;
}

function normalizeHeaderStyle(style) {
  if (!style) return null;
  return {
    headerColor: style.headerColor || "",
    effect: style.effect || "glowGradient",
    glow: Number(style.glow ?? 0.55),
    fade: Number(style.fade ?? 0.75),
    radius: Number(style.radius ?? 24),
    shadow: Number(style.shadow ?? 0.35),
    accentColor: style.accentColor || "#FFFFFF33",
  };
}

const HERO_DEFAULTS = {
  backgroundMode: "gradient",
  bgSolid: "#FFF3E6",
  bgGradient: ["#FFF3E6", "#FFE1B8"],
  accentColor: "#F39A1E",
  badgeShape: "circle",
  badgeBlur: 14,
  badgeOpacity: 0.78,
  badgeBorderOpacity: 0.35,
  logoSize: 76,
  glowStrength: 0.55,
  glowRadius: 26,
  fadeStrength: 0.75,
  paddingTop: 18,
  paddingBottom: 22,
  radius: 26,
};

function clamp01(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function normalizeHeroConfig(raw) {
  const cfg = raw && typeof raw === "object" ? raw : {};
  const backgroundMode = cfg.backgroundMode === "solid" ? "solid" : "gradient";
  const bgSolid = colorPickerValue(cfg.bgSolid, HERO_DEFAULTS.bgSolid);
  const g = Array.isArray(cfg.bgGradient) ? cfg.bgGradient : HERO_DEFAULTS.bgGradient;
  const bgGradient = [colorPickerValue(g?.[0], HERO_DEFAULTS.bgGradient[0]), colorPickerValue(g?.[1], HERO_DEFAULTS.bgGradient[1])];
  const accentColor = colorPickerValue(cfg.accentColor, HERO_DEFAULTS.accentColor);
  const badgeShape = cfg.badgeShape === "rounded" || cfg.badgeShape === "squircle" || cfg.badgeShape === "circle" ? cfg.badgeShape : HERO_DEFAULTS.badgeShape;

  return {
    backgroundMode,
    bgSolid,
    bgGradient,
    accentColor,
    badgeShape,
    badgeBlur: clampInt(cfg.badgeBlur, 0, 24, HERO_DEFAULTS.badgeBlur),
    badgeOpacity: clamp01(cfg.badgeOpacity, HERO_DEFAULTS.badgeOpacity),
    badgeBorderOpacity: clamp01(cfg.badgeBorderOpacity, HERO_DEFAULTS.badgeBorderOpacity),
    logoSize: clampInt(cfg.logoSize, 40, 120, HERO_DEFAULTS.logoSize),
    glowStrength: clamp01(cfg.glowStrength, HERO_DEFAULTS.glowStrength),
    glowRadius: clampInt(cfg.glowRadius, 0, 60, HERO_DEFAULTS.glowRadius),
    fadeStrength: clamp01(cfg.fadeStrength, HERO_DEFAULTS.fadeStrength),
    paddingTop: clampInt(cfg.paddingTop, 0, 40, HERO_DEFAULTS.paddingTop),
    paddingBottom: clampInt(cfg.paddingBottom, 0, 48, HERO_DEFAULTS.paddingBottom),
    radius: clampInt(cfg.radius, 0, 40, HERO_DEFAULTS.radius),
  };
}

function diffHeroOverrides(base, merged) {
  const out = {};
  const baseCfg = base && typeof base === "object" ? base : {};
  const mergedCfg = merged && typeof merged === "object" ? merged : {};

  for (const key of Object.keys(mergedCfg)) {
    const next = mergedCfg[key];
    const prev = baseCfg[key];
    const eq =
      Array.isArray(next) || Array.isArray(prev)
        ? JSON.stringify(next || null) === JSON.stringify(prev || null)
        : next === prev;
    if (!eq) out[key] = next;
  }

  return out;
}

export default function HeaderSettings() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { restaurantId, restaurant, savedTheme } = useOutletContext();
  const { setPreview, setSaveBar, setDirty } = useSettingsPanel();

  const heroPresetsQuery = useQuery({
    queryKey: ["heroPresets"],
    queryFn: () => listHeroPresets(),
    retry: false,
  });

  const restaurantHeroQuery = useQuery({
    queryKey: ["restaurantHero", restaurantId],
    queryFn: () => getRestaurantHero(restaurantId),
    enabled: Boolean(restaurantId),
    retry: false,
  });

  const heroPresets = heroPresetsQuery.data?.items ?? heroPresetsQuery.data ?? [];
  const savedHero = restaurantHeroQuery.data?.hero || restaurant?.hero || null;

  const [heroPresetId, setHeroPresetId] = useState(0);
  const [heroDraft, setHeroDraft] = useState(() => normalizeHeroConfig(null));
  const [heroDirty, setHeroDirty] = useState(false);
  const [presetEditOpen, setPresetEditOpen] = useState(false);

  useEffect(() => {
    if (heroDirty) return;
    const presetId = Number(savedHero?.preset_id || savedHero?.presetId || restaurant?.hero_preset_id || 0);
    if (!presetId) return;
    setHeroPresetId(presetId);
    setHeroDraft(normalizeHeroConfig(savedHero?.config || null));
    setHeroDirty(false);
  }, [heroDirty, restaurant?.hero_preset_id, savedHero?.preset_id, savedHero?.presetId]);

  useEffect(() => {
    if (heroDirty) return;
    if (heroPresetId) return;
    const fallbackPreset = Number(savedHero?.preset_id || savedHero?.presetId || restaurant?.hero_preset_id || heroPresets?.[0]?.id || 0);
    if (!fallbackPreset) return;
    setHeroPresetId(fallbackPreset);
    const fromSaved = savedHero?.config || null;
    const fromPreset = heroPresets.find((p) => Number(p.id) === fallbackPreset)?.config_json || null;
    setHeroDraft(normalizeHeroConfig(fromSaved || fromPreset));
  }, [heroDirty, heroPresetId, heroPresets, restaurant?.hero_preset_id, savedHero?.preset_id, savedHero?.presetId, savedHero?.config]);

  const selectedHeroPreset = useMemo(
    () => heroPresets.find((p) => Number(p.id) === Number(heroPresetId)) || null,
    [heroPresets, heroPresetId]
  );

  const selectedHeroBaseConfig = selectedHeroPreset?.config_json || null;

  const saveRestaurantHero = useMutation({
    mutationFn: async () => {
      const baseCfg = normalizeHeroConfig(selectedHeroBaseConfig || HERO_DEFAULTS);
      const merged = normalizeHeroConfig(heroDraft);
      const overrides = diffHeroOverrides(baseCfg, merged);
      return updateRestaurantHero(restaurantId, { hero_preset_id: heroPresetId, hero_overrides_json: overrides });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["restaurantHero", restaurantId] });
      await queryClient.invalidateQueries({ queryKey: ["restaurant", restaurantId] });
      toast.success(t("toast.updated"));
      setHeroDirty(false);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const duplicatePreset = useMutation({
    mutationFn: async () => duplicateHeroPreset(heroPresetId),
    onSuccess: async (payload) => {
      await queryClient.invalidateQueries({ queryKey: ["heroPresets"] });
      const created = payload?.preset || null;
      if (created?.id) {
        setHeroPresetId(Number(created.id));
        setHeroDraft(normalizeHeroConfig(created.config_json || null));
        setHeroDirty(true);
      }
      toast.success(t("toast.updated"));
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const [presetEditName, setPresetEditName] = useState("");
  const [presetEditConfig, setPresetEditConfig] = useState(() => normalizeHeroConfig(null));

  useEffect(() => {
    if (!presetEditOpen) return;
    if (!selectedHeroPreset) return;
    setPresetEditName(String(selectedHeroPreset.name || ""));
    setPresetEditConfig(normalizeHeroConfig(selectedHeroPreset.config_json || null));
  }, [presetEditOpen, selectedHeroPreset]);

  const savePresetEdit = useMutation({
    mutationFn: async () => updateHeroPreset(selectedHeroPreset.id, { name: presetEditName, config_json: presetEditConfig }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["heroPresets"] });
      toast.success(t("toast.updated"));
      setPresetEditOpen(false);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const restaurantStyleQuery = useQuery({
    queryKey: ["restaurantHeaderStyle", restaurantId],
    queryFn: () => getRestaurantHeaderStyle(restaurantId),
    enabled: Boolean(restaurantId),
    retry: false,
  });

  const restaurantForm = useForm({
    resolver: zodResolver(headerStyleSchema),
    defaultValues: {
      headerColor: "",
      effect: "glowGradient",
      glow: 0.55,
      fade: 0.75,
      radius: 24,
      shadow: 0.35,
      accentColor: "#FFFFFF33",
    },
  });

  useEffect(() => {
    const style = restaurantStyleQuery.data?.header_style || null;
    if (!style) return;
    restaurantForm.reset(normalizeHeaderStyle(style));
  }, [restaurantForm, restaurantStyleQuery.data]);

  const saveRestaurantStyle = useMutation({
    mutationFn: async (values) => updateRestaurantHeaderStyle(restaurantId, values),
    onSuccess: async (payload) => {
      await queryClient.invalidateQueries({ queryKey: ["restaurantHeaderStyle", restaurantId] });
      await queryClient.invalidateQueries({ queryKey: ["restaurant", restaurantId] });
      const style = payload?.header_style || null;
      if (style) restaurantForm.reset(normalizeHeaderStyle(style));
      toast.success(t("toast.updated"));
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const resetRestaurantStyle = useMutation({
    mutationFn: async () => updateRestaurantHeaderStyle(restaurantId, null),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["restaurantHeaderStyle", restaurantId] });
      await queryClient.invalidateQueries({ queryKey: ["restaurant", restaurantId] });
      toast.success(t("toast.updated"));
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories", { restaurantId }],
    queryFn: () => listCategories(restaurantId),
    enabled: Boolean(restaurantId),
    retry: false,
  });

  const categories = categoriesQuery.data?.items ?? categoriesQuery.data ?? [];
  const [categoryId, setCategoryId] = useState(0);

  useEffect(() => {
    if (categoryId) return;
    const first = Number(categories?.[0]?.id || 0);
    if (first) setCategoryId(first);
  }, [categories, categoryId]);

  const categoryStyleQuery = useQuery({
    queryKey: ["categoryHeaderStyle", { categoryId }],
    queryFn: () => getCategoryHeaderStyle(categoryId),
    enabled: Boolean(categoryId),
    retry: false,
  });

  const categoryForm = useForm({
    resolver: zodResolver(headerStyleSchema),
    defaultValues: {
      headerColor: "",
      effect: "glowGradient",
      glow: 0.55,
      fade: 0.75,
      radius: 24,
      shadow: 0.35,
      accentColor: "#FFFFFF33",
    },
  });

  useUnsavedChangesGuard(heroDirty || restaurantForm.formState.isDirty || categoryForm.formState.isDirty);

  useEffect(() => {
    const style = categoryStyleQuery.data?.header_style || null;
    if (!style) return;
    categoryForm.reset(normalizeHeaderStyle(style));
  }, [categoryForm, categoryStyleQuery.data]);

  const saveCategoryStyle = useMutation({
    mutationFn: async (values) => updateCategoryHeaderStyle(categoryId, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["categoryHeaderStyle"] });
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success(t("toast.updated"));
      categoryForm.reset(categoryForm.getValues());
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const resetCategoryStyle = useMutation({
    mutationFn: async () => updateCategoryHeaderStyle(categoryId, null),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["categoryHeaderStyle"] });
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success(t("toast.updated"));
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const updateHeroDraft = (patch) => {
    setHeroDraft((prev) => ({ ...prev, ...(patch || {}) }));
    setHeroDirty(true);
  };

  const restaurantPreviewStyle = restaurantForm.watch();
  const categoryPreviewStyle = categoryForm.watch();
  const selectedCategory = categories.find((c) => Number(c.id) === Number(categoryId)) || null;

  const anyDirty = Boolean(heroDirty || restaurantForm.formState.isDirty || categoryForm.formState.isDirty);
  const anyPending = Boolean(saveRestaurantHero.isPending || saveRestaurantStyle.isPending || saveCategoryStyle.isPending);

  const cancelAll = useCallback(() => {
    if (heroDirty) {
      const presetId = Number(savedHero?.preset_id || savedHero?.presetId || restaurant?.hero_preset_id || heroPresets?.[0]?.id || 0);
      if (presetId) setHeroPresetId(presetId);
      setHeroDraft(normalizeHeroConfig(savedHero?.config || null));
      setHeroDirty(false);
    }

    if (restaurantForm.formState.isDirty) {
      const style = restaurantStyleQuery.data?.header_style || null;
      restaurantForm.reset(style ? normalizeHeaderStyle(style) : HEADER_STYLE_DEFAULTS);
    }

    if (categoryForm.formState.isDirty) {
      const style = categoryStyleQuery.data?.header_style || null;
      categoryForm.reset(style ? normalizeHeaderStyle(style) : HEADER_STYLE_DEFAULTS);
    }
  }, [
    categoryForm,
    categoryStyleQuery.data,
    heroDirty,
    heroPresets,
    restaurant?.hero_preset_id,
    restaurantForm,
    restaurantStyleQuery.data,
    savedHero?.config,
    savedHero?.preset_id,
    savedHero?.presetId,
  ]);

  const resetAll = useCallback(() => {
    if (heroDirty) {
      setHeroDraft(normalizeHeroConfig(selectedHeroBaseConfig || HERO_DEFAULTS));
      setHeroDirty(true);
    }

    const applyDefaults = (formApi) => {
      formApi.setValue("headerColor", HEADER_STYLE_DEFAULTS.headerColor, { shouldDirty: true });
      formApi.setValue("effect", HEADER_STYLE_DEFAULTS.effect, { shouldDirty: true });
      formApi.setValue("glow", HEADER_STYLE_DEFAULTS.glow, { shouldDirty: true });
      formApi.setValue("fade", HEADER_STYLE_DEFAULTS.fade, { shouldDirty: true });
      formApi.setValue("radius", HEADER_STYLE_DEFAULTS.radius, { shouldDirty: true });
      formApi.setValue("shadow", HEADER_STYLE_DEFAULTS.shadow, { shouldDirty: true });
      formApi.setValue("accentColor", HEADER_STYLE_DEFAULTS.accentColor, { shouldDirty: true });
    };

    if (restaurantForm.formState.isDirty) applyDefaults(restaurantForm);
    if (categoryForm.formState.isDirty) applyDefaults(categoryForm);
  }, [categoryForm, heroDirty, restaurantForm, selectedHeroBaseConfig]);

  const saveAll = useCallback(async () => {
    if (!anyDirty || anyPending) return;
    try {
      if (heroDirty && heroPresetId) await saveRestaurantHero.mutateAsync();
      if (restaurantForm.formState.isDirty) await saveRestaurantStyle.mutateAsync(restaurantForm.getValues());
      if (categoryForm.formState.isDirty && categoryId) await saveCategoryStyle.mutateAsync(categoryForm.getValues());
    } catch {
      // handled by mutations
    }
  }, [
    anyDirty,
    anyPending,
    categoryForm,
    categoryId,
    heroDirty,
    heroPresetId,
    restaurantForm,
    saveCategoryStyle,
    saveRestaurantHero,
    saveRestaurantStyle,
  ]);

  const previewNode = useMemo(
    () => (
      <div className="space-y-3">
        <div>
          <div className="text-sm font-semibold">{t("settings.preview")}</div>
          <div className="mt-1 text-sm text-muted-foreground">{t("settings.preview.readonly")}</div>
        </div>

        <div className="space-y-3">
          <div className="pointer-events-none overflow-hidden rounded-2xl border bg-card p-3">
            <div className="mb-2 text-xs font-semibold text-muted-foreground">{t("restaurant.hero.title")}</div>
            <HeroHeaderPreview
              theme={savedTheme}
              config={heroDraft}
              restaurantName={restaurant?.name || ""}
              subtitle={restaurant?.description || ""}
              logoUrl={restaurant?.logo_url || null}
            />
          </div>

          <div className="pointer-events-none overflow-hidden rounded-2xl border bg-card p-3">
            <div className="mb-2 text-xs font-semibold text-muted-foreground">{t("restaurant.headerStyle.title")}</div>
            <CategoryHeaderPreview
              theme={savedTheme}
              restaurantName={restaurant?.name || ""}
              title={t("settings.preview.categoryTitle")}
              headerStyle={restaurantPreviewStyle}
            />
          </div>

          <div className="pointer-events-none overflow-hidden rounded-2xl border bg-card p-3">
            <div className="mb-2 text-xs font-semibold text-muted-foreground">{t("category.headerStyle.title")}</div>
            <CategoryHeaderPreview
              theme={savedTheme}
              restaurantName={restaurant?.name || ""}
              title={selectedCategory?.name || t("settings.preview.categoryTitle")}
              headerStyle={categoryPreviewStyle}
            />
          </div>
        </div>
      </div>
    ),
    [categoryPreviewStyle, heroDraft, restaurant?.description, restaurant?.logo_url, restaurant?.name, restaurantPreviewStyle, savedTheme, selectedCategory?.name, t]
  );

  const saveBar = useMemo(
    () => (
      <>
        <Button type="button" variant="outline" onClick={resetAll} disabled={!anyDirty || anyPending}>
          {t("restaurant.headerStyle.reset")}
        </Button>
        <Button type="button" variant="secondary" onClick={cancelAll} disabled={!anyDirty || anyPending}>
          {t("common.cancel")}
        </Button>
        <Button type="button" onClick={() => void saveAll()} disabled={!anyDirty || anyPending}>
          {anyPending ? t("common.loading") : t("common.save")}
        </Button>
      </>
    ),
    [anyDirty, anyPending, cancelAll, resetAll, saveAll, t]
  );

  useEffect(() => {
    setPreview(previewNode);
    return () => setPreview(null);
  }, [previewNode, setPreview]);

  useEffect(() => {
    setDirty(anyDirty);
    setSaveBar(anyDirty ? saveBar : null);
    return () => {
      setDirty(false);
      setSaveBar(null);
    };
  }, [anyDirty, saveBar, setDirty, setSaveBar]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("restaurant.hero.title")}</CardTitle>
          <CardDescription>{t("restaurant.hero.hint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4">
            <div className="grid gap-3 rounded-xl border bg-muted/20 p-3 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2">
                <label className="text-sm font-medium">{t("restaurant.hero.preset")}</label>
                <Select
                  value={heroPresetId ? String(heroPresetId) : ""}
                  onChange={(e) => {
                    const next = Number(e.target.value || 0);
                    if (!next) return;
                    if (heroDirty) {
                      const ok = window.confirm("Discard unsaved hero changes?");
                      if (!ok) return;
                    }
                    const preset = heroPresets.find((p) => Number(p.id) === next) || null;
                    setHeroPresetId(next);
                    setHeroDraft(normalizeHeroConfig(preset?.config_json || HERO_DEFAULTS));
                    setHeroDirty(true);
                  }}
                  disabled={heroPresetsQuery.isLoading || !heroPresets.length}
                >
                  {!heroPresets.length ? <option value="">{t("common.loading")}</option> : null}
                  {heroPresets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.is_builtin ? `⭐ ${p.name}` : p.name}
                    </option>
                  ))}
                </Select>

                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => duplicatePreset.mutate()}
                    disabled={!heroPresetId || duplicatePreset.isPending}
                  >
                    {t("restaurant.hero.duplicate")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPresetEditOpen(true)}
                    disabled={!selectedHeroPreset || selectedHeroPreset?.is_builtin}
                  >
                    {t("restaurant.hero.editPreset")}
                  </Button>
                </div>
              </div>

              <div className="grid gap-1.5">
                <label className="text-sm font-medium">{t("restaurant.hero.backgroundMode")}</label>
                <Select
                  value={heroDraft.backgroundMode || "gradient"}
                  onChange={(e) => updateHeroDraft({ backgroundMode: e.target.value === "solid" ? "solid" : "gradient" })}
                >
                  <option value="solid">{t("restaurant.hero.backgroundModes.solid")}</option>
                  <option value="gradient">{t("restaurant.hero.backgroundModes.gradient")}</option>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <label className="text-sm font-medium">{t("restaurant.hero.accentColor")}</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={colorPickerValue(heroDraft.accentColor, HERO_DEFAULTS.accentColor)}
                    onChange={(e) => updateHeroDraft({ accentColor: e.target.value })}
                    className="h-10 w-10 rounded-md border bg-background"
                  />
                  <Input value={heroDraft.accentColor} onChange={(e) => updateHeroDraft({ accentColor: e.target.value })} placeholder="#F39A1E" />
                </div>
              </div>

              <div className="grid gap-1.5">
                <label className="text-sm font-medium">{t("restaurant.hero.bgSolid")}</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={colorPickerValue(heroDraft.bgSolid, HERO_DEFAULTS.bgSolid)}
                    onChange={(e) => updateHeroDraft({ bgSolid: e.target.value })}
                    className="h-10 w-10 rounded-md border bg-background"
                  />
                  <Input value={heroDraft.bgSolid} onChange={(e) => updateHeroDraft({ bgSolid: e.target.value })} placeholder="#FFF3E6" />
                </div>
              </div>

              <div className="grid gap-1.5">
                <label className="text-sm font-medium">{t("restaurant.hero.bgGradient1")}</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={colorPickerValue(heroDraft.bgGradient?.[0], HERO_DEFAULTS.bgGradient[0])}
                    onChange={(e) => updateHeroDraft({ bgGradient: [e.target.value, heroDraft.bgGradient?.[1] || HERO_DEFAULTS.bgGradient[1]] })}
                    className="h-10 w-10 rounded-md border bg-background"
                    disabled={heroDraft.backgroundMode !== "gradient"}
                  />
                  <Input
                    value={heroDraft.bgGradient?.[0] || ""}
                    onChange={(e) => updateHeroDraft({ bgGradient: [e.target.value, heroDraft.bgGradient?.[1] || HERO_DEFAULTS.bgGradient[1]] })}
                    placeholder="#FFF3E6"
                    disabled={heroDraft.backgroundMode !== "gradient"}
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <label className="text-sm font-medium">{t("restaurant.hero.bgGradient2")}</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={colorPickerValue(heroDraft.bgGradient?.[1], HERO_DEFAULTS.bgGradient[1])}
                    onChange={(e) => updateHeroDraft({ bgGradient: [heroDraft.bgGradient?.[0] || HERO_DEFAULTS.bgGradient[0], e.target.value] })}
                    className="h-10 w-10 rounded-md border bg-background"
                    disabled={heroDraft.backgroundMode !== "gradient"}
                  />
                  <Input
                    value={heroDraft.bgGradient?.[1] || ""}
                    onChange={(e) => updateHeroDraft({ bgGradient: [heroDraft.bgGradient?.[0] || HERO_DEFAULTS.bgGradient[0], e.target.value] })}
                    placeholder="#FFE1B8"
                    disabled={heroDraft.backgroundMode !== "gradient"}
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <label className="text-sm font-medium">{t("restaurant.hero.badgeShape")}</label>
                <Select value={heroDraft.badgeShape || "circle"} onChange={(e) => updateHeroDraft({ badgeShape: e.target.value })}>
                  <option value="circle">{t("restaurant.hero.badgeShapes.circle")}</option>
                  <option value="rounded">{t("restaurant.hero.badgeShapes.rounded")}</option>
                  <option value="squircle">{t("restaurant.hero.badgeShapes.squircle")}</option>
                </Select>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium">{t("restaurant.hero.logoSize")}</label>
                  <div className="text-xs text-muted-foreground">{Math.round(Number(heroDraft.logoSize || 0))}px</div>
                </div>
                <input
                  type="range"
                  min="40"
                  max="120"
                  step="1"
                  value={Number(heroDraft.logoSize || HERO_DEFAULTS.logoSize)}
                  onChange={(e) => updateHeroDraft({ logoSize: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium">{t("restaurant.hero.badgeBlur")}</label>
                  <div className="text-xs text-muted-foreground">{Math.round(Number(heroDraft.badgeBlur || 0))}px</div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="24"
                  step="1"
                  value={Number(heroDraft.badgeBlur ?? HERO_DEFAULTS.badgeBlur)}
                  onChange={(e) => updateHeroDraft({ badgeBlur: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium">{t("restaurant.hero.badgeOpacity")}</label>
                  <div className="text-xs text-muted-foreground">{Math.round(Number(heroDraft.badgeOpacity || 0) * 100)}%</div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={Number(heroDraft.badgeOpacity ?? HERO_DEFAULTS.badgeOpacity)}
                  onChange={(e) => updateHeroDraft({ badgeOpacity: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium">{t("restaurant.hero.badgeBorderOpacity")}</label>
                  <div className="text-xs text-muted-foreground">{Math.round(Number(heroDraft.badgeBorderOpacity || 0) * 100)}%</div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={Number(heroDraft.badgeBorderOpacity ?? HERO_DEFAULTS.badgeBorderOpacity)}
                  onChange={(e) => updateHeroDraft({ badgeBorderOpacity: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium">{t("restaurant.hero.glowStrength")}</label>
                  <div className="text-xs text-muted-foreground">{Math.round(Number(heroDraft.glowStrength || 0) * 100)}%</div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={Number(heroDraft.glowStrength ?? HERO_DEFAULTS.glowStrength)}
                  onChange={(e) => updateHeroDraft({ glowStrength: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium">{t("restaurant.hero.glowRadius")}</label>
                  <div className="text-xs text-muted-foreground">{Math.round(Number(heroDraft.glowRadius || 0))}px</div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="1"
                  value={Number(heroDraft.glowRadius ?? HERO_DEFAULTS.glowRadius)}
                  onChange={(e) => updateHeroDraft({ glowRadius: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium">{t("restaurant.hero.fadeStrength")}</label>
                  <div className="text-xs text-muted-foreground">{Math.round(Number(heroDraft.fadeStrength || 0) * 100)}%</div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={Number(heroDraft.fadeStrength ?? HERO_DEFAULTS.fadeStrength)}
                  onChange={(e) => updateHeroDraft({ fadeStrength: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium">{t("restaurant.hero.radius")}</label>
                  <div className="text-xs text-muted-foreground">{Math.round(Number(heroDraft.radius || 0))}px</div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  step="1"
                  value={Number(heroDraft.radius ?? HERO_DEFAULTS.radius)}
                  onChange={(e) => updateHeroDraft({ radius: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium">{t("restaurant.hero.paddingTop")}</label>
                  <div className="text-xs text-muted-foreground">{Math.round(Number(heroDraft.paddingTop || 0))}px</div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  step="1"
                  value={Number(heroDraft.paddingTop ?? HERO_DEFAULTS.paddingTop)}
                  onChange={(e) => updateHeroDraft({ paddingTop: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium">{t("restaurant.hero.paddingBottom")}</label>
                  <div className="text-xs text-muted-foreground">{Math.round(Number(heroDraft.paddingBottom || 0))}px</div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="48"
                  step="1"
                  value={Number(heroDraft.paddingBottom ?? HERO_DEFAULTS.paddingBottom)}
                  onChange={(e) => updateHeroDraft({ paddingBottom: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>

          </div>

          <Dialog open={presetEditOpen} onOpenChange={setPresetEditOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{t("restaurant.hero.editPreset")}</DialogTitle>
                <DialogDescription>{t("restaurant.hero.editPresetHint")}</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4">
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">{t("restaurant.hero.presetName")}</label>
                  <Input value={presetEditName} onChange={(e) => setPresetEditName(e.target.value)} />
                </div>

                <div className="grid gap-3 rounded-xl border bg-muted/20 p-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium">{t("restaurant.hero.backgroundMode")}</label>
                    <Select
                      value={presetEditConfig.backgroundMode || "gradient"}
                      onChange={(e) => setPresetEditConfig((p) => ({ ...p, backgroundMode: e.target.value === "solid" ? "solid" : "gradient" }))}
                    >
                      <option value="solid">{t("restaurant.hero.backgroundModes.solid")}</option>
                      <option value="gradient">{t("restaurant.hero.backgroundModes.gradient")}</option>
                    </Select>
                  </div>

                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium">{t("restaurant.hero.accentColor")}</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={colorPickerValue(presetEditConfig.accentColor, HERO_DEFAULTS.accentColor)}
                        onChange={(e) => setPresetEditConfig((p) => ({ ...p, accentColor: e.target.value }))}
                        className="h-10 w-10 rounded-md border bg-background"
                      />
                      <Input value={presetEditConfig.accentColor} onChange={(e) => setPresetEditConfig((p) => ({ ...p, accentColor: e.target.value }))} />
                    </div>
                  </div>

                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium">{t("restaurant.hero.bgSolid")}</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={colorPickerValue(presetEditConfig.bgSolid, HERO_DEFAULTS.bgSolid)}
                        onChange={(e) => setPresetEditConfig((p) => ({ ...p, bgSolid: e.target.value }))}
                        className="h-10 w-10 rounded-md border bg-background"
                      />
                      <Input value={presetEditConfig.bgSolid} onChange={(e) => setPresetEditConfig((p) => ({ ...p, bgSolid: e.target.value }))} />
                    </div>
                  </div>

                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium">{t("restaurant.hero.bgGradient1")}</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={colorPickerValue(presetEditConfig.bgGradient?.[0], HERO_DEFAULTS.bgGradient[0])}
                        onChange={(e) =>
                          setPresetEditConfig((p) => ({ ...p, bgGradient: [e.target.value, p.bgGradient?.[1] || HERO_DEFAULTS.bgGradient[1]] }))
                        }
                        className="h-10 w-10 rounded-md border bg-background"
                        disabled={presetEditConfig.backgroundMode !== "gradient"}
                      />
                      <Input
                        value={presetEditConfig.bgGradient?.[0] || ""}
                        onChange={(e) =>
                          setPresetEditConfig((p) => ({ ...p, bgGradient: [e.target.value, p.bgGradient?.[1] || HERO_DEFAULTS.bgGradient[1]] }))
                        }
                        disabled={presetEditConfig.backgroundMode !== "gradient"}
                      />
                    </div>
                  </div>

                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium">{t("restaurant.hero.bgGradient2")}</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={colorPickerValue(presetEditConfig.bgGradient?.[1], HERO_DEFAULTS.bgGradient[1])}
                        onChange={(e) =>
                          setPresetEditConfig((p) => ({ ...p, bgGradient: [p.bgGradient?.[0] || HERO_DEFAULTS.bgGradient[0], e.target.value] }))
                        }
                        className="h-10 w-10 rounded-md border bg-background"
                        disabled={presetEditConfig.backgroundMode !== "gradient"}
                      />
                      <Input
                        value={presetEditConfig.bgGradient?.[1] || ""}
                        onChange={(e) =>
                          setPresetEditConfig((p) => ({ ...p, bgGradient: [p.bgGradient?.[0] || HERO_DEFAULTS.bgGradient[0], e.target.value] }))
                        }
                        disabled={presetEditConfig.backgroundMode !== "gradient"}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="text-sm font-semibold">{t("settings.preview")}</div>
                  <div className="pointer-events-none mt-3">
                    <HeroHeaderPreview
                      theme={savedTheme}
                      config={presetEditConfig}
                      restaurantName={restaurant?.name || ""}
                      subtitle={restaurant?.description || ""}
                      logoUrl={restaurant?.logo_url || null}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setPresetEditOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  type="button"
                  onClick={() => savePresetEdit.mutate()}
                  disabled={!selectedHeroPreset || selectedHeroPreset?.is_builtin || savePresetEdit.isPending}
                >
                  {savePresetEdit.isPending ? t("common.loading") : t("common.save")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("restaurant.headerStyle.title")}</CardTitle>
          <CardDescription>{t("restaurant.headerStyle.hint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form className="grid gap-4" onSubmit={restaurantForm.handleSubmit((v) => saveRestaurantStyle.mutate(v))}>
            <div className="grid gap-3 rounded-xl border bg-muted/20 p-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">{t("restaurant.headerStyle.color")}</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={colorPickerValue(restaurantForm.watch("headerColor"), "#f39a1e")}
                      onChange={(e) => restaurantForm.setValue("headerColor", e.target.value, { shouldDirty: true })}
                      className="h-10 w-10 rounded-md border bg-background"
                    />
                    <Input {...restaurantForm.register("headerColor")} placeholder="#F39A1E" />
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">{t("restaurant.headerStyle.effect")}</label>
                  <Select {...restaurantForm.register("effect")}>
                    <option value="glowGradient">{t("restaurant.headerStyle.effects.glowGradient")}</option>
                    <option value="minimal">{t("restaurant.headerStyle.effects.minimal")}</option>
                    <option value="sunset">{t("restaurant.headerStyle.effects.sunset")}</option>
                    <option value="glass">{t("restaurant.headerStyle.effects.glass")}</option>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium">{t("restaurant.headerStyle.glow")}</label>
                    <div className="text-xs text-muted-foreground">{Math.round(Number(restaurantForm.watch("glow") ?? 0) * 100)}%</div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={Number(restaurantForm.watch("glow") ?? 0.55)}
                    onChange={(e) => restaurantForm.setValue("glow", Number(e.target.value), { shouldDirty: true })}
                    className="w-full"
                  />
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium">{t("restaurant.headerStyle.fade")}</label>
                    <div className="text-xs text-muted-foreground">{Math.round(Number(restaurantForm.watch("fade") ?? 0) * 100)}%</div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={Number(restaurantForm.watch("fade") ?? 0.75)}
                    onChange={(e) => restaurantForm.setValue("fade", Number(e.target.value), { shouldDirty: true })}
                    className="w-full"
                  />
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium">{t("restaurant.headerStyle.shadow")}</label>
                    <div className="text-xs text-muted-foreground">{Math.round(Number(restaurantForm.watch("shadow") ?? 0) * 100)}%</div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={Number(restaurantForm.watch("shadow") ?? 0.35)}
                    onChange={(e) => restaurantForm.setValue("shadow", Number(e.target.value), { shouldDirty: true })}
                    className="w-full"
                  />
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium">{t("restaurant.headerStyle.radius")}</label>
                    <div className="text-xs text-muted-foreground">{Math.round(Number(restaurantForm.watch("radius") ?? 0))}px</div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    step="1"
                    value={Number(restaurantForm.watch("radius") ?? 24)}
                    onChange={(e) => restaurantForm.setValue("radius", Number(e.target.value), { shouldDirty: true })}
                    className="w-full"
                  />
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">{t("restaurant.headerStyle.accent")}</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={colorPickerValue(restaurantForm.watch("accentColor"), "#ffffff")}
                      onChange={(e) => restaurantForm.setValue("accentColor", e.target.value, { shouldDirty: true })}
                      className="h-10 w-10 rounded-md border bg-background"
                    />
                    <Input {...restaurantForm.register("accentColor")} placeholder="#FFFFFF33" />
                  </div>
                </div>
            </div>

          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("category.headerStyle.title")}</CardTitle>
          <CardDescription>{t("category.headerStyle.hint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form className="grid gap-4" onSubmit={categoryForm.handleSubmit((v) => saveCategoryStyle.mutate(v))}>
            <div className="grid gap-3 rounded-xl border bg-muted/20 p-3 sm:grid-cols-2">
                <div className="grid gap-1.5 sm:col-span-2">
                  <label className="text-sm font-medium">{t("public.category")}</label>
                  <Select
                    value={categoryId ? String(categoryId) : ""}
                    onChange={(e) => {
                      const next = Number(e.target.value || 0);
                      if (categoryForm.formState.isDirty) {
                        const ok = window.confirm("Discard unsaved category header changes?");
                        if (!ok) return;
                      }
                      setCategoryId(next);
                    }}
                    disabled={categoriesQuery.isLoading || !categories.length}
                  >
                    {!categories.length ? <option value="">{t("admin.categories.title")}</option> : null}
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">{t("restaurant.headerStyle.color")}</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={colorPickerValue(categoryForm.watch("headerColor"), "#f39a1e")}
                      onChange={(e) => categoryForm.setValue("headerColor", e.target.value, { shouldDirty: true })}
                      className="h-10 w-10 rounded-md border bg-background"
                    />
                    <Input {...categoryForm.register("headerColor")} placeholder="#F39A1E" />
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">{t("restaurant.headerStyle.effect")}</label>
                  <Select {...categoryForm.register("effect")}>
                    <option value="glowGradient">{t("restaurant.headerStyle.effects.glowGradient")}</option>
                    <option value="minimal">{t("restaurant.headerStyle.effects.minimal")}</option>
                    <option value="sunset">{t("restaurant.headerStyle.effects.sunset")}</option>
                    <option value="glass">{t("restaurant.headerStyle.effects.glass")}</option>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium">{t("restaurant.headerStyle.glow")}</label>
                    <div className="text-xs text-muted-foreground">{Math.round(Number(categoryForm.watch("glow") ?? 0) * 100)}%</div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={Number(categoryForm.watch("glow") ?? 0.55)}
                    onChange={(e) => categoryForm.setValue("glow", Number(e.target.value), { shouldDirty: true })}
                    className="w-full"
                  />
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium">{t("restaurant.headerStyle.fade")}</label>
                    <div className="text-xs text-muted-foreground">{Math.round(Number(categoryForm.watch("fade") ?? 0) * 100)}%</div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={Number(categoryForm.watch("fade") ?? 0.75)}
                    onChange={(e) => categoryForm.setValue("fade", Number(e.target.value), { shouldDirty: true })}
                    className="w-full"
                  />
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium">{t("restaurant.headerStyle.shadow")}</label>
                    <div className="text-xs text-muted-foreground">{Math.round(Number(categoryForm.watch("shadow") ?? 0) * 100)}%</div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={Number(categoryForm.watch("shadow") ?? 0.35)}
                    onChange={(e) => categoryForm.setValue("shadow", Number(e.target.value), { shouldDirty: true })}
                    className="w-full"
                  />
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium">{t("restaurant.headerStyle.radius")}</label>
                    <div className="text-xs text-muted-foreground">{Math.round(Number(categoryForm.watch("radius") ?? 0))}px</div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    step="1"
                    value={Number(categoryForm.watch("radius") ?? 24)}
                    onChange={(e) => categoryForm.setValue("radius", Number(e.target.value), { shouldDirty: true })}
                    className="w-full"
                  />
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">{t("restaurant.headerStyle.accent")}</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={colorPickerValue(categoryForm.watch("accentColor"), "#ffffff")}
                      onChange={(e) => categoryForm.setValue("accentColor", e.target.value, { shouldDirty: true })}
                      className="h-10 w-10 rounded-md border bg-background"
                    />
                    <Input {...categoryForm.register("accentColor")} placeholder="#FFFFFF33" />
                  </div>
                </div>
            </div>

          </form>
        </CardContent>
      </Card>
    </div>
  );
}
