import React, { useEffect } from "react";
import { Outlet } from "react-router-dom";

export default function PublicLayout() {
  useEffect(() => {
    // Defensive: ensure no stale scroll-lock styles remain (e.g. after an interrupted modal unmount).
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.width = "";
  }, []);

  return (
    <div className="min-h-screen bg-background paper-bg pb-safe">
      <Outlet />
    </div>
  );
}
