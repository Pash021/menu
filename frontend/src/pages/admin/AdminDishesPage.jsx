import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  createDish,
  deleteDish,
  getDishImageStatus,
  listCategories,
  listDishes,
  requestDishRemoveBg,
  updateDish,
  useDishOriginalImage,
  useDishProcessedImage,
} from "@/api/restaurants";
import { getApiErrorMessage } from "@/api/client";
import { useActiveRestaurant } from "@/lib/activeRestaurant";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/format";
import { validateImageFile } from "@/lib/uploads";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TranslationEditor } from "@/components/admin/translations/TranslationEditor";

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.coerce.number().min(0),
  currency: z.enum(["AMD", "USD", "EUR", "RUB", "GBP"]).default("AMD"),
  category_id: z.coerce.number().int().positive(),
  available: z.boolean().default(true),
  is_spicy: z.boolean().default(false),
  is_vegan: z.boolean().default(false),
});

export default function AdminDishesPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { restaurantId } = useActiveRestaurant();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const categoriesQuery = useQuery({
    queryKey: ["categories", { restaurantId }],
    queryFn: () => listCategories(restaurantId),
    enabled: Boolean(restaurantId),
    retry: false,
  });

  const dishesQuery = useQuery({
    queryKey: ["dishes", { restaurantId, q, page }],
    queryFn: () => listDishes(restaurantId, { q: q || undefined, page, page_size: pageSize }),
    enabled: Boolean(restaurantId),
    retry: false,
  });

  const categories = categoriesQuery.data?.items ?? categoriesQuery.data ?? [];
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const items = dishesQuery.data?.items ?? dishesQuery.data ?? [];
  const total = dishesQuery.data?.total ?? items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const canCreateDish = categoriesQuery.isSuccess && categories.length > 0;

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      currency: "AMD",
      category_id: undefined,
      available: true,
      is_spicy: false,
      is_vegan: false,
    },
  });

  function openCreateModal() {
    if (!canCreateDish) {
      toast.error(t("admin.dishes.needCategory"));
      return;
    }
    setEditing(null);
    setImageFile(null);
    setImagePreview(null);
    form.reset({
      name: "",
      description: "",
      price: 0,
      currency: "AMD",
      category_id: categories[0]?.id,
      available: true,
      is_spicy: false,
      is_vegan: false,
    });
    setModalOpen(true);
  }

  useEffect(() => {
    if (!modalOpen) return;
    if (!categories.length) return;
    const current = Number(form.getValues("category_id"));
    if (Number.isFinite(current) && current > 0) return;
    form.setValue("category_id", categories[0].id, { shouldValidate: true });
  }, [modalOpen, categories, form]);

  useEffect(() => {
    if (!imageFile) return;
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const upsertMutation = useMutation({
    mutationFn: async (values) => {
      if (!restaurantId) throw new Error("No restaurant selected");
      const payload = { ...values, image: imageFile ?? undefined };
      if (editing) return updateDish(editing.id, payload);
      return createDish(restaurantId, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dishes"] });
      toast.success(t("toast.saved"));
      setModalOpen(false);
      setEditing(null);
      setImageFile(null);
      setImagePreview(null);
      form.reset();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (dishId) => deleteDish(dishId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dishes"] });
      toast.success(t("toast.deleted"));
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const toolbar = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-0.5">
        <div className="text-sm text-muted-foreground">{t("admin.dishes.title")}</div>
        <div className="text-2xl font-semibold tracking-tight">{t("nav.dishes")}</div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder={t("common.searchDish")}
          className="sm:w-72"
          disabled={!restaurantId}
        />
        <Button
          className="gap-2"
          onClick={openCreateModal}
          disabled={!restaurantId || !canCreateDish}
        >
          <Plus className="h-4 w-4" />
          {t("common.create")}
        </Button>
      </div>
    </div>
  );

  const dishImageQuery = useQuery({
    queryKey: ["dishImage", editing?.id],
    queryFn: () => getDishImageStatus(editing.id),
    enabled: Boolean(editing?.id && modalOpen),
    retry: false,
    refetchInterval: (query) => {
      const status = query?.state?.data?.status;
      return status === "queued" || status === "processing" ? 1500 : false;
    },
  });

  const removeBgMutation = useMutation({
    mutationFn: () => requestDishRemoveBg(editing.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dishImage", editing?.id] });
      toast.success(t("toast.updated"));
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const useOriginalMutation = useMutation({
    mutationFn: () => useDishOriginalImage(editing.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dishImage", editing?.id] });
      await queryClient.invalidateQueries({ queryKey: ["dishes"] });
      toast.success(t("toast.updated"));
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const useProcessedMutation = useMutation({
    mutationFn: () => useDishProcessedImage(editing.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dishImage", editing?.id] });
      await queryClient.invalidateQueries({ queryKey: ["dishes"] });
      toast.success(t("toast.updated"));
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  if (!restaurantId) {
    return (
      <EmptyState
        icon={UtensilsCrossed}
        title={t("common.selectRestaurant")}
        description={t("admin.selectRestaurant")}
      />
    );
  }

  if (categoriesQuery.isSuccess && categories.length === 0) {
    return (
      <EmptyState
        icon={UtensilsCrossed}
        title="Сначала создайте категорию"
        description="Чтобы добавить блюдо, нужна хотя бы одна категория."
        actionLabel="Перейти к категориям"
        onAction={() => (window.location.href = "/admin/categories")}
      />
    );
  }

  return (
    <div className="space-y-4">
      {toolbar}

      {dishesQuery.isLoading ? (
        <div className="rounded-xl border bg-card p-6">{t("common.loading")}</div>
      ) : dishesQuery.isError ? (
        <EmptyState icon={UtensilsCrossed} title={t("common.error")} description="Не удалось загрузить блюда." />
      ) : items.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="Блюд пока нет"
          description="Добавьте первое блюдо, чтобы заполнить публичное меню."
          actionLabel={canCreateDish ? t("common.create") : null}
          onAction={canCreateDish ? openCreateModal : null}
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("dish.name")}</TableHead>
                <TableHead>{t("dish.category")}</TableHead>
                <TableHead>{t("dish.price")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 overflow-hidden rounded-lg border bg-muted">
                        {d.image_url ? (
                          <img src={d.image_url} alt={d.name} className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                        <div className="min-w-0">
                          <div className="truncate">{d.name}</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                          {d.is_spicy ? <Badge>{t("dish.badge.spicy")}</Badge> : null}
                          {d.is_vegan ? <Badge variant="secondary">{t("dish.badge.vegan")}</Badge> : null}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  <TableCell className="text-muted-foreground">{categoryById.get(d.category_id)?.name ?? "—"}</TableCell>
                  <TableCell>{formatMoney(d.price, d.currency)}</TableCell>
                  <TableCell>
                    {d.available ? (
                      <Badge variant="secondary">{t("dish.available")}</Badge>
                    ) : (
                      <Badge variant="muted">{t("dish.badge.unavailable")}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => {
                          setEditing(d);
                          setImageFile(null);
                          setImagePreview(d.image_url ?? null);
                          form.reset({
                            name: d.name ?? "",
                            description: d.description ?? "",
                            price: Number(d.price ?? 0),
                            currency: d.currency ?? "AMD",
                            category_id: d.category_id ?? categories[0]?.id,
                            available: Boolean(d.available),
                            is_spicy: Boolean(d.is_spicy),
                            is_vegan: Boolean(d.is_vegan),
                          });
                          setModalOpen(true);
                        }}
                      >
                        {t("common.edit")}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full gap-2 sm:w-auto"
                        onClick={() => setDeleteTarget(d)}
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

          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
        </>
      )}

      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) {
            setEditing(null);
            setImageFile(null);
            setImagePreview(null);
            form.reset();
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
          <DialogHeader>
            <DialogTitle>{editing ? "Редактировать блюдо" : "Новое блюдо"}</DialogTitle>
          </DialogHeader>

          <form className="space-y-4" onSubmit={form.handleSubmit((v) => upsertMutation.mutate(v))}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("dish.name")}</label>
                <Input {...form.register("name")} />
                {form.formState.errors.name?.message ? (
                  <div className="text-xs text-destructive">{String(form.formState.errors.name.message)}</div>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("dish.category")}</label>
                <Select {...form.register("category_id")}>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                {form.formState.errors.category_id?.message ? (
                  <div className="text-xs text-destructive">{String(form.formState.errors.category_id.message)}</div>
                ) : null}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t("dish.description")} <span className="text-xs text-muted-foreground">({t("common.optional")})</span>
              </label>
              <Textarea {...form.register("description")} />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("dish.price")}</label>
                <Input type="number" step="0.01" min="0" {...form.register("price")} />
                {form.formState.errors.price?.message ? (
                  <div className="text-xs text-destructive">{String(form.formState.errors.price.message)}</div>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("dish.currency")}</label>
                <Select {...form.register("currency")}>
                  <option value="AMD">AMD ֏</option>
                  <option value="USD">USD $</option>
                  <option value="EUR">EUR €</option>
                  <option value="RUB">RUB ₽</option>
                  <option value="GBP">GBP £</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {t("dish.image")} <span className="text-xs text-muted-foreground">({t("common.optional")})</span>
                </label>
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    const error = validateImageFile(file);
                    if (error) {
                      toast.error(error);
                      e.target.value = "";
                      setImageFile(null);
                      return;
                    }
                    setImageFile(file);
                  }}
                />
              </div>
            </div>

            {imagePreview ? (
              <div className="overflow-hidden rounded-xl border bg-muted">
                <img src={imagePreview} alt="preview" className="h-56 w-full object-cover" />
              </div>
            ) : null}

            {editing?.id ? (
              <div className="rounded-2xl border bg-card p-4">
                <div className="text-sm font-semibold">{t("dish.imageProcessing.title")}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {dishImageQuery.data?.status ? `${t("dish.imageProcessing.status")}: ${dishImageQuery.data.status}` : "—"}
                  {dishImageQuery.data?.error ? ` · ${dishImageQuery.data.error}` : ""}
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="overflow-hidden rounded-xl border bg-muted">
                    {dishImageQuery.data?.image_url ? (
                      <img src={dishImageQuery.data.image_url} alt="original" className="h-44 w-full object-cover" />
                    ) : (
                      <div className="grid h-44 place-items-center text-sm text-muted-foreground">No image</div>
                    )}
                  </div>
                  <div className="overflow-hidden rounded-xl border bg-muted">
                    {dishImageQuery.data?.processed_image_url ? (
                      <img src={dishImageQuery.data.processed_image_url} alt="processed" className="h-44 w-full object-contain p-3" />
                    ) : (
                      <div className="grid h-44 place-items-center text-sm text-muted-foreground">Processed not ready</div>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => removeBgMutation.mutate()}
                    disabled={!dishImageQuery.data?.image_url || removeBgMutation.isPending}
                  >
                    {removeBgMutation.isPending ? t("common.loading") : t("dish.imageProcessing.removeBg")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => useOriginalMutation.mutate()}
                    disabled={useOriginalMutation.isPending}
                  >
                    {useOriginalMutation.isPending ? t("common.loading") : t("dish.imageProcessing.useOriginal")}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => useProcessedMutation.mutate()}
                    disabled={!dishImageQuery.data?.processed_image_url || useProcessedMutation.isPending}
                  >
                    {useProcessedMutation.isPending ? t("common.loading") : t("dish.imageProcessing.useProcessed")}
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-4">
              <label className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm">
                <input type="checkbox" className="h-4 w-4" {...form.register("available")} />
                {t("dish.available")}
              </label>
              <label className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm">
                <input type="checkbox" className="h-4 w-4" {...form.register("is_spicy")} />
                {t("dish.isSpicy")}
              </label>
              <label className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm">
                <input type="checkbox" className="h-4 w-4" {...form.register("is_vegan")} />
                {t("dish.isVegan")}
              </label>
            </div>

            {editing?.id ? (
              <TranslationEditor dishId={editing.id} open={modalOpen} />
            ) : (
              <div className="rounded-2xl border bg-muted/10 p-4 text-sm text-muted-foreground">
                {t("admin.dishes.translations.saveFirst")}
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
        title="Удалить блюдо?"
        description="Это действие нельзя отменить."
        cancelLabel={t("common.cancel")}
        confirmLabel={t("common.delete")}
        isDanger
        onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
