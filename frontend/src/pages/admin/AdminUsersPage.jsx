import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { listUsers } from "@/api/restaurants";
import { useI18n } from "@/lib/i18n";
import { EmptyState } from "@/components/EmptyState";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AdminUsersPage() {
  const { t } = useI18n();

  const usersQuery = useQuery({
    queryKey: ["users", { page: 1, page_size: 100 }],
    queryFn: () => listUsers({ page: 1, page_size: 100 }),
    retry: false,
  });

  const items = usersQuery.data?.items ?? usersQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm text-muted-foreground">{t("admin.users.title")}</div>
        <div className="text-2xl font-semibold tracking-tight">{t("nav.users")}</div>
      </div>

      {usersQuery.isLoading ? (
        <div className="rounded-xl border bg-card p-6">{t("common.loading")}</div>
      ) : usersQuery.isError ? (
        <EmptyState icon={Users} title={t("common.error")} description="Не удалось загрузить пользователей." />
      ) : items.length === 0 ? (
        <EmptyState icon={Users} title="Пользователей нет" description="—" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Логин</TableHead>
              <TableHead>Роль</TableHead>
              <TableHead>Заблокирован</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.email}</TableCell>
                <TableCell className="text-muted-foreground">{u.username || "—"}</TableCell>
                <TableCell>{u.role}</TableCell>
                <TableCell>{u.is_blocked ? t("common.yes") : t("common.no")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
