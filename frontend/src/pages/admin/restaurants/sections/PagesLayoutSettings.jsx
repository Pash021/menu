import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Trash2, Upload } from "lucide-react";
import { getApiErrorMessage } from "@/api/client";
import { deleteRestaurantLoader, listRestaurantLoaders, updateRestaurant, uploadRestaurantLoader } from "@/api/restaurants";
import { useI18n } from "@/lib/i18n";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicMenuLoader } from "@/pages/public/menu/PublicMenuLoader";
import shellStyles from "@/pages/public/menu/PublicMenuShell.module.css";
import { useSettingsPanel } from "../SettingsPanelContext";

const schema = z.object({
  loading_style: z.string().optional(),
  loading_image_path: z.string().optional(),
});

function validateLoaderFile(file) {
  if (!file) return "Ֆայլը ընտրված չէ";
  const name = String(file.name || "").toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  const allowed = [".svg", ".avif", ".gif", ".webp", ".png", ".jpg", ".jpeg"];
  if (!allowed.includes(ext)) return "Թույլատրվում է SVG/AVIF/GIF/WEBP/PNG/JPG";
  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) return "Ֆայլը չափազանց մեծ է (max 5MB)";
  return null;
}

function getUploadUrl(path) {
  if (!path) return null;
  return `/uploads/${String(path).replace(/^\/+/, "")}`;
}

