import { useEffect, useState } from "react";

export function useElementSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref?.current;
    if (!el) return undefined;

    let rafId = null;
    const measure = () => {
      rafId = null;
      const rect = el.getBoundingClientRect();
      const next = { width: Math.round(rect.width), height: Math.round(rect.height) };
      setSize((prev) => (prev.width === next.width && prev.height === next.height ? prev : next));
    };

    measure();

    if (typeof ResizeObserver === "function") {
      const ro = new ResizeObserver(() => {
        if (rafId) return;
        rafId = window.requestAnimationFrame(measure);
      });
      ro.observe(el);
      return () => {
        window.cancelAnimationFrame(rafId);
        ro.disconnect();
      };
    }

    window.addEventListener("resize", measure);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", measure);
    };
  }, [ref]);

  return size;
}

