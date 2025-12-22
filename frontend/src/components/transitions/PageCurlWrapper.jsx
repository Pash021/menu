import React, { useEffect, useMemo, useRef } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { useTransitionDirection } from "@/hooks/useTransitionDirection";
import { useIsLowEndDevice } from "@/hooks/useIsLowEndDevice";
import styles from "./PageCurlWrapper.module.css";

function isEditableElement(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = String(el.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}

function getTouchPoint(e) {
  const t = e?.touches?.[0] || e?.changedTouches?.[0];
  if (!t) return null;
  return { x: t.clientX, y: t.clientY };
}

export function PageCurlWrapper({
  children,
  className,
  enableGestures = false,
  enableArrowKeys = false,
  onSwipeLeft,
  onSwipeRight,
  lockMs,
  mode = "fade",
}) {
  const { direction, prefersReducedMotion, isAnimating, prepareTransition } = useTransitionDirection();
  const lowEnd = useIsLowEndDevice();
  const bounceControls = useAnimationControls();
  const rootRef = useRef(null);

  const gestureRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    horizontal: false,
    pointerId: null,
    captured: false,
    startedWithin: false,
    touchId: null,
  });

  const rafRef = useRef(null);

  const pageVariants = useMemo(() => {
    if (mode === "sheet") {
      if (prefersReducedMotion || lowEnd) {
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        };
      }
      const initialY = direction === "back" ? -24 : 84;
      return {
        initial: { opacity: 0, y: initialY },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 84 },
      };
    }

    const safeMode = mode === "slide" || mode === "flip" || mode === "fade" ? mode : "fade";

    if (safeMode === "slide") {
      if (direction === "forward") {
        return { initial: { opacity: 0, x: 90 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -70 } };
      }
      return { initial: { opacity: 0, x: -70 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 90 } };
    }

    if (safeMode === "flip" && !prefersReducedMotion && !lowEnd) {
      const forward = direction === "forward";
      const start = forward ? 46 : -46;
      const end = forward ? -38 : 38;
      return {
        initial: { opacity: 0.01, rotateY: start, x: forward ? 24 : -24 },
        animate: { opacity: 1, rotateY: 0, x: 0 },
        exit: { opacity: 0.01, rotateY: end, x: forward ? -18 : 18 },
      };
    }

    // Default: lightweight fade.
    if (direction === "forward") {
      return { initial: { opacity: 0, x: 22 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -18 } };
    }
    return { initial: { opacity: 0, x: -18 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 22 } };
  }, [direction, mode, prefersReducedMotion, lowEnd]);

  const triggerForward = () => {
    if (!onSwipeLeft) {
      bounceControls.start({ x: [-10, 0], transition: { duration: 0.24, ease: "easeOut" } });
      return;
    }
    if (!prepareTransition("forward", lockMs)) return;
    onSwipeLeft();
  };

  const triggerBack = () => {
    if (!onSwipeRight) {
      bounceControls.start({ x: [10, 0], transition: { duration: 0.24, ease: "easeOut" } });
      return;
    }
    if (!prepareTransition("back", lockMs)) return;
    onSwipeRight();
  };

  const beginGesture = (x, y, pointerId = null) => {
    const g = gestureRef.current;
    g.active = true;
    g.startX = x;
    g.startY = y;
    g.lastX = x;
    g.lastY = y;
    g.horizontal = false;
    g.pointerId = pointerId;
    g.captured = false;
    g.touchId = null;
  };

  const updateGesture = (x, y) => {
    const g = gestureRef.current;
    if (!g.active) return;

    g.lastX = x;
    g.lastY = y;

    if (!rafRef.current) {
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const dx = g.lastX - g.startX;
        const dy = g.lastY - g.startY;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (!g.horizontal) {
          // Horizontal intent.
          if (absDx > 10 && absDx > absDy + 6) {
            g.horizontal = true;
            document.documentElement.dataset.menuSwipe = "1";
          }
        }
      });
    }
  };

  const finishGesture = () => {
    const g = gestureRef.current;
    if (!g.active) return;
    g.active = false;
    g.pointerId = null;
    g.captured = false;
    g.startedWithin = false;
    g.touchId = null;
    window.cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    delete document.documentElement.dataset.menuSwipe;

    if (!g.horizontal) return;

    const dx = g.lastX - g.startX;
    const threshold = 60;

    if (dx <= -threshold) triggerForward();
    else if (dx >= threshold) triggerBack();
  };

  useEffect(() => {
    return () => {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      delete document.documentElement.dataset.menuSwipe;
    };
  }, []);

  useEffect(() => {
    if (!enableGestures) return undefined;
    const doc = document;

    const onTouchStartNative = (e) => {
      if (isAnimating) return;
      const root = rootRef.current;
      if (!root) return;
      if (!root.contains(e.target)) return;
      if (isEditableElement(e.target)) return;
      const p = getTouchPoint(e);
      if (!p) return;
      const touchId = e?.touches?.[0]?.identifier ?? null;
      gestureRef.current.startedWithin = true;
      beginGesture(p.x, p.y, null);
      gestureRef.current.touchId = touchId;
    };

    const onTouchMoveNative = (e) => {
      const g = gestureRef.current;
      if (!g.active || !g.startedWithin) return;
      const p = getTouchPoint(e);
      if (!p) return;
      updateGesture(p.x, p.y);
      if (g.horizontal) e.preventDefault();
    };

    const onTouchEndNative = (e) => {
      const g = gestureRef.current;
      if (!g.active || !g.startedWithin) return;
      const changed = Array.from(e?.changedTouches || []);
      const match = g.touchId != null ? changed.find((t) => t && t.identifier === g.touchId) : null;
      const t = match || changed[0] || null;
      if (t) {
        g.lastX = t.clientX;
        g.lastY = t.clientY;
        const dx = g.lastX - g.startX;
        const dy = g.lastY - g.startY;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        g.horizontal = absDx >= 60 && absDx > absDy + 14;
      }
      finishGesture();
    };

    doc.addEventListener("touchstart", onTouchStartNative, { passive: true, capture: true });
    doc.addEventListener("touchmove", onTouchMoveNative, { passive: false, capture: true });
    doc.addEventListener("touchend", onTouchEndNative, { passive: true, capture: true });
    doc.addEventListener("touchcancel", onTouchEndNative, { passive: true, capture: true });

    return () => {
      doc.removeEventListener("touchstart", onTouchStartNative, { capture: true });
      doc.removeEventListener("touchmove", onTouchMoveNative, { capture: true });
      doc.removeEventListener("touchend", onTouchEndNative, { capture: true });
      doc.removeEventListener("touchcancel", onTouchEndNative, { capture: true });
    };
  }, [enableGestures, isAnimating]);

  useEffect(() => {
    if (!enableArrowKeys) return;
    function onKeyDown(e) {
      if (e.defaultPrevented) return;
      if (isAnimating) return;
      if (isEditableElement(document.activeElement)) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        triggerForward();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        triggerBack();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enableArrowKeys, isAnimating, onSwipeLeft, onSwipeRight]);

  const onPointerDown = (e) => {
    if (!enableGestures) return;
    if (isAnimating) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (isEditableElement(e.target)) return;

    beginGesture(e.clientX, e.clientY, e.pointerId);
  };

  const onPointerMove = (e) => {
    const g = gestureRef.current;
    if (!g.active) return;
    if (g.pointerId != null && e.pointerId !== g.pointerId) return;
    updateGesture(e.clientX, e.clientY);
    // Only capture after we detected a horizontal gesture; otherwise clicks on links/buttons break on desktop.
    if (g.horizontal && !g.captured && e.pointerType === "mouse") {
      g.captured = true;
      try {
        e.currentTarget?.setPointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
    }
    if (g.horizontal) e.preventDefault();
  };

  const onPointerEnd = () => {
    finishGesture();
  };

  return (
    <motion.div
      ref={rootRef}
      className={[styles.page, "menuPageTransition", className].filter(Boolean).join(" ")}
      data-direction={direction}
      data-gestures={enableGestures ? "1" : undefined}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{
        duration: prefersReducedMotion || lowEnd ? 0.18 : mode === "sheet" ? 0.34 : mode === "slide" ? 0.32 : 0.28,
        ease: "easeOut",
      }}
      style={{ backfaceVisibility: "hidden", transformStyle: "preserve-3d", perspective: 900 }}
      onAnimationStart={() => {
        if (rootRef.current) rootRef.current.style.willChange = "transform, opacity";
      }}
      onAnimationComplete={() => {
        if (rootRef.current) rootRef.current.style.willChange = "";
      }}
      onPointerDownCapture={onPointerDown}
      onPointerMoveCapture={onPointerMove}
      onPointerUpCapture={onPointerEnd}
      onPointerCancelCapture={onPointerEnd}
    >
      <motion.div className={styles.inner} animate={bounceControls}>
        {children}
      </motion.div>
    </motion.div>
  );
}
