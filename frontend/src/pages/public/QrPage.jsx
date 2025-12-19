import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { QrCode } from "lucide-react";
import { resolveQr } from "@/api/menu";
import { useI18n } from "@/lib/i18n";
import { EmptyState } from "@/components/EmptyState";
import { LoadingPageSkeleton } from "@/components/LoadingSkeleton";

export default function QrPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();

  const qrQuery = useQuery({
    queryKey: ["qr", code],
    queryFn: () => resolveQr(code),
    enabled: Boolean(code),
    retry: false,
  });

  useEffect(() => {
    const slug = qrQuery.data?.slug;
    const table = qrQuery.data?.table;
    if (slug && table) navigate(`/r/${slug}/table/${table}`, { replace: true });
  }, [qrQuery.data, navigate]);

  if (qrQuery.isLoading) return <LoadingPageSkeleton />;

  if (qrQuery.isError) {
    return (
      <div className="container py-10">
        <EmptyState icon={QrCode} title={t("qr.notFound")} description={t("qr.hint")} />
      </div>
    );
  }

  return (
    <div className="container py-10">
      <EmptyState icon={QrCode} title={t("qr.resolving")} description={t("qr.hint")} />
    </div>
  );
}
