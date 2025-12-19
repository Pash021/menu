import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layers, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { createCategory, deleteCategory, listCategories, updateCategory } from "@/api/restaurants";
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

const schema = z.object({
  name: z.string().min(1),
  icon_name: z.string().optional(),
});

export default function AdminCategoriesPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { restaurantId } = useActiveRestaurant();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [q, setQ] = useState("");

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
    defaultValues: { name: "", icon_name: "" },
  });

  const iconValue = form.watch("icon_name");

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
      form.reset();
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
              form.reset({ name: "", icon_name: "" });
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
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("category.name")}</TableHead>
              <TableHead>{t("category.icon")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((c) => (
              <TableRow key={c.id}>
              <TableCell className="font-medium">{c.name}</TableCell>
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
                        form.reset({ name: c.name ?? "", icon_name: c.icon_name ?? "" });
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
            form.reset({ name: "", icon_name: "" });
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Редактировать категорию" : "Новая категория"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={form.handleSubmit((v) => upsertMutation.mutate(v))}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("category.name")}</label>
              <Input {...form.register("name")} />
              {form.formState.errors.name?.message ? (
                <div className="text-xs text-destructive">{String(form.formState.errors.name.message)}</div>
              ) : null}
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
