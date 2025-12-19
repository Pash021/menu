import React from "react";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/EmptyState";

export default function RequireRole({ roles, children }) {
  const { user } = useAuth();
  const allowed = user && roles.includes(user.role);

  if (!allowed) {
    return (
      <div className="container py-6">
        <EmptyState
          icon={ShieldAlert}
          title="Доступ ограничен"
          description="Ваша роль не позволяет открыть этот раздел."
        />
      </div>
    );
  }

  return children;
}
