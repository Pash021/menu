import React from "react";
import { cn } from "@/lib/cn";
import { useIsLowEndDevice } from "@/hooks/useIsLowEndDevice";
import { usePublicMenuTheme } from "@/components/theme/ThemeProvider";

export const GlassCard = React.forwardRef(function GlassCard(
  { as: Comp = "div", className, style, blur, children, ...props },
  ref
) {
  const lowEnd = useIsLowEndDevice();
  const { cardStyle } = usePublicMenuTheme();
  const defaultBlur = cardStyle === "flat" ? 0 : cardStyle === "glow" ? 10 : 12;
  const effectiveBlur = typeof blur === "number" ? blur : lowEnd ? 0 : defaultBlur;
  const enableBlur = effectiveBlur > 0;

  return (
    <Comp
      ref={ref}
      className={cn(
        "menuGlassSurface",
        "relative overflow-hidden rounded-[var(--menu-radius-card)] border",
        enableBlur ? "backdrop-saturate-150" : null,
        className
      )}
      style={{
        background: "var(--menu-surface)",
        borderColor: "var(--menu-border)",
        boxShadow:
          cardStyle === "glow"
            ? "var(--menu-card-glow), var(--menu-shadow)"
            : lowEnd
              ? "var(--menu-shadow-soft)"
              : "var(--menu-shadow)",
        WebkitBackdropFilter: enableBlur ? `blur(${effectiveBlur}px)` : undefined,
        backdropFilter: enableBlur ? `blur(${effectiveBlur}px)` : undefined,
        ...style,
      }}
      {...props}
    >
      {children}
    </Comp>
  );
});
