import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const SettingsPanelContext = createContext(null);

export function SettingsPanelProvider({ children }) {
  const [preview, setPreviewState] = useState(null);
  const [saveBar, setSaveBarState] = useState(null);
  const [isDirty, setIsDirtyState] = useState(false);

  const setPreview = useCallback((node) => setPreviewState(node || null), []);
  const setSaveBar = useCallback((node) => setSaveBarState(node || null), []);
  const setDirty = useCallback((dirty) => setIsDirtyState(Boolean(dirty)), []);

  const value = useMemo(
    () => ({
      preview,
      saveBar,
      isDirty,
      setPreview,
      setSaveBar,
      setDirty,
    }),
    [preview, saveBar, isDirty, setPreview, setSaveBar, setDirty]
  );

  return <SettingsPanelContext.Provider value={value}>{children}</SettingsPanelContext.Provider>;
}

export function useSettingsPanel() {
  const ctx = useContext(SettingsPanelContext);
  if (!ctx) throw new Error("useSettingsPanel must be used within SettingsPanelProvider");
  return ctx;
}

