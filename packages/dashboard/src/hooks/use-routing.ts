import { useEffect } from "react";
import type { GatewayClient } from "../gateway/client";
import { RPC_EVENTS } from "../gateway/types";
import { useFamilyStore } from "../stores/family";
import { useGatewayStore } from "../stores/gateway";

export function useRouting(clientRef: React.RefObject<GatewayClient | null>) {
  const status = useGatewayStore((s) => s.status);
  const addRouteEvent = useFamilyStore((s) => s.addRouteEvent);

  useEffect(() => {
    if (status !== "connected" || !clientRef.current) {
      return;
    }

    const unsubReaction = clientRef.current.on(RPC_EVENTS.CROSS_REALM_REACTION, (data) => {
      addRouteEvent(data as Parameters<typeof addRouteEvent>[0]);
    });

    return () => {
      unsubReaction();
    };
  }, [status, clientRef, addRouteEvent]);
}
