"use client";

import { useState } from "react";
import AdminSidebar from "./AdminSidebar";
import AdminTopbar from "./AdminTopbar";
import AdminBottomNav from "./AdminBottomNav";
import { TopbarActionProvider } from "./TopbarActionContext";

interface Props {
  children: React.ReactNode
  role: string
  permissions: string[]
}

export default function AdminShell({ children, role, permissions }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <TopbarActionProvider>
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} role={role} permissions={permissions} />

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminTopbar onMenuClick={() => setSidebarOpen(true)} role={role} />
        <main className="flex-1 overflow-y-auto p-4 md:p-7 pb-bottom-nav md:pb-7 scroll-smooth-mobile">
          {children}
        </main>
      </div>

      <AdminBottomNav />
    </div>
    </TopbarActionProvider>
  );
}
