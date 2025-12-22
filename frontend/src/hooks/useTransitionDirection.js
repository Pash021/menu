import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const TransitionDirectionContext = createContext(null);

function getLocationKey(location) {
  return location?.key || `${location?.pathname || ""}${location?.search || ""}`;
}

export function TransitionDirectionProvider({ children, lockMs = 480 }) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const prefersReducedMotion = usePrefersReducedMotion();

  const [direction, setDirection] = useState("forward");
  const [isAnimating, setIsAnimating] = useState(false);
  const directionRef = useRef(direction);

  const historyRef = useRef({ keys: [], index: -1 });
  const pendingDirectionRef = useRef(null);
  const didInitRef = useRef(false);

  const lockRef = useRef(false);
  const timerRef = useRef(null);

  const lockNavigation = useCallback((ms = lockMs) => {
    if (lockRef.current) return false;
    lockRef.current = true;
    setIsAnimating(true);
    if (typeof document !== "undefined") document.documentElement.dataset.menuAnim = "1";
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      lockRef.current = false;
      setIsAnimating(false);
      pendingDirectionRef.current = null;
      if (typeof document !== "undefined") delete document.documentElement.dataset.menuAnim;
    }, ms);
    return true;
  }, [lockMs]);

  const prepareTransition = useCallback((nextDirection, ms) => {
    const ok = lockNavigation(ms);
    if (!ok) return false;
    pendingDirectionRef.current = nextDirection;
    setDirection(nextDirection);
    return true;
  }, [lockNavigation]);

  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  useEffect(() => {
    const key = getLocationKey(location);
    const state = historyRef.current;

    let computed = directionRef.current;
    const shouldLockPop = didInitRef.current && navigationType === "POP";

    if (state.index === -1) {
      state.keys = [key];
      state.index = 0;
      computed = "forward";
    } else if (navigationType === "PUSH") {
      state.keys = state.keys.slice(0, state.index + 1);
      state.keys.push(key);
      state.index += 1;
      computed = "forward";
    } else if (navigationType === "REPLACE") {
      if (state.index >= 0) state.keys[state.index] = key;
      computed = pendingDirectionRef.current || computed;
    } else if (navigationType === "POP") {
      const nextIndex = state.keys.indexOf(key);
      if (nextIndex === -1) {
        state.keys = [key];
        state.index = 0;
        computed = "back";
      } else {
        computed = nextIndex > state.index ? "forward" : "back";
        state.index = nextIndex;
      }
    }

    if (pendingDirectionRef.current) {
      computed = pendingDirectionRef.current;
      pendingDirectionRef.current = null;
    }

    setDirection(computed);
    didInitRef.current = true;
    if (shouldLockPop) lockNavigation();
  }, [location.key, lockNavigation, navigationType]);

  useEffect(() => {
    return () => window.clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    if (isAnimating) document.documentElement.dataset.menuAnim = "1";
    else delete document.documentElement.dataset.menuAnim;
    return () => {
      delete document.documentElement.dataset.menuAnim;
    };
  }, [isAnimating]);

  const value = useMemo(
    () => ({
      direction,
      isAnimating,
      prefersReducedMotion,
      lockMs,
      prepareTransition,
    }),
    [direction, isAnimating, prefersReducedMotion, lockMs, prepareTransition]
  );

  return React.createElement(TransitionDirectionContext.Provider, { value }, children);
}

export function useTransitionDirection() {
  const ctx = useContext(TransitionDirectionContext);
  if (ctx) return ctx;
  return {
    direction: "forward",
    isAnimating: false,
    prefersReducedMotion: false,
    lockMs: 480,
    prepareTransition: () => true,
  };
}
