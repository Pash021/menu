import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const UnsavedChangesContext = createContext(null);

export function UnsavedChangesProvider({ children, message = "You have unsaved changes. Leave without saving?" }) {
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const confirmIfDirty = useCallback(() => {
    if (!dirty) return true;
    return window.confirm(message);
  }, [dirty, message]);

  const value = useMemo(() => ({ dirty, setDirty, confirmIfDirty, message }), [dirty, confirmIfDirty, message]);

  return React.createElement(UnsavedChangesContext.Provider, { value }, children);
}

export function useUnsavedChangesContext() {
  return useContext(UnsavedChangesContext);
}

export function useUnsavedChangesGuard(when) {
  const ctx = useUnsavedChangesContext();

  useEffect(() => {
    if (!ctx?.setDirty) return;
    ctx.setDirty(Boolean(when));
  }, [ctx, when]);

  useEffect(() => {
    if (ctx) return undefined;
    if (!when) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [ctx, when]);
}
