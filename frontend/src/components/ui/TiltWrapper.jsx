import React, { useEffect, useMemo, useRef } from "react";
import { animate, motion, useMotionValue } from "framer-motion";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useIsLowEndDevice } from "@/hooks/useIsLowEndDevice";

function isEditableElement(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = String(el.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}

export const TiltWrapper = React.forwardRef(function TiltWrapper(
  {
    children,
    className,
    maxTilt = 6,
    perspective = 900,
    disabled = false,
    hoverScale = 1.01,
    tapScale = 0.98,
    style,
    onPointerEnter,
    onPointerMove,
    onPointerLeave,
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    onKeyDown,
    ...motionProps
  },
  ref
) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const lowEnd = useIsLowEndDevice();
  const enabled = !disabled && !prefersReducedMotion && !lowEnd;

  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);

  const localRef = useRef(null);
  const rectRef = useRef(null);
  const rafRef = useRef(null);
  const pointerRef = useRef({
    active: false,
    pointerType: "mouse",
    x: 0,
    y: 0,
  });

  const setRefs = (node) => {
    localRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };

  const resetTilt = (duration = 0.18) => {
    animate(rotateX, 0, { duration, ease: "easeOut" });
    animate(rotateY, 0, { duration, ease: "easeOut" });
    const el = localRef.current;
    if (el) el.style.willChange = "";
  };

  const scheduleUpdate = () => {
    if (rafRef.current) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const el = localRef.current;
      if (!el) return;
      const rect = rectRef.current || el.getBoundingClientRect();
      rectRef.current = rect;

      const px = (pointerRef.current.x - rect.left) / rect.width;
      const py = (pointerRef.current.y - rect.top) / rect.height;
      const clampedX = Math.min(1, Math.max(0, px));
      const clampedY = Math.min(1, Math.max(0, py));

      const tiltY = (clampedX - 0.5) * 2 * maxTilt;
      const tiltX = (0.5 - clampedY) * 2 * maxTilt;
      rotateX.set(tiltX);
      rotateY.set(tiltY);
    });
  };

  const handlePointerMove = (e) => {
    if (!enabled) return;
    if (isEditableElement(e.target)) return;

    const isTouch = e.pointerType === "touch";
    const active = pointerRef.current.active;
    if (isTouch && !active) return;

    pointerRef.current.pointerType = e.pointerType || "mouse";
    pointerRef.current.x = e.clientX;
    pointerRef.current.y = e.clientY;
    scheduleUpdate();
  };

  const handlePointerEnter = (e) => {
    if (!enabled) return;
    if (e.pointerType !== "mouse") return;
    const el = localRef.current;
    if (!el) return;
    rectRef.current = el.getBoundingClientRect();
    el.style.willChange = "transform";
    pointerRef.current.active = true;
    handlePointerMove(e);
  };

  const handlePointerLeave = () => {
    if (!enabled) return;
    pointerRef.current.active = false;
    resetTilt(0.2);
  };

  const handlePointerDown = (e) => {
    if (!enabled) return;
    if (isEditableElement(e.target)) return;

    const el = localRef.current;
    if (el) {
      rectRef.current = el.getBoundingClientRect();
      el.style.willChange = "transform";
    }

    pointerRef.current.active = true;
    pointerRef.current.pointerType = e.pointerType || "mouse";
    pointerRef.current.x = e.clientX;
    pointerRef.current.y = e.clientY;
    scheduleUpdate();

    // Pointer capture breaks parent swipe gestures on mobile (events stop reaching the swipe wrapper),
    // so only use capture for mouse interactions.
    if (e.pointerType === "mouse" && typeof e.currentTarget?.setPointerCapture === "function") {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
      }
    }
  };

  const handlePointerUp = () => {
    if (!enabled) return;
    pointerRef.current.active = false;
    resetTilt(0.18);
  };

  useEffect(() => {
    return () => {
      window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const hover = useMemo(() => {
    if (!enabled) return undefined;
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return undefined;
    return { scale: hoverScale };
  }, [enabled, hoverScale]);

  useEffect(() => {
    if (!enabled) return;
    function onEsc(e) {
      if (e.key === "Escape") resetTilt(0.12);
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [enabled]);

  return (
    <motion.div
      ref={setRefs}
      className={cn("transform-gpu", className)}
      style={{
        rotateX,
        rotateY,
        transformPerspective: enabled ? perspective : undefined,
        ...style,
      }}
      whileHover={hover}
      whileTap={{ scale: tapScale }}
      onPointerEnter={(e) => {
        handlePointerEnter(e);
        onPointerEnter?.(e);
      }}
      onPointerMove={(e) => {
        handlePointerMove(e);
        onPointerMove?.(e);
      }}
      onPointerLeave={(e) => {
        handlePointerLeave(e);
        onPointerLeave?.(e);
      }}
      onPointerDown={(e) => {
        handlePointerDown(e);
        onPointerDown?.(e);
      }}
      onPointerUp={(e) => {
        handlePointerUp(e);
        onPointerUp?.(e);
      }}
      onPointerCancel={(e) => {
        handlePointerUp(e);
        onPointerCancel?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") resetTilt(0.12);
        onKeyDown?.(e);
      }}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
});
