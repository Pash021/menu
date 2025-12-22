import React from "react";
import { Check, ChevronDown, Languages } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import styles from "./MenuHeaderActions.module.css";

export function MenuHeaderActions({ tone = "light" }) {
  const { lang, setLang, languages, t } = useI18n();
  const current = languages.find((l) => l.code === lang) || languages[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={[styles.langButton, tone === "dark" ? styles.toneDark : styles.toneLight].join(" ")}
          aria-label={t("public.switchLanguage")}
        >
          <Languages aria-hidden="true" />
          <span className={styles.lang}>{current.code.toUpperCase()}</span>
          <ChevronDown aria-hidden="true" className={styles.chevron} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="min-w-40 p-0.5">
        {languages.map((l) => {
          const active = l.code === lang;
          return (
            <DropdownMenuItem
              key={l.code}
              onSelect={() => setLang(l.code)}
              className="flex items-center justify-between gap-2 px-2 py-1 text-xs"
            >
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold leading-tight">{l.label}</div>
                <div className="text-[11px] leading-tight text-muted-foreground">{l.code.toUpperCase()}</div>
              </div>
              {active ? (
                <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              ) : (
                <span className="h-3.5 w-3.5" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
