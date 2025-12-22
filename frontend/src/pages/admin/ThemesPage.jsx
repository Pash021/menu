import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { createTheme, listThemes, updateTheme } from "@/api/themes";
import { getApiErrorMessage } from "@/api/client";
import { useI18n } from "@/lib/i18n";
import { themePresets } from "@/themes";
import { ThemeMiniPreview, normalizeThemeForProvider } from "@/components/theme/ThemeMiniPreview";
import { MENU_TOKENS, normalizeMenuTokenVars, serializeMenuTokenVarsToLegacy } from "@/lib/menuDesignTokens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/modal";

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

const EDITABLE_TOKENS = [
  { token: MENU_TOKENS.background, labelKey: "restaurant.theme.color.background", type: "color" },
  { token: MENU_TOKENS.surface, labelKey: "restaurant.theme.color.surface", type: "text" },
  { token: MENU_TOKENS.border, labelKey: "restaurant.theme.color.border", type: "text" },
  { token: MENU_TOKENS.textPrimary, labelKey: "restaurant.theme.color.textPrimary", type: "text" },
  { token: MENU_TOKENS.textMuted, labelKey: "restaurant.theme.color.textMuted", type: "text" },
  { token: MENU_TOKENS.accent, labelKey: "restaurant.theme.color.accent", type: "color" },
  { token: MENU_TOKENS.accentSecondary, labelKey: "restaurant.theme.color.accentSecondary", type: "color" },
  { token: MENU_TOKENS.categoryButton, labelKey: "restaurant.theme.color.categoryButton", type: "color" },
];

