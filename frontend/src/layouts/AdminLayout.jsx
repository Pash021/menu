import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/modal";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopbar } from "@/components/admin/AdminTopbar";

export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-muted/20">
      <AdminTopbar onOpenSidebar={() => setMobileOpen(true)} />

      <div className="container grid grid-cols-1 gap-6 py-6 lg:grid-cols-[280px_1fr]">
        <aside className="hidden h-[calc(100vh-5.5rem)] overflow-hidden rounded-xl border bg-card lg:block">
          <AdminSidebar />
        </aside>
        <main className="min-w-0">
          <Outlet />
        </main>
      </div>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent
          className="left-0 top-0 h-dvh w-[calc(100%-3.5rem)] max-w-xs translate-x-0 translate-y-0 rounded-none border-r p-0"
        >
          <div className="h-full bg-card">
            <AdminSidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

