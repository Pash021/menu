import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Facebook, Image as ImageIcon, Instagram, Link as LinkIcon, MessageCircle, PhoneCall, QrCode, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/api/client";
import { deleteRestaurantLogo, getRestaurantQr, updateRestaurant, uploadRestaurantLogo } from "@/api/restaurants";
import { useI18n } from "@/lib/i18n";
import { validateLogoFile } from "@/lib/uploads";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { TopBrandHeader } from "@/pages/public/menu/components/TopBrandHeader";
import { FloatingActionButton } from "@/pages/public/menu/components/FloatingActionButton";
import shellStyles from "@/pages/public/menu/PublicMenuShell.module.css";
import { useSettingsPanel } from "../SettingsPanelContext";

const CONTACT_KINDS = ["phone", "whatsapp", "instagram", "facebook"];

const contactSchema = z.object({
  kind: z.enum(["phone", "whatsapp", "instagram", "facebook"]),
  value: z.string().optional(),
});

const schema = z.object({
  contacts: z.array(contactSchema).min(1),
});

function contactIcon(kind) {
  if (kind === "phone") return PhoneCall;
  if (kind === "whatsapp") return MessageCircle;
  if (kind === "instagram") return Instagram;
  return Facebook;
}

function normalizePhone(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return raw;
}

function normalizeWhatsapp(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return raw;
}

function normalizeInstagram(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("@")) return `https://instagram.com/${raw.slice(1)}`;
  if (raw.includes("instagram.com")) return raw.startsWith("http") ? raw : `https://${raw}`;
  return `https://instagram.com/${raw}`;
}

function normalizeFacebook(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("@")) return `https://facebook.com/${raw.slice(1)}`;
  if (raw.includes("facebook.com")) return raw.startsWith("http") ? raw : `https://${raw}`;
  return `https://facebook.com/${raw}`;
}

