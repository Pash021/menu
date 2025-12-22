import { useMemo } from "react";

export function isLowEndDevice() {
  if (typeof navigator === "undefined") return false;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (connection?.saveData) return true;
  const effectiveType = String(connection?.effectiveType || "");
  if (effectiveType === "slow-2g" || effectiveType === "2g") return true;
  const cores = Number(navigator.hardwareConcurrency || 0);
  const memory = Number(navigator.deviceMemory || 0);
  if (Number.isFinite(memory) && memory > 0 && memory <= 4) return true;
  if (Number.isFinite(cores) && cores > 0 && cores <= 4) return true;
  return false;
}

export function useIsLowEndDevice() {
  return useMemo(() => isLowEndDevice(), []);
}
