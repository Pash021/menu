import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, SearchX } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-12">
      <div className="w-full max-w-xl">
        <EmptyState
          icon={SearchX}
          title="Страница не найдена"
          description="Похоже, ссылка неверна или страница была перемещена."
          actionLabel="Назад"
          onAction={() => window.history.back()}
        />
        <div className="mt-4 flex justify-center">
          <Button asChild variant="ghost" className="gap-2">
            <Link to="/admin">
              <ArrowLeft className="h-4 w-4" />
              Админка
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
