import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/api/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const schema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(6),
});

export default function LoginPage() {
  const { t } = useI18n();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = useMemo(() => {
    const from = location.state?.from;
    return typeof from === "string" && from.startsWith("/") ? from : "/admin";
  }, [location.state]);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { identifier: "", password: "" },
  });

  useEffect(() => {
    if (user) navigate("/admin", { replace: true });
  }, [user, navigate]);

  async function onSubmit(values) {
    setIsSubmitting(true);
    try {
      await login(values);
      toast.success(t("toast.welcome"));
      navigate(redirectTo, { replace: true });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-muted/30">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.16),transparent_55%)]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <span className="text-sm font-semibold">QR</span>
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold">{t("app.brand")}</div>
                <div className="text-xs text-muted-foreground">{t("app.tagline")}</div>
              </div>
            </div>
            <ThemeToggle />
          </div>

          <Card className="backdrop-blur">
            <CardHeader>
              <CardTitle>{t("auth.login.title")}</CardTitle>
              <CardDescription>{t("auth.login.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t("auth.identifier")}</label>
                  <Input
                    autoComplete="username"
                    placeholder="email@example.com или username"
                    {...form.register("identifier")}
                  />
                  {form.formState.errors.identifier?.message ? (
                    <div className="text-xs text-destructive">{String(form.formState.errors.identifier.message)}</div>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t("auth.password")}</label>
                  <Input type="password" autoComplete="current-password" {...form.register("password")} />
                  {form.formState.errors.password?.message ? (
                    <div className="text-xs text-destructive">{String(form.formState.errors.password.message)}</div>
                  ) : null}
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? t("common.loading") : t("auth.signin")}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="mt-6 text-center text-xs text-muted-foreground">
            Безопасная cookie-session авторизация + TanStack Query
          </div>
        </div>
      </div>
    </div>
  );
}
