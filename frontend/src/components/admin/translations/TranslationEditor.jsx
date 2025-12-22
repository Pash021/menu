import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/api/client";
import { getDishTranslations, updateDishTranslation } from "@/api/restaurants";
import { LANGUAGES, useI18n } from "@/lib/i18n";
import { AutoTextBlock } from "./AutoTextBlock";
import { EditableInput } from "./EditableInput";
import { LanguageTabs } from "./LanguageTabs";

function isBlank(v) {
  return v == null || String(v).trim().length === 0;
}

export function TranslationEditor({ dishId, open }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const langsParam = useMemo(() => LANGUAGES.map((l) => l.code).join(","), []);
  const [activeLang, setActiveLang] = useState(LANGUAGES[0]?.code ?? "hy");

  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");

  const translationsQuery = useQuery({
    queryKey: ["dishTranslations", { dishId }],
    queryFn: () => getDishTranslations(dishId, { langs: langsParam }),
    enabled: Boolean(dishId) && Boolean(open),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const items = translationsQuery.data?.items ?? [];
  const itemByLang = useMemo(() => new Map(items.map((x) => [x.lang, x])), [items]);
  const current = itemByLang.get(activeLang) ?? items[0] ?? null;

  useEffect(() => {
    if (!open) return;
    setEditingTitle(false);
    setEditingDescription(false);
  }, [dishId, activeLang, open]);

  useEffect(() => {
    if (!open) return;
    if (!current) return;
    setDraftTitle(String(current.manual?.title ?? current.auto?.title ?? ""));
    setDraftDescription(String(current.manual?.description ?? current.auto?.description ?? ""));
  }, [current, open]);

  const saveMutation = useMutation({
    mutationFn: ({ lang, payload }) => updateDishTranslation(dishId, lang, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dishTranslations"] });
      toast.success(t("toast.saved"));
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const langLabel = (code) => LANGUAGES.find((l) => l.code === code)?.label ?? code;

  const autoTitle = String(current?.auto?.title ?? "");
  const autoDescription = String(current?.auto?.description ?? "");
  const manualTitle = current?.manual?.title ?? null;
  const manualDescription = current?.manual?.description ?? null;
  const hasManualTitle = !isBlank(manualTitle);
  const hasManualDescription = !isBlank(manualDescription);

  function startEditTitle() {
    if (!current) return;
    setDraftTitle(String(current.manual?.title ?? current.auto?.title ?? ""));
    setEditingTitle(true);
  }

  function cancelEditTitle() {
    if (!current) return;
    setDraftTitle(String(current.manual?.title ?? current.auto?.title ?? ""));
    setEditingTitle(false);
  }

  function startEditDescription() {
    if (!current) return;
    setDraftDescription(String(current.manual?.description ?? current.auto?.description ?? ""));
    setEditingDescription(true);
  }

  function cancelEditDescription() {
    if (!current) return;
    setDraftDescription(String(current.manual?.description ?? current.auto?.description ?? ""));
    setEditingDescription(false);
  }

  async function saveTitle() {
    if (!current) return;
    const value = String(draftTitle ?? "").trim();
    saveMutation.mutate({ lang: current.lang, payload: { manual_title: value } });
    setEditingTitle(false);
  }

  async function saveDescription() {
    if (!current) return;
    const value = String(draftDescription ?? "").trim();
    saveMutation.mutate({ lang: current.lang, payload: { manual_description: value } });
    setEditingDescription(false);
  }

  function resetTitle() {
    if (!current) return;
    saveMutation.mutate({ lang: current.lang, payload: { manual_title: "" } });
    setEditingTitle(false);
  }

  function resetDescription() {
    if (!current) return;
    saveMutation.mutate({ lang: current.lang, payload: { manual_description: "" } });
    setEditingDescription(false);
  }

  return (
    <div className="rounded-2xl border bg-muted/10 p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{t("admin.dishes.translations.title")}</div>
          <div className="mt-1 text-sm text-muted-foreground">{t("admin.dishes.translations.hint")}</div>
        </div>
        <div className="text-sm text-muted-foreground">{current ? langLabel(current.lang) : null}</div>
      </div>

      <div className="mt-3">
        <LanguageTabs
          languages={LANGUAGES}
          value={activeLang}
          onChange={(code) => {
            setActiveLang(code);
          }}
        />
      </div>

      {translationsQuery.isLoading ? (
        <div className="mt-4 rounded-xl border bg-card p-3 text-sm text-muted-foreground">{t("common.loading")}</div>
      ) : translationsQuery.isError ? (
        <div className="mt-4 rounded-xl border bg-card p-3 text-sm text-destructive">
          {t("common.error")}
        </div>
      ) : !current ? (
        <div className="mt-4 rounded-xl border bg-card p-3 text-sm text-muted-foreground">
          {t("common.error")}
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">{t("dish.name")}</div>
              {hasManualTitle ? <Badge>{t("admin.dishes.translations.edited")}</Badge> : null}
            </div>

            <AutoTextBlock label={t("admin.dishes.translations.auto")} value={autoTitle} />

            {editingTitle ? (
              <div className="space-y-2">
                <EditableInput
                  value={draftTitle}
                  onChange={setDraftTitle}
                  placeholder={autoTitle}
                  disabled={saveMutation.isPending}
                />
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="secondary" onClick={cancelEditTitle}>
                    {t("common.cancel")}
                  </Button>
                  <Button type="button" onClick={saveTitle} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? t("common.loading") : t("common.save")}
                  </Button>
                </div>
              </div>
            ) : hasManualTitle ? (
              <div className="space-y-2">
                <div className="rounded-xl border bg-card p-3 text-sm">{String(manualTitle)}</div>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={startEditTitle}>
                    {t("admin.dishes.translations.fix")}
                  </Button>
                  <Button type="button" variant="secondary" onClick={resetTitle} disabled={saveMutation.isPending}>
                    {t("admin.dishes.translations.reset")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={startEditTitle}>
                  {t("admin.dishes.translations.fix")}
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">{t("dish.description")}</div>
              {hasManualDescription ? <Badge>{t("admin.dishes.translations.edited")}</Badge> : null}
            </div>

            <AutoTextBlock label={t("admin.dishes.translations.auto")} value={autoDescription} />

            {editingDescription ? (
              <div className="space-y-2">
                <EditableInput
                  multiline
                  value={draftDescription}
                  onChange={setDraftDescription}
                  placeholder={autoDescription}
                  disabled={saveMutation.isPending}
                />
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="secondary" onClick={cancelEditDescription}>
                    {t("common.cancel")}
                  </Button>
                  <Button type="button" onClick={saveDescription} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? t("common.loading") : t("common.save")}
                  </Button>
                </div>
              </div>
            ) : hasManualDescription ? (
              <div className="space-y-2">
                <div className="whitespace-pre-wrap rounded-xl border bg-card p-3 text-sm">
                  {String(manualDescription)}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={startEditDescription}>
                    {t("admin.dishes.translations.fix")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={resetDescription}
                    disabled={saveMutation.isPending}
                  >
                    {t("admin.dishes.translations.reset")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={startEditDescription}>
                  {t("admin.dishes.translations.fix")}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
