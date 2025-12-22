import React, { useEffect, useMemo } from "react";
import { Routes, useLocation } from "react-router-dom";
import { AnimatePresence, LayoutGroup } from "framer-motion";
import { TransitionDirectionProvider, useTransitionDirection } from "@/hooks/useTransitionDirection";

function Stage({ children, modalRoutes }) {
  const location = useLocation();
  const { direction } = useTransitionDirection();

  const backgroundLocation = location.state?.backgroundLocation;
  const pageLocation = backgroundLocation || location;
  const showModalRoutes = Boolean(backgroundLocation) && Boolean(modalRoutes);

  const pageKey = useMemo(() => `${pageLocation.pathname}${pageLocation.search}`, [pageLocation.pathname, pageLocation.search]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pageLocation.key]);

  return (
    <div
      data-direction={direction}
      style={{
        position: "relative",
        minHeight: "100dvh",
        overflowX: "hidden",
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <Routes location={pageLocation} key={pageKey}>
          {children}
        </Routes>
      </AnimatePresence>

      {showModalRoutes ? (
        <AnimatePresence>
          <Routes location={location} key={`modal:${location.pathname}`}>
            {modalRoutes}
          </Routes>
        </AnimatePresence>
      ) : null}
    </div>
  );
}

export default function PublicMenuAnimatedRoutes({ children, modalRoutes, lockMs = 540 }) {
  return (
    <TransitionDirectionProvider lockMs={lockMs}>
      <LayoutGroup id="public-menu">
        <Stage modalRoutes={modalRoutes}>{children}</Stage>
      </LayoutGroup>
    </TransitionDirectionProvider>
  );
}
