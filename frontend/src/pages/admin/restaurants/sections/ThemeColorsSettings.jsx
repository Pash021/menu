import React, { useCallback, useEffect, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { updateRestaurantTheme } from "@/api/themes";
import { getApiErrorMessage } from "@/api/client";
import { useI18n } from "@/lib/i18n";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeMiniPreview, normalizeThemeForProvider } from "@/components/theme/ThemeMiniPreview";
import { mergeTheme } from "@/themes";
import { MENU_TOKENS, normalizeMenuTokenVars, serializeMenuTokenVarsToLegacy } from "@/lib/menuDesignTokens";
import { useSettingsPanel } from "../SettingsPanelContext";

const schema = z.object({
  theme_id: z.coerce.number().optional(),
  category_layout: z.string().optional(),
  transition: z.string().optional(),
  card_style: z.string().optional(),
  colors: z
    .object({
      background: z.string().optional(),
      surface: z.string().optional(),
      border: z.string().optional(),
      textPrimary: z.string().optional(),
      textMuted: z.string().optional(),
      accent: z.string().optional(),
      accentSecondary: z.string().optional(),
      categoryButton: z.string().optional(),
    })
    .optional(),
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

export default function ThemeColorsSettings() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { restaurantId, restaurant, themes } = useOutletContext();
  const { setPreview, setSaveBar, setDirty } = useSettingsPanel();

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      theme_id: "",
      category_layout: "",
      transition: "",
      card_style: "",
      colors: {
        background: "",
        surface: "",
        border: "",
        textPrimary: "",
        textMuted: "",
        accent: "",
        accentSecondary: "",
        categoryButton: "",
      },
    },
  });

  useEffect(() => {
    if (!restaurant) return;
    const ov = restaurant.theme_overrides_json || {};
    const vars = normalizeMenuTokenVars(ov.vars || {});
    form.reset({
      theme_id: restaurant.theme_id ?? "",
      category_layout: ov.category_layout ?? "",
      transition: ov.transition ?? "",
      card_style: ov.card_style ?? "",
      colors: {
        background: vars[MENU_TOKENS.background] ?? "",
        surface: vars[MENU_TOKENS.surface] ?? "",
        border: vars[MENU_TOKENS.border] ?? "",
        textPrimary: vars[MENU_TOKENS.textPrimary] ?? "",
        textMuted: vars[MENU_TOKENS.textMuted] ?? "",
        accent: vars[MENU_TOKENS.accent] ?? "",
        accentSecondary: vars[MENU_TOKENS.accentSecondary] ?? "",
        categoryButton: vars[MENU_TOKENS.categoryButton] ?? "",
      },
    });
  }, [form, restaurant]);

  useUnsavedChangesGuard(form.formState.isDirty);
  const isDirty = form.formState.isDirty;

  const saveMutation = useMutation({
    mutationFn: async (values) => {
      const vars = {};
      const putVar = (key, value) => {
        const v = String(value || "").trim();
        if (v) vars[key] = v;
      };
      putVar(MENU_TOKENS.background, values.colors?.background);
      putVar(MENU_TOKENS.surface, values.colors?.surface);
      putVar(MENU_TOKENS.border, values.colors?.border);
      putVar(MENU_TOKENS.textPrimary, values.colors?.textPrimary);
      putVar(MENU_TOKENS.textMuted, values.colors?.textMuted);
      putVar(MENU_TOKENS.accent, values.colors?.accent);
      putVar(MENU_TOKENS.accentSecondary, values.colors?.accentSecondary);
      putVar(MENU_TOKENS.categoryButton, values.colors?.categoryButton);

      const overrides = {};
      const legacyVars = serializeMenuTokenVarsToLegacy(vars);
      if (Object.keys(legacyVars).length) overrides.vars = legacyVars;
      if (String(values.category_layout || "").trim()) overrides.category_layout = String(values.category_layout).trim();
      if (String(values.transition || "").trim()) overrides.transition = String(values.transition).trim();
      if (String(values.card_style || "").trim()) overrides.card_style = String(values.card_style).trim();

      return updateRestaurantTheme(restaurantId, {
        theme_id: values.theme_id || restaurant?.theme_id,
        overrides,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["restaurant", restaurantId] });
      toast.success(t("toast.updated"));
      form.reset(form.getValues());
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const selectedThemeId = Number(form.watch("theme_id") || restaurant?.theme_id || 0);
  const selectedTheme = themes.find((x) => Number(x.id) === selectedThemeId) || themes[0] || null;
  const placeholderVars = normalizeMenuTokenVars(selectedTheme?.config_json?.vars || {});
  const colors = form.watch("colors") || {};

  const previewVars = {};
  const setPreviewVar = (key, v) => {
    const value = String(v || "").trim();
    if (!value) return;
    previewVars[key] = value;
  };
  setPreviewVar(MENU_TOKENS.background, colors.background);
  setPreviewVar(MENU_TOKENS.surface, colors.surface);
  setPreviewVar(MENU_TOKENS.border, colors.border);
  setPreviewVar(MENU_TOKENS.textPrimary, colors.textPrimary);
  setPreviewVar(MENU_TOKENS.textMuted, colors.textMuted);
  setPreviewVar(MENU_TOKENS.accent, colors.accent);
  setPreviewVar(MENU_TOKENS.accentSecondary, colors.accentSecondary);
  setPreviewVar(MENU_TOKENS.categoryButton, colors.categoryButton);

  const previewOverrides = {};
  if (Object.keys(previewVars).length) previewOverrides.vars = previewVars;
  const layout = String(form.watch("category_layout") || "").trim();
  const transition = String(form.watch("transition") || "").trim();
  const cardStyle = String(form.watch("card_style") || "").trim();
  if (layout) previewOverrides.category_layout = layout;
  if (transition) previewOverrides.transition = transition;
  if (cardStyle) previewOverrides.card_style = cardStyle;

  const previewConfig = mergeTheme(selectedTheme?.config_json || {}, previewOverrides);
  const previewTheme = normalizeThemeForProvider({
    preset_key: selectedTheme?.preset_key,
    name: selectedTheme?.name,
    config_json: previewConfig,
  });

  const resetOverrides = useCallback(() => {
    const id = form.getValues("theme_id");
    form.reset({
      ...form.getValues(),
      theme_id: id,
      category_layout: "",
      transition: "",
      card_style: "",
      colors: {
        background: "",
        surface: "",
        border: "",
        textPrimary: "",
        textMuted: "",
        accent: "",
        accentSecondary: "",
        categoryButton: "",
      },
    });
  }, [form]);

  const cancel = useCallback(() => {
    const ov = restaurant?.theme_overrides_json || {};
    const vars = normalizeMenuTokenVars(ov.vars || {});
    form.reset({
      theme_id: restaurant?.theme_id ?? "",
      category_layout: ov.category_layout ?? "",
      transition: ov.transition ?? "",
      card_style: ov.card_style ?? "",
      colors: {
        background: vars[MENU_TOKENS.background] ?? "",
        surface: vars[MENU_TOKENS.surface] ?? "",
        border: vars[MENU_TOKENS.border] ?? "",
        textPrimary: vars[MENU_TOKENS.textPrimary] ?? "",
        textMuted: vars[MENU_TOKENS.textMuted] ?? "",
        accent: vars[MENU_TOKENS.accent] ?? "",
        accentSecondary: vars[MENU_TOKENS.accentSecondary] ?? "",
        categoryButton: vars[MENU_TOKENS.categoryButton] ?? "",
      },
    });
  }, [form, restaurant?.theme_id, restaurant?.theme_overrides_json]);

  const onSave = useMemo(() => form.handleSubmit((values) => saveMutation.mutate(values)), [form, saveMutation]);

  const previewNode = useMemo(
    () => (
      <div className="space-y-3">
        <div>
          <div className="text-sm font-semibold">{t("settings.preview")}</div>
          <div className="mt-1 text-sm text-muted-foreground">{t("settings.preview.readonly")}</div>
        </div>
        <div className="pointer-events-none">
          <ThemeMiniPreview theme={previewTheme} />
        </div>
      </div>
    ),
    [previewTheme, t]
  );

  const saveBar = useMemo(
    () => (
      <>
        <Button type="button" variant="outline" onClick={resetOverrides}>
          {t("restaurant.theme.resetOverrides")}
        </Button>
        <Button type="button" variant="secondary" onClick={cancel}>
          {t("common.cancel")}
        </Button>
        <Button type="button" onClick={onSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? t("common.loading") : t("common.save")}
        </Button>
      </>
    ),
    [cancel, onSave, resetOverrides, saveMutation.isPending, t]
  );

  useEffect(() => {
    setPreview(previewNode);
    return () => setPreview(null);
  }, [previewNode, setPreview]);

  useEffect(() => {
    setDirty(isDirty);
    setSaveBar(isDirty ? saveBar : null);
    return () => {
      setDirty(false);
      setSaveBar(null);
    };
  }, [isDirty, saveBar, setDirty, setSaveBar]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.sections.theme")}</CardTitle>
        <CardDescription>{t("restaurant.theme.hint")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="grid gap-4" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="grid gap-2">
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">{t("restaurant.theme.preset")}</label>
                <Select {...form.register("theme_id")}>
                  <option value="">{t("common.optional")}</option>
                  {themes.map((th) => (
                    <option key={th.id} value={th.id}>
                      {th.name} ({th.preset_key})
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="grid gap-3 rounded-xl border bg-muted/20 p-3">
                <div className="text-sm font-semibold">{t("restaurant.theme.options")}</div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">{t("restaurant.theme.layout")}</label>
                  <Select {...form.register("category_layout")}>
                    <option value="">{t("common.optional")}</option>
                    <option value="pills">pills</option>
                    <option value="gridCards">gridCards</option>
                    <option value="carousel">carousel</option>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">{t("restaurant.theme.transition")}</label>
                  <Select {...form.register("transition")}>
                    <option value="">{t("common.optional")}</option>
                    <option value="slide">slide</option>
                    <option value="fade">fade</option>
                    <option value="pageFlip">pageFlip</option>
                    <option value="pageCurlLite">pageCurlLite</option>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">{t("restaurant.theme.cardStyle")}</label>
                  <Select {...form.register("card_style")}>
                    <option value="">{t("common.optional")}</option>
                    <option value="glass">glass</option>
                    <option value="flat">flat</option>
                    <option value="glow">glow</option>
                  </Select>
                </div>
              </div>

	              <div className="grid gap-3 rounded-xl border bg-muted/20 p-3">
	                <div className="text-sm font-semibold">{t("restaurant.theme.colors")}</div>

	                <div className="grid gap-1.5 sm:grid-cols-[160px_44px_1fr] sm:items-center">
	                  <div className="text-sm text-muted-foreground">{t("restaurant.theme.color.background")}</div>
	                  <input
	                    type="color"
	                    className="h-10 w-11 rounded-md border bg-background"
	                    value={colorPickerValue(colors.background, placeholderVars[MENU_TOKENS.background] || "#FFF4E6")}
	                    onChange={(e) => form.setValue("colors.background", e.target.value, { shouldDirty: true })}
	                    aria-label={t("restaurant.theme.color.background")}
	                  />
	                  <Input {...form.register("colors.background")} placeholder={placeholderVars[MENU_TOKENS.background] || "#FFF4E6"} />
	                </div>
	                <div className="grid gap-1.5 sm:grid-cols-[160px_1fr] sm:items-center">
	                  <div className="text-sm text-muted-foreground">{t("restaurant.theme.color.surface")}</div>
	                  <Input {...form.register("colors.surface")} placeholder={placeholderVars[MENU_TOKENS.surface] || "rgba(255,255,255,0.68)"} />
	                </div>
	                <div className="grid gap-1.5 sm:grid-cols-[160px_1fr] sm:items-center">
	                  <div className="text-sm text-muted-foreground">{t("restaurant.theme.color.border")}</div>
	                  <Input {...form.register("colors.border")} placeholder={placeholderVars[MENU_TOKENS.border] || "rgba(12,7,3,0.10)"} />
	                </div>
	                <div className="grid gap-1.5 sm:grid-cols-[160px_44px_1fr] sm:items-center">
	                  <div className="text-sm text-muted-foreground">{t("restaurant.theme.color.textPrimary")}</div>
	                  <input
	                    type="color"
	                    className="h-10 w-11 rounded-md border bg-background"
	                    value={colorPickerValue(colors.textPrimary, placeholderVars[MENU_TOKENS.textPrimary] || "#0C0703")}
	                    onChange={(e) => form.setValue("colors.textPrimary", e.target.value, { shouldDirty: true })}
	                    aria-label={t("restaurant.theme.color.textPrimary")}
	                  />
	                  <Input {...form.register("colors.textPrimary")} placeholder={placeholderVars[MENU_TOKENS.textPrimary] || "rgba(12,7,3,0.96)"} />
	                </div>
	                <div className="grid gap-1.5 sm:grid-cols-[160px_44px_1fr] sm:items-center">
	                  <div className="text-sm text-muted-foreground">{t("restaurant.theme.color.textMuted")}</div>
	                  <input
	                    type="color"
	                    className="h-10 w-11 rounded-md border bg-background"
	                    value={colorPickerValue(colors.textMuted, placeholderVars[MENU_TOKENS.textMuted] || "#3A2A1F")}
	                    onChange={(e) => form.setValue("colors.textMuted", e.target.value, { shouldDirty: true })}
	                    aria-label={t("restaurant.theme.color.textMuted")}
	                  />
	                  <Input {...form.register("colors.textMuted")} placeholder={placeholderVars[MENU_TOKENS.textMuted] || "rgba(12,7,3,0.55)"} />
	                </div>
	                <div className="grid gap-1.5 sm:grid-cols-[160px_44px_1fr] sm:items-center">
	                  <div className="text-sm text-muted-foreground">{t("restaurant.theme.color.accent")}</div>
	                  <input
	                    type="color"
	                    className="h-10 w-11 rounded-md border bg-background"
	                    value={colorPickerValue(colors.accent, placeholderVars[MENU_TOKENS.accent] || "#F39A1E")}
	                    onChange={(e) => form.setValue("colors.accent", e.target.value, { shouldDirty: true })}
	                    aria-label={t("restaurant.theme.color.accent")}
	                  />
	                  <Input {...form.register("colors.accent")} placeholder={placeholderVars[MENU_TOKENS.accent] || "#F39A1E"} />
	                </div>
	                <div className="grid gap-1.5 sm:grid-cols-[160px_44px_1fr] sm:items-center">
	                  <div className="text-sm text-muted-foreground">{t("restaurant.theme.color.accentSecondary")}</div>
	                  <input
	                    type="color"
	                    className="h-10 w-11 rounded-md border bg-background"
	                    value={colorPickerValue(colors.accentSecondary, placeholderVars[MENU_TOKENS.accentSecondary] || "#FFB64D")}
	                    onChange={(e) => form.setValue("colors.accentSecondary", e.target.value, { shouldDirty: true })}
	                    aria-label={t("restaurant.theme.color.accentSecondary")}
	                  />
	                  <Input {...form.register("colors.accentSecondary")} placeholder={placeholderVars[MENU_TOKENS.accentSecondary] || "#FFB64D"} />
	                </div>
	                <div className="grid gap-1.5 sm:grid-cols-[160px_44px_1fr] sm:items-center">
	                  <div className="text-sm text-muted-foreground">{t("restaurant.theme.color.categoryButton")}</div>
	                  <input
	                    type="color"
	                    className="h-10 w-11 rounded-md border bg-background"
	                    value={colorPickerValue(colors.categoryButton, placeholderVars[MENU_TOKENS.categoryButton] || "#F39A1E")}
	                    onChange={(e) => form.setValue("colors.categoryButton", e.target.value, { shouldDirty: true })}
	                    aria-label={t("restaurant.theme.color.categoryButton")}
	                  />
	                  <Input {...form.register("colors.categoryButton")} placeholder={placeholderVars[MENU_TOKENS.categoryButton] || "#F39A1E"} />
	                </div>
	              </div>

	            </div>
          </div>
        </form>

      </CardContent>
    </Card>
  );
}