export default function ThemesPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [createPresetKey, setCreatePresetKey] = useState(themePresets[0]?.preset_key || "burger_orange");
  const [createName, setCreateName] = useState("");
  const [createKey, setCreateKey] = useState("");
  const [editingTheme, setEditingTheme] = useState(null);

  const themesQuery = useQuery({
    queryKey: ["adminThemes"],
    queryFn: () => listThemes(),
    retry: false,
  });

  const themes = useMemo(() => themesQuery.data?.items ?? [], [themesQuery.data]);

  const createMutation = useMutation({
    mutationFn: (payload) => createTheme(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["adminThemes"] });
      toast.success(t("toast.saved"));
      setCreateOpen(false);
      setCreateName("");
      setCreateKey("");
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateTheme(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["adminThemes"] });
      toast.success(t("toast.updated"));
      setEditOpen(false);
      setEditingTheme(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const createPreset = useMemo(() => themePresets.find((p) => p.preset_key === createPresetKey) || themePresets[0], [createPresetKey]);
  const createPreviewTheme = useMemo(() => normalizeThemeForProvider(createPreset), [createPreset]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm text-muted-foreground">{t("nav.themes")}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">{t("nav.themes")}</div>
        </div>
        <Button type="button" className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          {t("common.create")}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((theme) => (
          <Card key={theme.id}>
            <CardHeader>
              <CardTitle className="text-base">{theme.name}</CardTitle>
              <CardDescription>{theme.preset_key}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ThemeMiniPreview theme={normalizeThemeForProvider(theme)} />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  const vars = normalizeMenuTokenVars(theme.config_json?.vars || {});
                  setEditingTheme({
                    id: theme.id,
                    name: theme.name,
                    preset_key: theme.preset_key,
                    config_json: { ...(theme.config_json || {}), vars },
                  });
                  setEditOpen(true);
                }}
              >
                {t("common.edit")}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("common.create")}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Preset</label>
              <Select value={createPresetKey} onChange={(e) => setCreatePresetKey(e.target.value)}>
                {themePresets.map((p) => (
                  <option key={p.preset_key} value={p.preset_key}>
                    {p.name} ({p.preset_key})
                  </option>
                ))}
              </Select>
              <ThemeMiniPreview theme={createPreviewTheme} />
            </div>

            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={createName}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCreateName(v);
                    if (!createKey) setCreateKey(slugify(v));
                  }}
                  placeholder="My Theme"
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">{t("themes.key")}</label>
                <Input value={createKey} onChange={(e) => setCreateKey(slugify(e.target.value))} placeholder="my_theme" />
              </div>

              <Button
                type="button"
                className="gap-2"
                disabled={createMutation.isPending || !createName.trim() || !createKey.trim()}
                onClick={() =>
                  createMutation.mutate({
                    name: createName.trim(),
                    preset_key: createKey.trim(),
                    config_json: (() => {
                      const cfg = createPreset?.config_json || {};
                      const legacyVars = serializeMenuTokenVarsToLegacy(cfg?.vars || {});
                      return { ...cfg, vars: legacyVars };
                    })(),
                  })
                }
              >
                <Save className="h-4 w-4" />
                {createMutation.isPending ? t("common.loading") : t("common.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(v) => {
          setEditOpen(v);
          if (!v) setEditingTheme(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("common.edit")}</DialogTitle>
          </DialogHeader>

          {editingTheme ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <ThemeMiniPreview theme={normalizeThemeForProvider(editingTheme)} />
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Layout</label>
                  <Select
                    value={editingTheme.config_json?.category_layout || "pills"}
                    onChange={(e) =>
                      setEditingTheme((s) => ({ ...s, config_json: { ...(s.config_json || {}), category_layout: e.target.value } }))
                    }
                  >
                    <option value="pills">pills</option>
                    <option value="gridCards">gridCards</option>
                    <option value="carousel">carousel</option>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Transition</label>
                  <Select
                    value={editingTheme.config_json?.transition || "slide"}
                    onChange={(e) =>
                      setEditingTheme((s) => ({ ...s, config_json: { ...(s.config_json || {}), transition: e.target.value } }))
                    }
                  >
                    <option value="slide">slide</option>
                    <option value="fade">fade</option>
                    <option value="pageFlip">pageFlip</option>
                    <option value="pageCurlLite">pageCurlLite</option>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Card style</label>
                  <Select
                    value={editingTheme.config_json?.card_style || "glass"}
                    onChange={(e) =>
                      setEditingTheme((s) => ({ ...s, config_json: { ...(s.config_json || {}), card_style: e.target.value } }))
                    }
                  >
                    <option value="glass">glass</option>
                    <option value="flat">flat</option>
                    <option value="glow">glow</option>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Name</label>
                  <Input value={editingTheme.name} onChange={(e) => setEditingTheme((s) => ({ ...s, name: e.target.value }))} />
                  <div className="text-xs text-muted-foreground">{editingTheme.preset_key}</div>
                </div>

                <div className="grid gap-3 rounded-xl border bg-muted/20 p-3">
                  <div className="text-sm font-semibold">{t("restaurant.theme.colors")}</div>
                  {EDITABLE_TOKENS.map((row) => {
                    const vars = editingTheme.config_json?.vars || {};
                    const value = String(vars[row.token] || "");
                    return (
                      <div key={row.token} className="grid gap-1.5 sm:grid-cols-[160px_1fr] sm:items-center">
                        <div className="text-sm text-muted-foreground">{t(row.labelKey)}</div>
                        <div className="flex gap-2">
                          {row.type === "color" ? (
                            <input
                              type="color"
                              value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff"}
                              onChange={(e) =>
                                setEditingTheme((s) => ({
                                  ...s,
                                  config_json: { ...(s.config_json || {}), vars: { ...(vars || {}), [row.token]: e.target.value } },
                                }))
                              }
                              className="h-10 w-10 rounded-md border bg-background"
                            />
                          ) : null}
                          <Input
                            value={value}
                            onChange={(e) =>
                              setEditingTheme((s) => ({
                                ...s,
                                config_json: { ...(s.config_json || {}), vars: { ...(vars || {}), [row.token]: e.target.value } },
                              }))
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Button
                  type="button"
                  className="gap-2"
                  disabled={updateMutation.isPending}
                  onClick={() =>
                    updateMutation.mutate({
                      id: editingTheme.id,
                      payload: {
                        name: editingTheme.name,
                        config_json: (() => {
                          const cfg = editingTheme.config_json || {};
                          const legacyVars = serializeMenuTokenVarsToLegacy(cfg?.vars || {});
                          return { ...cfg, vars: legacyVars };
                        })(),
                      },
                    })
                  }
                >
                  <Save className="h-4 w-4" />
                  {updateMutation.isPending ? t("common.loading") : t("common.save")}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
