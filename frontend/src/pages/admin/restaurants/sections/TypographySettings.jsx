import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Trash2, Upload } from "lucide-react";
import { getApiErrorMessage } from "@/api/client";
import { deleteRestaurantFont, listRestaurantFonts, updateRestaurant, uploadRestaurantFont } from "@/api/restaurants";
import { useI18n } from "@/lib/i18n";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useRestaurantFont } from "@/hooks/useRestaurantFont";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TopBrandHeader } from "@/pages/public/menu/components/TopBrandHeader";
import { CategoryPillButton } from "@/pages/public/menu/components/CategoryPillButton";
import { MenuItemCard } from "@/pages/public/menu/components/MenuItemCard";
import shellStyles from "@/pages/public/menu/PublicMenuShell.module.css";
import { MENU_TOKENS } from "@/lib/menuDesignTokens";
import { useSettingsPanel } from "../SettingsPanelContext";

const schema = z.object({
  menu_font: z.string().optional(),
  menu_font_size: z.coerce.number().optional(),
  menu_font_brand: z.string().optional(),
  menu_font_brand_size: z.coerce.number().optional(),
  menu_font_category: z.string().optional(),
  menu_font_category_size: z.coerce.number().optional(),
  menu_font_item: z.string().optional(),
  menu_font_item_size: z.coerce.number().optional(),
});

function validateFontFile(file) {
  if (!file) return "Ֆայլը ընտրված չէ";
  const name = String(file.name || "").toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  const allowed = [".woff2", ".woff", ".ttf", ".otf"];
  if (!allowed.includes(ext)) return "Թույլատրվում է միայն WOFF2/WOFF/TTF/OTF";
  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) return "Ֆայլը չափազանց մեծ է (max 5MB)";
  return null;
}

function fontLabel(value) {
  if (value === "system") return "System";
  if (value === "sans") return "Sans";
  if (value === "serif") return "Serif";
  if (!value) return "Serif";
  if (value.startsWith("fonts/")) return value.split("/").pop();
  return value;
}

