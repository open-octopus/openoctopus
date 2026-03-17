import { Outlet } from "react-router";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";

export function Shell() {
  return (
    <div className="flex h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
}
