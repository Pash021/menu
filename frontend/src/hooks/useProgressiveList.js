import { useEffect, useState } from "react";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function useProgressiveList(total, resetKey, { initial = 24, step = 24 } = {}) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeInitial = clamp(Number(initial) || 0, 0, safeTotal);
  const safeStep = clamp(Number(step) || 0, 1, 200);

  const [count, setCount] = useState(() => Math.min(safeTotal, safeInitial));

  useEffect(() => {
    setCount(Math.min(safeTotal, safeInitial));
  }, [resetKey, safeInitial, safeTotal]);

  useEffect(() => {
    if (count >= safeTotal) return undefined;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      setCount((prev) => Math.min(safeTotal, prev + safeStep));
    };

    if (typeof window === "undefined") return undefined;
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(tick, { timeout: 400 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback?.(id);
      };
    }

    const id = window.setTimeout(tick, 16);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [count, safeStep, safeTotal]);

  return count;
}

