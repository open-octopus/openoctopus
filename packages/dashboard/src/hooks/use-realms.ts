import { useEffect } from "react";
import { GatewayClient } from "../gateway/client";
import { RPC_METHODS } from "../gateway/types";
import { useGatewayStore } from "../stores/gateway";
import { useRealmsStore } from "../stores/realms";

export function useRealms(clientRef: React.RefObject<GatewayClient | null>) {
  const status = useGatewayStore((s) => s.status);
  const { setRealms, setEntities } = useRealmsStore();

  useEffect(() => {
    if (status !== "connected" || !clientRef.current) {
      return;
    }

    const client = clientRef.current;

    async function fetchData() {
      try {
        const realms = await client.request(RPC_METHODS.REALM_LIST);
        if (Array.isArray(realms)) {
          setRealms(realms);
        }

        const entities = await client.request(RPC_METHODS.ENTITY_LIST);
        if (Array.isArray(entities)) {
          setEntities(entities);
        }
      } catch {
        // Gateway may not support these methods yet
      }
    }

    fetchData();
  }, [status, clientRef, setRealms, setEntities]);
}
