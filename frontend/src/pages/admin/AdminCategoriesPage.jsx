import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layers, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  createCategory,
  deleteCategoryIcon,
  deleteCategory,
  getCategoryHeaderStyle,
  listCategories,
  listCategoryIcons,
  updateCategoryHeaderStyle,
  updateCategory,
  uploadCategoryIcon,
} from "@/api/restaurants";
import { getApiErrorMessage } from "@/api/client";
import { useActiveRestaurant } from "@/lib/activeRestaurant";
import { useI18n } from "@/lib/i18n";
import { CATEGORY_ICON_PRESETS, CategoryIcon } from "@/lib/categoryIcons";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CategoryHeaderPreview } from "@/components/admin/CategoryHeaderPreview";
import burgerOrange from "@/themes/presets/burger_orange";
import { normalizeThemeForProvider } from "@/components/theme/ThemeMiniPreview";

const schema = z.object({
  name: z.string().min(1),
  icon_name: z.string().optional(),
  image_path: z.string().optional(),
});

const headerStyleSchema = z.object({
  headerColor: z.string().optional(),
  effect: z.string().optional(),
  glow: z.coerce.number().optional(),
  fade: z.coerce.number().optional(),
  radius: z.coerce.number().optional(),
  shadow: z.coerce.number().optional(),
  accentColor: z.string().optional(),
});

function getUploadUrl(path) {
  if (!path) return null;
  return `/uploads/${String(path).replace(/^\/+/, "")}`;
}

function validateCategoryIconFile(file) {
  if (!file) return "Файл не выбран";
  const name = String(file.name || "").toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  const allowedExts = [".svg", ".avif", ".png", ".jpg", ".jpeg", ".webp"];
  if (!allowedExts.includes(ext)) return "Разрешены SVG/AVIF (PNG/JPG/WEBP дополнительно)";
  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) return "Файл слишком большой (max 5 MB)";
  return null;
}

