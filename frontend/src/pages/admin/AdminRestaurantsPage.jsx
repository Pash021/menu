import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Settings2, Store } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { createRestaurant, listRestaurants, uploadRestaurantLogo } from "@/api/restaurants";
import { getApiErrorMessage } from "@/api/client";
import { useI18n } from "@/lib/i18n";
import { validateImageFile } from "@/lib/uploads";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function makeSlug(value) {
  const base = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");
  return base || `rest-${Math.random().toString(16).slice(2, 10)}`;
}

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  slug: z
    .string()
    .optional()
    .refine((v) => !v || /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(v), {
      message: "Slug должен содержать буквы/цифры и дефисы",
    }),
});

export default function AdminRestaurantsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  const qParam = searchParams.get("q") ?? "";
  const pageParam = Number(searchParams.get("page") ?? "1") || 1;
  const pageSize = 20;

  const [qInput, setQInput] = useState(qParam);
  const q = useDebouncedValue(qInput, 350);

  useEffect(() => {
    setQInput(qParam);
  }, [qParam]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (q) next.set("q", q);
    else next.delete("q");
    next.set("page", "1");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const restaurantsQuery = useQuery({
    queryKey: ["restaurants", { q: qParam, page: pageParam }],
    queryFn: () => listRestaurants({ q: qParam || undefined, page: pageParam, page_size: pageSize }),
    retry: false,
  });

  const items = restaurantsQuery.data?.items ?? restaurantsQuery.data ?? [];
  const total = restaurantsQuery.data?.total ?? items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const created = await createRestaurant(payload);
      if (logoFile) {
        try {
          await uploadRestaurantLogo(created?.restaurant?.id ?? created?.id, logoFile);
        } catch (err) {
          toast.error(getApiErrorMessage(err));
        }
      }
      return created;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      toast.success(t("toast.saved"));
      setCreateOpen(false);
      setLogoFile(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: "", description: "", slug: "" },
  });

  const nameValue = form.watch("name");
  const slugValue = form.watch("slug");
  const slugTouched = form.formState.touchedFields.slug;

  useEffect(() => {
    if (slugTouched) return;
    if (!nameValue) return;
    if (slugValue) return;
    form.setValue("slug", makeSlug(nameValue), { shouldValidate: true });
  }, [nameValue, slugValue, slugTouched, form]);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(null);
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  function setPage(nextPage) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(nextPage));
    setSearchParams(next);
  }

  const toolbar = useMemo(() => {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder={t("common.search")}
            className="w-full sm:w-80"
          />
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t("admin.restaurants.create.title")}
        </Button>
      </div>
    );
  }, [qInput, t]);

  return (
    <div className="space-y-4">
      {toolbar}

      {restaurantsQuery.isLoading ? (
        <div className="rounded-xl border bg-card p-4">
          <div className="space-y-3">
            <LoadingSkeleton className="h-4 w-64" />
            <LoadingSkeleton className="h-10 w-full" />
            <LoadingSkeleton className="h-10 w-full" />
            <LoadingSkeleton className="h-10 w-full" />
          </div>
        </div>
      ) : restaurantsQuery.isError ? (
        <EmptyState icon={Store} title={t("common.error")} description="Не удалось загрузить рестораны." />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Store}
          title={t("admin.restaurants.empty.title")}
          description={t("admin.restaurants.empty.desc")}
          actionLabel={t("admin.restaurants.create.title")}
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("restaurant.name")}</TableHead>
                <TableHead>{t("restaurant.slug")}</TableHead>
                <TableHead className="text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.slug}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm" className="gap-2">
                      <Link to={`/admin/restaurants/${r.id}/manage`}>
                        <Settings2 className="h-4 w-4" />
                        {t("admin.manage.title")}
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Pagination page={pageParam} pageCount={pageCount} onPageChange={setPage} />
        </>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            form.reset();
            setLogoFile(null);
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("admin.restaurants.create.title")}</DialogTitle>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) =>
              createMutation.mutate({
                ...values,
                slug: values.slug || undefined,
              })
            )}
          >
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("restaurant.name")}</label>
              <Input placeholder="Например: Ararat Bistro" {...form.register("name")} />
              {form.formState.errors.name?.message ? (
                <div className="text-xs text-destructive">{String(form.formState.errors.name.message)}</div>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t("restaurant.slug")} <span className="text-xs text-muted-foreground">({t("common.optional")})</span>
              </label>
              <Input placeholder="ararat-bistro" {...form.register("slug")} />
              {form.formState.errors.slug?.message ? (
                <div className="text-xs text-destructive">{String(form.formState.errors.slug.message)}</div>
              ) : (
                <div className="text-xs text-muted-foreground">Используется в публичной ссылке.</div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t("restaurant.description")} <span className="text-xs text-muted-foreground">({t("common.optional")})</span>
              </label>
              <Textarea placeholder="Короткое описание..." {...form.register("description")} />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t("restaurant.logo")} <span className="text-xs text-muted-foreground">({t("common.optional")})</span>
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
                    setLogoFile(null);
                    return;
                  }
                  setLogoFile(file);
                }}
              />
              {logoFile ? (
                <div className="text-xs text-muted-foreground">Выбрано: {logoFile.name}</div>
              ) : null}
              {logoPreview ? (
                <div className="overflow-hidden rounded-xl border bg-muted">
                  <img src={logoPreview} alt="logo preview" className="h-32 w-full object-cover" />
                </div>
              ) : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? t("common.loading") : t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
