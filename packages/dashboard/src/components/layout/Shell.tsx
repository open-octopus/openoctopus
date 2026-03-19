import { Outlet } from "react-router";
import { useGateway } from "../../hooks/use-gateway";
import { useRealms } from "../../hooks/use-realms";
import { useRouting } from "../../hooks/use-routing";
import { useGatewayStore } from "../../stores/gateway";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";

export function Shell() {
  const clientRef = useGateway();
  useRealms(clientRef);
  useRouting(clientRef);
  const status = useGatewayStore((s) => s.status);

  return (
    <div className="flex h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {status !== "connected" && (
          <div className="bg-orange-50 border-b border-orange-200 px-4 py-2 text-xs text-orange-700">
            {status === "connecting" ? "正在连接网关..." : "未连接到网关"}
          </div>
        )}
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
}