export default function AdminCategoriesPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { restaurantId } = useActiveRestaurant();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [q, setQ] = useState("");
  const [uploadFile, setUploadFile] = useState(null);

  const categoriesQuery = useQuery({
    queryKey: ["categories", { restaurantId }],
    queryFn: () => listCategories(restaurantId),
    enabled: Boolean(restaurantId),
    retry: false,
  });

  const rawItems = categoriesQuery.data?.items ?? categoriesQuery.data ?? [];
  const items = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rawItems;
    return rawItems.filter((c) => String(c.name || "").toLowerCase().includes(query));
  }, [rawItems, q]);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: "", icon_name: "", image_path: "" },
  });

  const headerForm = useForm({
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

  const iconValue = form.watch("icon_name");
  const imagePathValue = form.watch("image_path");
  const headerValues = headerForm.watch();
  const previewTheme = normalizeThemeForProvider(burgerOrange);

  function colorPickerValue(raw, fallback) {
    const v = String(raw || "").trim();
    if (/^#[0-9a-f]{6}$/i.test(v)) return v;
    if (/^#[0-9a-f]{8}$/i.test(v)) return v.slice(0, 7);
    return fallback;
  }

  const iconsQuery = useQuery({
    queryKey: ["category-icons", { restaurantId }],
    queryFn: () => listCategoryIcons(restaurantId),
    enabled: modalOpen && Boolean(restaurantId),
    retry: false,
  });

  const availableIcons = iconsQuery.data?.items ?? iconsQuery.data ?? [];

  const headerStyleQuery = useQuery({
    queryKey: ["categoryHeaderStyle", { categoryId: editing?.id }],
    queryFn: () => getCategoryHeaderStyle(editing.id),
    enabled: modalOpen && Boolean(editing?.id),
    retry: false,
  });

  React.useEffect(() => {
    if (!modalOpen) return;
    if (!editing?.id) return;
    const style = headerStyleQuery.data?.header_style;
    if (!style) return;
    headerForm.reset({
      headerColor: style.headerColor || "",
      effect: style.effect || "glowGradient",
      glow: Number(style.glow ?? 0.55),
      fade: Number(style.fade ?? 0.75),
      radius: Number(style.radius ?? 24),
      shadow: Number(style.shadow ?? 0.35),
      accentColor: style.accentColor || "#FFFFFF33",
    });
  }, [editing?.id, headerForm, headerStyleQuery.data, modalOpen]);

  const upsertMutation = useMutation({
    mutationFn: async (values) => {
      if (!restaurantId) throw new Error("No restaurant selected");
      if (editing) return updateCategory(editing.id, values);
      return createCategory(restaurantId, values);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success(t("toast.saved"));
      setModalOpen(false);
      setEditing(null);
      setUploadFile(null);
      form.reset();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      if (!restaurantId) throw new Error("No restaurant selected");
      return uploadCategoryIcon(restaurantId, file);
    },
    onSuccess: async (payload) => {
      const nextIcon = payload?.path
        ? { path: payload.path, filename: payload.filename || payload.path.split("/").pop(), url: payload.url || getUploadUrl(payload.path) }
        : null;

      if (nextIcon?.path) form.setValue("image_path", nextIcon.path, { shouldDirty: true });

      await queryClient.invalidateQueries({ queryKey: ["category-icons"] });
      if (nextIcon?.path) {
        queryClient.setQueryData(["category-icons", { restaurantId }], (prev) => {
          const prevItems = prev?.items ?? prev?.data?.items ?? prev ?? [];
          const list = Array.isArray(prevItems) ? prevItems : [];
          const deduped = list.filter((x) => x?.path !== nextIcon.path);
          return { items: [nextIcon, ...deduped] };
        });
      }

      toast.success(t("toast.saved"));
      setUploadFile(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const deleteIconMutation = useMutation({
    mutationFn: async (path) => {
      if (!restaurantId) throw new Error("No restaurant selected");
      return deleteCategoryIcon(restaurantId, path);
    },
    onSuccess: async (_, path) => {
      await queryClient.invalidateQueries({ queryKey: ["category-icons"] });
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      if (String(form.getValues("image_path") || "") === String(path || "")) {
        form.setValue("image_path", "", { shouldDirty: true });
      }
      toast.success(t("toast.deleted"));
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (categoryId) => deleteCategory(categoryId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success(t("toast.deleted"));
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const saveHeaderStyleMutation = useMutation({
    mutationFn: async (values) => updateCategoryHeaderStyle(editing.id, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["categoryHeaderStyle"] });
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success(t("toast.updated"));
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const toolbar = useMemo(() => {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <div className="text-sm text-muted-foreground">{t("admin.categories.title")}</div>
          <div className="text-2xl font-semibold tracking-tight">{t("nav.categories")}</div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("common.search")}
            className="sm:w-72"
            disabled={!restaurantId}
          />
          <Button
            className="gap-2"
            onClick={() => {
              setEditing(null);
              setUploadFile(null);
              form.reset({ name: "", icon_name: "", image_path: "" });
              setModalOpen(true);
            }}
            disabled={!restaurantId}
          >
            <Plus className="h-4 w-4" />
            {t("common.create")}
          </Button>
        </div>
      </div>
    );
  }, [t, restaurantId, form, q]);

  if (!restaurantId) {
    return (
      <EmptyState
        icon={Layers}
        title={t("common.selectRestaurant")}
        description={t("admin.selectRestaurant")}
      />
    );
  }

  return (
    <div className="space-y-4">
      {toolbar}

      {categoriesQuery.isLoading ? (
        <div className="rounded-xl border bg-card p-6">{t("common.loading")}</div>
      ) : categoriesQuery.isError ? (
        <EmptyState icon={Layers} title={t("common.error")} description="Не удалось загрузить категории." />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Категорий пока нет"
          description="Добавьте первую категорию, чтобы собрать меню."
          actionLabel={t("common.create")}
          onAction={() => {
            setEditing(null);
            setUploadFile(null);
            form.reset({ name: "", icon_name: "", image_path: "" });
            setModalOpen(true);
          }}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("category.name")}</TableHead>
              <TableHead>{t("category.image")}</TableHead>
              <TableHead>{t("category.icon")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((c) => (
              <TableRow key={c.id}>
              <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>
                  {c.image_url ? (
                    <img
                      src={c.image_url}
                      alt={c.name || ""}
                      className="h-10 w-10 rounded-lg border bg-muted/30 object-contain p-1"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.icon_name ? (
                    <div className="flex items-center gap-2">
                      <CategoryIcon name={c.icon_name} className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{c.icon_name}</span>
                    </div>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => {
                        setEditing(c);
                        setUploadFile(null);
                        form.reset({ name: c.name ?? "", icon_name: c.icon_name ?? "", image_path: c.image_path ?? "" });
                        setModalOpen(true);
                      }}
                    >
                      {t("common.edit")}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full gap-2 sm:w-auto"
                      onClick={() => setDeleteTarget(c)}
                    >
                      <Trash2 className="h-4 w-4" />
                      {t("common.delete")}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) {
            setEditing(null);
            setUploadFile(null);
            form.reset({ name: "", icon_name: "", image_path: "" });
            headerForm.reset({
              headerColor: "",
              effect: "glowGradient",
              glow: 0.55,
              fade: 0.75,
              radius: 24,
              shadow: 0.35,
              accentColor: "#FFFFFF33",
            });
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Редактировать категорию" : "Новая категория"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={form.handleSubmit((v) => upsertMutation.mutate(v))}>
            <input type="hidden" {...form.register("image_path")} />
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("category.name")}</label>
              <Input {...form.register("name")} />
              {form.formState.errors.name?.message ? (
                <div className="text-xs text-destructive">{String(form.formState.errors.name.message)}</div>
              ) : null}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium">
                  {t("category.image")} <span className="text-xs text-muted-foreground">({t("common.optional")})</span>
                </label>
                {imagePathValue ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => form.setValue("image_path", "", { shouldDirty: true })}
                  >
                    {t("category.image.clear")}
                  </Button>
                ) : null}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border bg-muted/40">
                  {imagePathValue ? (
                    <img
                      src={getUploadUrl(imagePathValue)}
                      alt=""
                      className="h-full w-full object-contain p-1"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <div className="min-w-0 text-xs text-muted-foreground">
                  {imagePathValue ? (
                    <span className="truncate">{String(imagePathValue).split("/").pop()}</span>
                  ) : (
                    t("category.image.none")
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">{t("category.image.pick")}</div>
                {iconsQuery.isLoading ? (
                  <div className="rounded-xl border bg-muted/20 p-3 text-sm text-muted-foreground">{t("common.loading")}</div>
                ) : iconsQuery.isError ? (
                  <div className="rounded-xl border bg-muted/20 p-3 text-sm text-muted-foreground">{t("common.error")}</div>
                ) : availableIcons.length ? (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {availableIcons.map((icon) => {
                      const selected = icon?.path && String(icon.path) === String(imagePathValue || "");
                      return (
                        <button
                          key={icon.path}
                          type="button"
                          className={[
                            "group relative overflow-hidden rounded-xl border bg-muted/20 p-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            selected ? "border-primary ring-2 ring-primary/25" : "hover:border-muted-foreground/30",
                          ].join(" ")}
                          onClick={() => form.setValue("image_path", icon.path, { shouldDirty: true })}
                          aria-label={icon.filename || "icon"}
                        >
                          <button
                            type="button"
                            className="absolute right-1.5 top-1.5 z-10 hidden h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm group-hover:flex focus:flex"
                            aria-label={t("common.delete")}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (!icon?.path) return;
                              deleteIconMutation.mutate(icon.path);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <img
                            src={icon.url || getUploadUrl(icon.path)}
                            alt=""
                            className="h-12 w-full object-contain"
                            loading="lazy"
                            decoding="async"
                          />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border bg-muted/20 p-3 text-sm text-muted-foreground">{t("category.image.empty")}</div>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">{t("category.image.upload")}</div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    type="file"
                    accept=".svg,.avif,image/svg+xml,image/avif,image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      const error = validateCategoryIconFile(file);
                      if (error) {
                        toast.error(error);
                        e.target.value = "";
                        setUploadFile(null);
                        return;
                      }
                      setUploadFile(file);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    disabled={!uploadFile || uploadMutation.isPending}
                    onClick={() => uploadMutation.mutate(uploadFile)}
                  >
                    <Upload className="h-4 w-4" />
                    {uploadMutation.isPending ? t("common.loading") : t("category.image.uploadBtn")}
                  </Button>
                </div>
                {uploadFile ? <div className="text-xs text-muted-foreground">{uploadFile.name}</div> : null}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t("category.icon")} <span className="text-xs text-muted-foreground">({t("common.optional")})</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-muted/40">
                  {iconValue ? <CategoryIcon name={iconValue} className="h-5 w-5 text-muted-foreground" /> : <span className="text-xs text-muted-foreground">—</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <Input
                    list="category-icons"
                    placeholder="Coffee, Pizza, Soup…"
                    {...form.register("icon_name")}
                  />
                  <datalist id="category-icons">
                    {CATEGORY_ICON_PRESETS.filter((p) => p.value).map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </datalist>
                </div>
              </div>
            </div>

            {editing?.id ? (
              <div className="rounded-2xl border bg-muted/10 p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{t("category.headerStyle.title")}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{t("category.headerStyle.hint")}</div>
                  </div>
                </div>

                {headerStyleQuery.isLoading ? (
                  <div className="mt-3 rounded-xl border bg-card p-3 text-sm text-muted-foreground">{t("common.loading")}</div>
                ) : headerStyleQuery.isError ? (
                  <div className="mt-3 rounded-xl border bg-card p-3 text-sm text-destructive">{t("common.error")}</div>
                ) : (
                  <div className="mt-3 grid gap-4 sm:grid-cols-2 sm:items-start">
                    <div className="grid gap-3 rounded-xl border bg-muted/20 p-3">
                      <div className="grid gap-1.5">
                        <label className="text-sm font-medium">{t("restaurant.headerStyle.color")}</label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={colorPickerValue(headerForm.watch("headerColor"), "#f39a1e")}
                            onChange={(e) => headerForm.setValue("headerColor", e.target.value, { shouldDirty: true })}
                            className="h-10 w-10 rounded-md border bg-background"
                          />
                          <Input {...headerForm.register("headerColor")} placeholder="#F39A1E" />
                        </div>
                      </div>

                      <div className="grid gap-1.5">
                        <label className="text-sm font-medium">{t("restaurant.headerStyle.effect")}</label>
                        <select
                          className="h-10 rounded-md border bg-background px-3 text-sm"
                          value={String(headerForm.watch("effect") || "glowGradient")}
                          onChange={(e) => headerForm.setValue("effect", e.target.value, { shouldDirty: true })}
                        >
                          <option value="glowGradient">{t("restaurant.headerStyle.effects.glowGradient")}</option>
                          <option value="minimal">{t("restaurant.headerStyle.effects.minimal")}</option>
                          <option value="sunset">{t("restaurant.headerStyle.effects.sunset")}</option>
                          <option value="glass">{t("restaurant.headerStyle.effects.glass")}</option>
                        </select>
                      </div>

                      {[
                        { key: "glow", label: t("restaurant.headerStyle.glow"), min: 0, max: 1, step: 0.01 },
                        { key: "fade", label: t("restaurant.headerStyle.fade"), min: 0, max: 1, step: 0.01 },
                        { key: "shadow", label: t("restaurant.headerStyle.shadow"), min: 0, max: 1, step: 0.01 },
                      ].map((s) => (
                        <div key={s.key} className="grid gap-2">
                          <div className="flex items-center justify-between gap-3">
                            <label className="text-sm font-medium">{s.label}</label>
                            <div className="text-xs text-muted-foreground">
                              {Math.round(Number(headerForm.watch(s.key) ?? 0) * 100)}%
                            </div>
                          </div>
                          <input
                            type="range"
                            min={s.min}
                            max={s.max}
                            step={s.step}
                            value={Number(headerForm.watch(s.key) ?? 0)}
                            onChange={(e) => headerForm.setValue(s.key, Number(e.target.value), { shouldDirty: true })}
                            className="w-full"
                          />
                        </div>
                      ))}

                      <div className="grid gap-2">
                        <div className="flex items-center justify-between gap-3">
                          <label className="text-sm font-medium">{t("restaurant.headerStyle.radius")}</label>
                          <div className="text-xs text-muted-foreground">
                            {Math.round(Number(headerForm.watch("radius") ?? 0))}px
                          </div>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="40"
                          step="1"
                          value={Number(headerForm.watch("radius") ?? 24)}
                          onChange={(e) => headerForm.setValue("radius", Number(e.target.value), { shouldDirty: true })}
                          className="w-full"
                        />
                      </div>

                      <div className="grid gap-1.5">
                        <label className="text-sm font-medium">{t("restaurant.headerStyle.accent")}</label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={colorPickerValue(headerForm.watch("accentColor"), "#ffffff")}
                            onChange={(e) => headerForm.setValue("accentColor", e.target.value, { shouldDirty: true })}
                            className="h-10 w-10 rounded-md border bg-background"
                          />
                          <Input {...headerForm.register("accentColor")} placeholder="#FFFFFF33" />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={saveHeaderStyleMutation.isPending}
                          onClick={async () => {
                            await updateCategoryHeaderStyle(editing.id, null);
                            await queryClient.invalidateQueries({ queryKey: ["categoryHeaderStyle"] });
                            toast.success(t("toast.updated"));
                          }}
                        >
                          {t("restaurant.headerStyle.reset")}
                        </Button>
                        <Button
                          type="button"
                          onClick={() => saveHeaderStyleMutation.mutate(headerForm.getValues())}
                          disabled={saveHeaderStyleMutation.isPending}
                        >
                          {saveHeaderStyleMutation.isPending ? t("common.loading") : t("common.save")}
                        </Button>
                      </div>
                    </div>

                    <CategoryHeaderPreview
                      theme={previewTheme}
                      restaurantName=""
                      title={String(form.watch("name") || "").trim() || t("category.name")}
                      headerStyle={{
                        headerColor: headerValues?.headerColor || undefined,
                        effect: headerValues?.effect || "glowGradient",
                        glow: Number(headerValues?.glow ?? 0.55),
                        fade: Number(headerValues?.fade ?? 0.75),
                        radius: Number(headerValues?.radius ?? 24),
                        shadow: Number(headerValues?.shadow ?? 0.35),
                        accentColor: headerValues?.accentColor || undefined,
                      }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border bg-muted/10 p-4 text-sm text-muted-foreground">
                {t("category.headerStyle.saveFirst")}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? t("common.loading") : t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => (!v ? setDeleteTarget(null) : null)}
        title="Удалить категорию?"
        description="Это действие может удалить связанные блюда."
        cancelLabel={t("common.cancel")}
        confirmLabel={t("common.delete")}
        isDanger
        onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