export default function PagesLayoutSettings() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { restaurantId, restaurant, savedTheme } = useOutletContext();
  const { setPreview, setSaveBar, setDirty } = useSettingsPanel();
  const [file, setFile] = useState(null);

  const loadersQuery = useQuery({
    queryKey: ["restaurantLoaders", restaurantId],
    queryFn: () => listRestaurantLoaders(restaurantId),
    enabled: Boolean(restaurantId),
    retry: false,
  });

  const loaderItems = useMemo(() => loadersQuery.data?.items ?? loadersQuery.data ?? [], [loadersQuery.data]);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { loading_style: "spinner", loading_image_path: "" },
  });

  useEffect(() => {
    if (!restaurant) return;
    form.reset({
      loading_style: restaurant.loading_style ?? "spinner",
      loading_image_path: restaurant.loading_image_path ?? "",
    });
  }, [form, restaurant]);

  useUnsavedChangesGuard(form.formState.isDirty);
  const isDirty = form.formState.isDirty;

  const uploadMutation = useMutation({
    mutationFn: async (f) => uploadRestaurantLoader(restaurantId, f),
    onSuccess: async (payload) => {
      await queryClient.invalidateQueries({ queryKey: ["restaurantLoaders", restaurantId] });
      const path = payload?.path || null;
      if (path) form.setValue("loading_image_path", path, { shouldDirty: true });
      toast.success(t("toast.saved"));
      setFile(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (path) => deleteRestaurantLoader(restaurantId, path),
    onSuccess: async (_, path) => {
      await queryClient.invalidateQueries({ queryKey: ["restaurantLoaders", restaurantId] });
      if (String(form.getValues("loading_image_path") || "") === String(path || "")) {
        form.setValue("loading_image_path", "", { shouldDirty: true });
      }
      toast.success(t("toast.deleted"));
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const saveMutation = useMutation({
    mutationFn: async (values) =>
      updateRestaurant(restaurantId, {
        loading_style: String(values.loading_style || "spinner"),
        loading_image_path: String(values.loading_image_path || "").trim() || null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["restaurant", restaurantId] });
      toast.success(t("toast.updated"));
      form.reset(form.getValues());
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const selectedPath = String(form.watch("loading_image_path") || "").trim();
  const selectedUrl =
    loaderItems.find((x) => x.path === selectedPath)?.url ||
    loaderItems.find((x) => x.path === selectedPath)?.url ||
    (selectedPath ? getUploadUrl(selectedPath) : null);
  const selectedVariant = String(form.watch("loading_style") || "spinner");

  const cancel = useCallback(() => {
    if (!restaurant) return;
    form.reset({
      loading_style: restaurant.loading_style ?? "spinner",
      loading_image_path: restaurant.loading_image_path ?? "",
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
          <ThemeProvider theme={savedTheme} className={shellStyles.shell}>
            <div style={{ height: 220, position: "relative" }}>
              <PublicMenuLoader mode="screen" imageUrl={selectedUrl} variant={selectedVariant} label={t("common.loading")} />
            </div>
          </ThemeProvider>
        </div>
      </div>
    ),
    [savedTheme, selectedUrl, selectedVariant, t]
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
        <CardTitle>{t("restaurant.loader.title")}</CardTitle>
        <CardDescription>{t("restaurant.loader.hint")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="grid gap-4" onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}>
              <div className="grid gap-4 rounded-xl border bg-muted/20 p-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">{t("restaurant.loader.style")}</label>
                  <Select {...form.register("loading_style")}>
                    <option value="spinner">{t("restaurant.loader.effects.spinner")}</option>
                    <option value="dots">{t("restaurant.loader.effects.dots")}</option>
                    <option value="ring">{t("restaurant.loader.effects.ring")}</option>
                  </Select>
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">{t("restaurant.loader.image")}</label>
                  <div className="flex items-center gap-3">
                    {selectedUrl ? (
                      <img src={selectedUrl} alt="" className="h-14 w-14 rounded-xl border bg-white object-cover" />
                    ) : (
                      <div className="h-14 w-14 rounded-xl border bg-muted" />
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!selectedPath || saveMutation.isPending}
                      onClick={() => form.setValue("loading_image_path", "", { shouldDirty: true })}
                    >
                      {t("restaurant.loader.clear")}
                    </Button>
                  </div>
                </div>
              </div>
        </form>

        <div className="grid gap-2">
          <div className="text-sm font-semibold">{t("restaurant.loader.choose")}</div>
          {loadersQuery.isLoading ? (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {Array.from({ length: 12 }).map((_, idx) => (
                <div key={idx} className="aspect-square rounded-xl border bg-muted" />
              ))}
            </div>
          ) : loaderItems.length ? (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {loaderItems.map((item) => {
                const selected = item.path === selectedPath;
                return (
                  <div key={item.path} className={`relative overflow-hidden rounded-xl border bg-white ${selected ? "ring-2 ring-primary" : ""}`}>
                    <button
                      type="button"
                      className="block aspect-square w-full"
                      onClick={() => form.setValue("loading_image_path", item.path, { shouldDirty: true })}
                      aria-label={item.filename || item.path}
                    >
                      <img src={item.url || getUploadUrl(item.path)} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                    </button>

                    <button
                      type="button"
                      className="absolute right-1 top-1 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 text-white hover:bg-black/70"
                      aria-label={t("common.delete")}
                      onClick={() => {
                        if (!window.confirm(t("restaurant.loader.confirmDelete"))) return;
                        deleteMutation.mutate(item.path);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border bg-muted/10 p-3 text-sm text-muted-foreground">{t("restaurant.loader.empty")}</div>
          )}
        </div>

        <div className="grid gap-2">
          <div className="text-sm font-medium">{t("restaurant.loader.upload")}</div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              type="file"
              accept=".svg,.avif,.gif,.webp,.png,.jpg,.jpeg,image/svg+xml,image/avif,image/gif,image/webp,image/png,image/jpeg"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                const error = validateLoaderFile(f);
                if (error) {
                  toast.error(error);
                  e.target.value = "";
                  setFile(null);
                  return;
                }
                setFile(f);
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={!file || uploadMutation.isPending}
              onClick={() => uploadMutation.mutate(file)}
            >
              <Upload className="h-4 w-4" />
              {uploadMutation.isPending ? t("common.loading") : t("restaurant.loader.uploadBtn")}
            </Button>
          </div>
          {file ? <div className="text-xs text-muted-foreground">{file.name}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}