function buildPreview(kind, value) {
  const v = String(value || "").trim();
  if (!v) return null;
  if (kind === "phone") {
    const p = normalizePhone(v);
    return p ? { href: `tel:${p}`, label: p } : null;
  }
  if (kind === "whatsapp") {
    const w = normalizeWhatsapp(v);
    return w ? { href: `https://wa.me/${w.replace(/[^\d]/g, "")}`, label: w } : null;
  }
  if (kind === "instagram") {
    const url = normalizeInstagram(v);
    return url ? { href: url, label: url.replace(/^https?:\/\//i, "") } : null;
  }
  if (kind === "facebook") {
    const url = normalizeFacebook(v);
    return url ? { href: url, label: url.replace(/^https?:\/\//i, "") } : null;
  }
  return null;
}

export default function GeneralSettings() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { restaurantId, restaurant, savedTheme } = useOutletContext();
  const { setPreview, setSaveBar, setDirty } = useSettingsPanel();
  const logoInputRef = useRef(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState(null);
  const [removeLogoOpen, setRemoveLogoOpen] = useState(false);
  const [qrVersion, setQrVersion] = useState(0);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { contacts: [{ kind: "phone", value: "" }] },
  });

  const contactsArray = useFieldArray({ control: form.control, name: "contacts" });
  const contacts = form.watch("contacts") || [];

  useEffect(() => {
    if (!restaurant) return;
    const next = [];
    if (restaurant.phone) next.push({ kind: "phone", value: restaurant.phone });
    if (restaurant.whatsapp) next.push({ kind: "whatsapp", value: restaurant.whatsapp });
    if (restaurant.instagram) next.push({ kind: "instagram", value: restaurant.instagram });
    if (restaurant.facebook) next.push({ kind: "facebook", value: restaurant.facebook });
    if (!next.length) next.push({ kind: "phone", value: "" });
    form.reset({ contacts: next });
  }, [form, restaurant]);

  useUnsavedChangesGuard(form.formState.isDirty);
  const contactsDirty = form.formState.isDirty;

  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  const uploadLogoMutation = useMutation({
    mutationFn: async () => {
      if (!logoFile) throw new Error("No file");
      return uploadRestaurantLogo(restaurantId, logoFile);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["restaurant", restaurantId] });
      toast.success(t("toast.updated"));
      setLogoFile(null);
      if (logoInputRef.current) logoInputRef.current.value = "";
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const deleteLogoMutation = useMutation({
    mutationFn: async () => deleteRestaurantLogo(restaurantId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["restaurant", restaurantId] });
      toast.success(t("toast.updated"));
      setLogoFile(null);
      if (logoInputRef.current) logoInputRef.current.value = "";
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const saveMutation = useMutation({
    mutationFn: async (values) => {
      const rows = Array.isArray(values?.contacts) ? values.contacts : [];
      const map = { phone: null, whatsapp: null, instagram: null, facebook: null };
      for (const row of rows) {
        const kind = row?.kind;
        if (!CONTACT_KINDS.includes(kind)) continue;
        const value = String(row?.value || "").trim();
        if (!value) continue;
        map[kind] = value;
      }
      return updateRestaurant(restaurantId, map);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["restaurant", restaurantId] });
      toast.success(t("toast.updated"));
      form.reset(form.getValues());
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const qrQuery = useQuery({
    queryKey: ["restaurantQr", restaurantId],
    queryFn: () => getRestaurantQr(restaurantId),
    enabled: Boolean(restaurant?.id && restaurant?.slug),
    retry: false,
    staleTime: 5 * 60_000,
  });

  const regenerateQrMutation = useMutation({
    mutationFn: async () => getRestaurantQr(restaurantId, { force: 1 }),
    onSuccess: async (payload) => {
      queryClient.setQueryData(["restaurantQr", restaurantId], payload);
      setQrVersion((v) => v + 1);
      toast.success(t("toast.updated"));
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const previewBasePath = useMemo(() => {
    if (!restaurant?.slug) return null;
    return `/r/${restaurant.slug}`;
  }, [restaurant?.slug]);

  const previewNode = useMemo(() => {
    if (!restaurant) return null;
    return (
      <div className="space-y-3">
        <div>
          <div className="text-sm font-semibold">{t("settings.preview")}</div>
          <div className="mt-1 text-sm text-muted-foreground">{t("settings.preview.readonly")}</div>
        </div>
        <div className="pointer-events-none overflow-hidden rounded-2xl border bg-card">
          <ThemeProvider theme={savedTheme} className={shellStyles.shell}>
            <div style={{ position: "relative", minHeight: 240 }}>
              <TopBrandHeader variant="home" restaurant={restaurant} />
              <FloatingActionButton restaurant={restaurant} basePath={previewBasePath} />
            </div>
          </ThemeProvider>
        </div>
      </div>
    );
  }, [previewBasePath, restaurant, savedTheme, t]);

  const resetContacts = useCallback(() => {
    const next = [];
    if (restaurant?.phone) next.push({ kind: "phone", value: restaurant.phone });
    if (restaurant?.whatsapp) next.push({ kind: "whatsapp", value: restaurant.whatsapp });
    if (restaurant?.instagram) next.push({ kind: "instagram", value: restaurant.instagram });
    if (restaurant?.facebook) next.push({ kind: "facebook", value: restaurant.facebook });
    if (!next.length) next.push({ kind: "phone", value: "" });
    form.reset({ contacts: next });
  }, [form, restaurant?.facebook, restaurant?.instagram, restaurant?.phone, restaurant?.whatsapp]);

  const onSaveContacts = useMemo(() => form.handleSubmit((v) => saveMutation.mutate(v)), [form, saveMutation]);

  const saveBar = useMemo(
    () => (
      <>
        <Button type="button" variant="secondary" onClick={resetContacts}>
          {t("common.cancel")}
        </Button>
        <Button type="button" disabled={saveMutation.isPending} onClick={onSaveContacts}>
          {saveMutation.isPending ? t("common.loading") : t("common.save")}
        </Button>
      </>
    ),
    [onSaveContacts, resetContacts, saveMutation.isPending, t]
  );

  useEffect(() => {
    setPreview(previewNode);
    return () => setPreview(null);
  }, [previewNode, setPreview]);

  useEffect(() => {
    setDirty(contactsDirty);
    setSaveBar(contactsDirty ? saveBar : null);
    return () => {
      setDirty(false);
      setSaveBar(null);
    };
  }, [contactsDirty, saveBar, setDirty, setSaveBar]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.sections.general")}</CardTitle>
          <CardDescription>{t("settings.general.hint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="rounded-2xl border bg-muted/20 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    {t("restaurant.logo.manageTitle")}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">{t("restaurant.logo.hint")}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{t("restaurant.logo.recommended")}</div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 overflow-hidden rounded-2xl border bg-background">
                    {logoPreviewUrl || restaurant?.logo_url ? (
                      <img
                        src={logoPreviewUrl || restaurant.logo_url}
                        alt={restaurant?.name || "logo"}
                        className="h-full w-full object-contain p-1"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-6 w-6 opacity-60" aria-hidden="true" />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/svg+xml,image/png,image/webp,image/jpeg"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        const err = validateLogoFile(file);
                        if (err) {
                          toast.error(err);
                          e.target.value = "";
                          setLogoFile(null);
                          return;
                        }
                        setLogoFile(file);
                      }}
                    />
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button type="button" variant="outline" onClick={() => logoInputRef.current?.click()}>
                        {restaurant?.logo_url ? t("restaurant.logo.replace") : t("restaurant.logo.upload")}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => uploadLogoMutation.mutate()}
                        disabled={!logoFile || uploadLogoMutation.isPending}
                      >
                        {uploadLogoMutation.isPending ? t("common.loading") : t("common.save")}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={!restaurant?.logo_url || deleteLogoMutation.isPending}
                        onClick={() => setRemoveLogoOpen(true)}
                      >
                        {t("restaurant.logo.remove")}
                      </Button>
                    </div>
                    {logoFile ? (
                      <div className="text-xs text-muted-foreground">
                        {logoFile.name} · {Math.max(1, Math.round(logoFile.size / 1024))} KB
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border bg-muted/20 p-4">
                <div className="text-sm text-muted-foreground">{t("admin.manage.title")}</div>
                <div className="mt-1 truncate text-xl font-semibold">{restaurant?.name}</div>
                <div className="mt-1 truncate text-sm text-muted-foreground">{restaurant?.slug}</div>
                {restaurant?.slug ? (
                  <Button asChild variant="outline" className="mt-4 w-full gap-2">
                    <a href={`/r/${restaurant.slug}`} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      {t("nav.publicPreview")}
                    </a>
                  </Button>
                ) : null}
              </div>

              <div className="rounded-2xl border bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <QrCode className="h-4 w-4 text-muted-foreground" />
                  {t("admin.manage.qrTitle")}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{t("admin.manage.qrHint")}</div>
                {qrQuery.data?.qr_url ? (
                  <div className="mt-3 overflow-hidden rounded-2xl border bg-background p-3">
                    <img
                      src={`${qrQuery.data.qr_url}${qrVersion ? `?v=${qrVersion}` : ""}`}
                      alt={t("admin.manage.qrTitle")}
                      className="mx-auto h-44 w-44 object-contain"
                      loading="lazy"
                      decoding="async"
                      draggable="false"
                    />
                  </div>
                ) : null}

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    disabled={!qrQuery.data?.menu_url}
                    onClick={async () => {
                      const url = qrQuery.data?.menu_url;
                      if (!url) return;
                      try {
                        await navigator.clipboard.writeText(url);
                        toast.success(t("toast.copied"));
                      } catch {
                        window.prompt("Copy link:", url);
                      }
                    }}
                  >
                    <LinkIcon className="h-4 w-4" />
                    {t("common.copyLink")}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    disabled={regenerateQrMutation.isPending || !restaurant?.slug}
                    onClick={() => regenerateQrMutation.mutate()}
                  >
                    <QrCode className="h-4 w-4" />
                    {t("admin.manage.qrRegenerate")}
                  </Button>

                  {qrQuery.data?.qr_url ? (
                    <Button asChild variant="outline" className="gap-2">
                      <a href={qrQuery.data.qr_url} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        {t("admin.manage.qrOpen")}
                      </a>
                    </Button>
                  ) : null}

                  {qrQuery.data?.menu_url ? (
                    <Button asChild variant="outline" className="gap-2">
                      <a href={qrQuery.data.menu_url} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        {t("nav.publicPreview")}
                      </a>
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <form className="space-y-4" onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{t("admin.manage.contactsList")}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{t("admin.manage.contactsHint")}</div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => contactsArray.append({ kind: "phone", value: "" })}
                >
                  + {t("common.create")}
                </Button>
              </div>

              <div className="grid gap-3">
                {contactsArray.fields.map((field, idx) => {
                  const kind = contacts[idx]?.kind || "phone";
                  const value = contacts[idx]?.value || "";
                  const Icon = contactIcon(kind);
                  const preview = buildPreview(kind, value);

                  return (
                    <div key={field.id} className="rounded-2xl border bg-muted/10 p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                        <div className="grid gap-1.5 sm:w-44">
                          <label className="text-xs font-semibold text-muted-foreground">Type</label>
                          <Select {...form.register(`contacts.${idx}.kind`)}>
                            <option value="phone">{t("public.contact.phone")}</option>
                            <option value="whatsapp">{t("public.contact.whatsapp")}</option>
                            <option value="instagram">{t("public.contact.instagram")}</option>
                            <option value="facebook">{t("public.contact.facebook")}</option>
                          </Select>
                        </div>

                        <div className="min-w-0 flex-1">
                          <label className="text-xs font-semibold text-muted-foreground">Value</label>
                          <Input {...form.register(`contacts.${idx}.value`)} placeholder="+374..." />
                          {preview ? (
                            <a
                              className="mt-1 inline-flex items-center gap-2 truncate text-xs text-primary underline underline-offset-2"
                              href={preview.href}
                              target={kind === "phone" ? undefined : "_blank"}
                              rel={kind === "phone" ? undefined : "noreferrer"}
                            >
                              <Icon className="h-3.5 w-3.5 opacity-80" aria-hidden="true" />
                              {preview.label}
                            </a>
                          ) : null}
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-xl"
                          aria-label={t("common.delete")}
                          onClick={() => {
                            if (contactsArray.fields.length <= 1) {
                              form.setValue(`contacts.0.value`, "");
                              form.setValue(`contacts.0.kind`, "phone");
                              return;
                            }
                            contactsArray.remove(idx);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

            </form>

            <ConfirmDialog
              open={removeLogoOpen}
              onOpenChange={setRemoveLogoOpen}
              title={t("restaurant.logo.confirmRemoveTitle")}
              description={t("restaurant.logo.confirmRemoveHint")}
              confirmLabel={t("restaurant.logo.remove")}
              cancelLabel={t("common.cancel")}
              isDanger
              onConfirm={() => {
                setRemoveLogoOpen(false);
                deleteLogoMutation.mutate();
              }}
            />
        </CardContent>
      </Card>
    </div>
  );
}
