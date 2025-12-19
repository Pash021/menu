import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Table2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { createTable, deleteTable, listTables, updateTable } from "@/api/restaurants";
import { getApiErrorMessage } from "@/api/client";
import { useActiveRestaurant } from "@/lib/activeRestaurant";
import { useI18n } from "@/lib/i18n";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const schema = z.object({
  number: z.coerce.number().int().min(1).max(9999),
});

export default function AdminTablesPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { restaurantId } = useActiveRestaurant();

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [q, setQ] = useState("");

  const tablesQuery = useQuery({
    queryKey: ["tables", { restaurantId }],
    queryFn: () => listTables(restaurantId),
    enabled: Boolean(restaurantId),
    retry: false,
  });

  const rawItems = tablesQuery.data?.items ?? tablesQuery.data ?? [];
  const items = useMemo(() => {
    const query = q.trim();
    if (!query) return rawItems;
    return rawItems.filter((tbl) => String(tbl.number ?? "").includes(query));
  }, [rawItems, q]);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { number: "" },
  });

  const createMutation = useMutation({
    mutationFn: (values) => createTable(restaurantId, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tables"] });
      toast.success(t("toast.saved"));
      setModalOpen(false);
      form.reset({ number: "" });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ tableId, is_occupied }) => updateTable(tableId, { is_occupied }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tables"] });
      toast.success(t("toast.updated"));
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (tableId) => deleteTable(tableId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tables"] });
      toast.success(t("toast.deleted"));
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const toolbar = useMemo(() => {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <div className="text-sm text-muted-foreground">{t("admin.tables.title")}</div>
          <div className="text-2xl font-semibold tracking-tight">{t("nav.tables")}</div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("common.search")}
            className="sm:w-56"
            disabled={!restaurantId}
          />
          <Button onClick={() => setModalOpen(true)} className="gap-2" disabled={!restaurantId}>
            <Plus className="h-4 w-4" />
            {t("common.create")}
          </Button>
        </div>
      </div>
    );
  }, [t, restaurantId, q]);

  if (!restaurantId) {
    return (
      <EmptyState icon={Table2} title={t("common.selectRestaurant")} description={t("admin.selectRestaurant")} />
    );
  }

  return (
    <div className="space-y-4">
      {toolbar}

      {tablesQuery.isLoading ? (
        <div className="rounded-xl border bg-card p-6">{t("common.loading")}</div>
      ) : tablesQuery.isError ? (
        <EmptyState icon={Table2} title={t("common.error")} description="Не удалось загрузить столы." />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Table2}
          title="Столов нет"
          description="Добавьте столы, чтобы генерировать QR-ссылки."
          actionLabel={t("common.create")}
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.number")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((tbl) => (
              <TableRow key={tbl.id}>
                <TableCell className="font-medium">{tbl.number}</TableCell>
                <TableCell>
                  {tbl.is_occupied ? <Badge>{t("table.occupied")}</Badge> : <Badge variant="secondary">{t("table.free")}</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() =>
                        toggleMutation.mutate({ tableId: tbl.id, is_occupied: !Boolean(tbl.is_occupied) })
                      }
                      disabled={toggleMutation.isPending}
                    >
                      Отметить: {tbl.is_occupied ? t("table.free") : t("table.occupied")}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full gap-2 sm:w-auto"
                      onClick={() => setDeleteTarget(tbl)}
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
          if (!open) form.reset({ number: "" });
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Новый стол</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("table.number")}</label>
              <Input type="number" min="1" max="9999" {...form.register("number")} />
              {form.formState.errors.number?.message ? (
                <div className="text-xs text-destructive">{String(form.formState.errors.number.message)}</div>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? t("common.loading") : t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => (!v ? setDeleteTarget(null) : null)}
        title="Удалить стол?"
        description="QR-ссылки больше не будут работать."
        cancelLabel={t("common.cancel")}
        confirmLabel={t("common.delete")}
        isDanger
        onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