export default function TypographySettings() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { restaurantId, restaurant, savedTheme } = useOutletContext();
  const { setPreview, setSaveBar, setDirty } = useSettingsPanel();
  const [fontFile, setFontFile] = useState(null);

  const fontsQuery = useQuery({
    queryKey: ["restaurantFonts", restaurantId],
    queryFn: () => listRestaurantFonts(restaurantId),
    enabled: Boolean(restaurantId),
    retry: false,
  });

  const fontItems = useMemo(() => fontsQuery.data?.items ?? fontsQuery.data ?? [], [fontsQuery.data]);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      menu_font: "serif",
      menu_font_size: 16,
      menu_font_brand: "",
      menu_font_brand_size: "",
      menu_font_category: "",
      menu_font_category_size: "",
      menu_font_item: "",
      menu_font_item_size: "",
    },
  });

  useEffect(() => {
    if (!restaurant) return;
    form.reset({
      menu_font: restaurant.menu_font ?? "serif",
      menu_font_size: Number(restaurant.menu_font_size ?? 16),
      menu_font_brand: restaurant.menu_font_brand ?? "",
      menu_font_brand_size: restaurant.menu_font_brand_size ?? "",
      menu_font_category: restaurant.menu_font_category ?? "",
      menu_font_category_size: restaurant.menu_font_category_size ?? "",
      menu_font_item: restaurant.menu_font_item ?? "",
      menu_font_item_size: restaurant.menu_font_item_size ?? "",
    });
  }, [form, restaurant]);

  useUnsavedChangesGuard(form.formState.isDirty);
  const isDirty = form.formState.isDirty;

  const uploadFontMutation = useMutation({
    mutationFn: async (file) => uploadRestaurantFont(restaurantId, file),
    onSuccess: async (payload) => {
      await queryClient.invalidateQueries({ queryKey: ["restaurantFonts", restaurantId] });
      const path = payload?.path || null;
      if (path) {
        form.setValue("menu_font", path, { shouldDirty: true });
      }
      toast.success(t("toast.saved"));
      setFontFile(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const deleteFontMutation = useMutation({
    mutationFn: async (path) => deleteRestaurantFont(restaurantId, path),
    onSuccess: async (_, path) => {
      await queryClient.invalidateQueries({ queryKey: ["restaurantFonts", restaurantId] });
      const p = String(path || "");
      ["menu_font", "menu_font_brand", "menu_font_category", "menu_font_item"].forEach((k) => {
        if (String(form.getValues(k) || "") === p) form.setValue(k, "", { shouldDirty: true });
      });
      toast.success(t("toast.deleted"));
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const saveMutation = useMutation({
    mutationFn: async (values) =>
      updateRestaurant(restaurantId, {
        menu_font: String(values.menu_font || "serif"),
        menu_font_size: Number(values.menu_font_size ?? 16),
        menu_font_brand: String(values.menu_font_brand || "").trim() || null,
        menu_font_brand_size: values.menu_font_brand_size === "" ? null : Number(values.menu_font_brand_size ?? 0),
        menu_font_category: String(values.menu_font_category || "").trim() || null,
        menu_font_category_size: values.menu_font_category_size === "" ? null : Number(values.menu_font_category_size ?? 0),
        menu_font_item: String(values.menu_font_item || "").trim() || null,
        menu_font_item_size: values.menu_font_item_size === "" ? null : Number(values.menu_font_item_size ?? 0),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["restaurant", restaurantId] });
      toast.success(t("toast.updated"));
      form.reset(form.getValues());
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const baseFontValue = form.watch("menu_font") || "serif";
  const brandFontValue = form.watch("menu_font_brand") || baseFontValue;
  const categoryFontValue = form.watch("menu_font_category") || baseFontValue;
  const itemFontValue = form.watch("menu_font_item") || baseFontValue;

  const baseFont = useRestaurantFont(restaurant, baseFontValue, "admin-base");
  const brandFont = useRestaurantFont(restaurant, brandFontValue, "admin-brand");
  const categoryFont = useRestaurantFont(restaurant, categoryFontValue, "admin-category");
  const itemFont = useRestaurantFont(restaurant, itemFontValue, "admin-item");

  const brandSize = Number(form.watch("menu_font_brand_size") || 0) || null;
  const categorySize = Number(form.watch("menu_font_category_size") || 0) || null;
  const itemSize = Number(form.watch("menu_font_item_size") || 0) || null;
  const baseSize = Number(form.watch("menu_font_size") || 16) || 16;

  const previewVars = useMemo(() => {
    return {
      [MENU_TOKENS.fontBody]: baseFont.fontFamily,
      [MENU_TOKENS.fontBrand]: brandFont.fontFamily,
      [MENU_TOKENS.fontCategory]: categoryFont.fontFamily,
      [MENU_TOKENS.fontItem]: itemFont.fontFamily,
      [MENU_TOKENS.fontBrandSize]: brandSize ? `${brandSize}px` : undefined,
      [MENU_TOKENS.fontCategorySize]: categorySize ? `${categorySize}px` : undefined,
      [MENU_TOKENS.fontItemSize]: itemSize ? `${itemSize}px` : undefined,
    };
  }, [baseFont.fontFamily, brandFont.fontFamily, categoryFont.fontFamily, itemFont.fontFamily, brandSize, categorySize, itemSize]);

  const sampleDish = useMemo(
    () => ({
      id: "preview",
      name: "Chicken Burger",
      description: "Crispy chicken, lettuce, sauce",
      price: 10.5,
      currency: "",
      is_spicy: true,
      is_vegan: false,
      available: true,
      image_url: null,
    }),
    []
  );

  const cancel = useCallback(() => {
    if (!restaurant) return;
    form.reset({
      menu_font: restaurant.menu_font ?? "serif",
      menu_font_size: Number(restaurant.menu_font_size ?? 16),
      menu_font_brand: restaurant.menu_font_brand ?? "",
      menu_font_brand_size: restaurant.menu_font_brand_size ?? "",
      menu_font_category: restaurant.menu_font_category ?? "",
      menu_font_category_size: restaurant.menu_font_category_size ?? "",
      menu_font_item: restaurant.menu_font_item ?? "",
      menu_font_item_size: restaurant.menu_font_item_size ?? "",
    });
  }, [form, restaurant]);

  const onSave = useMemo(() => form.handleSubmit((v) => saveMutation.mutate(v)), [form, saveMutation]);

  const previewNode = useMemo(
    () => (
      <div className="space-y-3">
        <div>
          <div className="text-sm font-semibold">{t("settings.preview")}</div>
          <div className="mt-1 text-sm text-muted-foreground">{t("settings.preview.readonly")}</div>
        </div>
        <div className="pointer-events-none overflow-hidden rounded-2xl border bg-card">
          <ThemeProvider theme={savedTheme} className={shellStyles.shell} style={{ ...previewVars }}>
            <div style={{ padding: "16px" }}>
              <TopBrandHeader variant="home" restaurant={restaurant} />
              <div className="mt-3 grid gap-2">
                <CategoryPillButton label="CHICKEN" artPosition="right" disabled />
                <MenuItemCard dish={sampleDish} onOpen={() => {}} />
              </div>
              <div
                className="mt-3 rounded-xl border bg-muted/10 p-3 text-xs text-muted-foreground"
                style={{ fontFamily: baseFont.fontFamily, fontSize: `${baseSize}px` }}
              >
                {t("restaurant.menuFont.size")}: {baseSize}px
              </div>
            </div>
          </ThemeProvider>
        </div>
      </div>
    ),
    [baseFont.fontFamily, baseSize, previewVars, restaurant, sampleDish, savedTheme, t]
  );

  const saveBar = useMemo(
    () => (
      <>
        <Button type="button" variant="secondary" onClick={cancel}>
          {t("common.cancel")}
        </Button>
        <Button type="button" onClick={onSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? t("common.loading") : t("common.save")}
        </Button>
      </>
    ),
    [cancel, onSave, saveMutation.isPending, t]
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
        <CardTitle>{t("restaurant.menuFont")}</CardTitle>
        <CardDescription>{t("restaurant.menuFont.hint")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="grid gap-3" onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}>
              <div className="grid gap-3 rounded-xl border bg-muted/20 p-3">
                <div className="text-sm font-semibold">{t("restaurant.menuFont.brand")}</div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">{t("restaurant.menuFont")}</label>
                  <Select {...form.register("menu_font_brand")}>
                    <option value="">{t("common.optional")}</option>
                    <option value="serif">{fontLabel("serif")}</option>
                    <option value="sans">{fontLabel("sans")}</option>
                    <option value="system">{fontLabel("system")}</option>
                    {fontItems.map((f) => (
                      <option key={f.path} value={f.path}>
                        {f.filename || f.path}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">{t("restaurant.menuFont.size")}</label>
                  <Select {...form.register("menu_font_brand_size")}>
                    <option value="">{t("common.optional")}</option>
                    {[20, 22, 24, 26, 28, 30, 32, 34, 36, 40, 44, 48].map((n) => (
                      <option key={n} value={n}>
                        {n}px
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 rounded-xl border bg-muted/20 p-3">
                <div className="text-sm font-semibold">{t("restaurant.menuFont.category")}</div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">{t("restaurant.menuFont")}</label>
                  <Select {...form.register("menu_font_category")}>
                    <option value="">{t("common.optional")}</option>
                    <option value="serif">{fontLabel("serif")}</option>
                    <option value="sans">{fontLabel("sans")}</option>
                    <option value="system">{fontLabel("system")}</option>
                    {fontItems.map((f) => (
                      <option key={f.path} value={f.path}>
                        {f.filename || f.path}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">{t("restaurant.menuFont.size")}</label>
                  <Select {...form.register("menu_font_category_size")}>
                    <option value="">{t("common.optional")}</option>
                    {[12, 13, 14, 15, 16, 18, 20, 22].map((n) => (
                      <option key={n} value={n}>
                        {n}px
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 rounded-xl border bg-muted/20 p-3">
                <div className="text-sm font-semibold">{t("restaurant.menuFont.item")}</div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">{t("restaurant.menuFont")}</label>
                  <Select {...form.register("menu_font_item")}>
                    <option value="">{t("common.optional")}</option>
                    <option value="serif">{fontLabel("serif")}</option>
                    <option value="sans">{fontLabel("sans")}</option>
                    <option value="system">{fontLabel("system")}</option>
                    {fontItems.map((f) => (
                      <option key={f.path} value={f.path}>
                        {f.filename || f.path}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">{t("restaurant.menuFont.size")}</label>
                  <Select {...form.register("menu_font_item_size")}>
                    <option value="">{t("common.optional")}</option>
                    {[10, 11, 12, 13, 14, 15, 16, 18, 20].map((n) => (
                      <option key={n} value={n}>
                        {n}px
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 rounded-xl border bg-muted/20 p-3">
                <div className="text-sm font-semibold">{t("restaurant.menuFont")}</div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">{t("restaurant.menuFont")}</label>
                  <Select {...form.register("menu_font")}>
                    <option value="serif">{fontLabel("serif")}</option>
                    <option value="sans">{fontLabel("sans")}</option>
                    <option value="system">{fontLabel("system")}</option>
                    {fontItems.map((f) => (
                      <option key={f.path} value={f.path}>
                        {f.filename || f.path}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">{t("restaurant.menuFont.size")}</label>
                  <Select {...form.register("menu_font_size")}>
                    {[12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 26].map((n) => (
                      <option key={n} value={n}>
                        {n}px
                      </option>
                    ))}
                  </Select>
                  <div className="text-xs text-muted-foreground">
                    {t("restaurant.menuFont.sizeHint")} <span className="font-medium text-foreground">{baseSize}px</span>
                  </div>
                </div>
              </div>

            </form>

            <div className="grid gap-2">
              <div className="text-sm font-medium">{t("restaurant.menuFont.upload")}</div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  type="file"
                  accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    const error = validateFontFile(file);
                    if (error) {
                      toast.error(error);
                      e.target.value = "";
                      setFontFile(null);
                      return;
                    }
                    setFontFile(file);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  disabled={!fontFile || uploadFontMutation.isPending}
                  onClick={() => uploadFontMutation.mutate(fontFile)}
                >
                  <Upload className="h-4 w-4" />
                  {uploadFontMutation.isPending ? t("common.loading") : t("restaurant.menuFont.uploadBtn")}
                </Button>
              </div>
              {fontFile ? <div className="text-xs text-muted-foreground">{fontFile.name}</div> : null}
            </div>

            {fontItems.length ? (
              <div className="grid gap-2">
                <div className="text-sm font-medium">{t("restaurant.menuFont.library")}</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {fontItems.map((f) => (
                    <div key={f.path} className="flex items-center justify-between gap-2 rounded-xl border bg-muted/10 p-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{f.filename || f.path}</div>
                        <div className="truncate text-xs text-muted-foreground">{f.path}</div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          if (!window.confirm(t("restaurant.menuFont.confirmDelete"))) return;
                          deleteFontMutation.mutate(f.path);
                        }}
                        disabled={deleteFontMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                        {t("common.delete")}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

      </CardContent>
    </Card>
  );
}
