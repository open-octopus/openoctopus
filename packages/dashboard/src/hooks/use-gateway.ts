import { useEffect, useRef } from "react";
import { GatewayClient } from "../gateway/client";
import { useGatewayStore } from "../stores/gateway";

export function useGateway() {
  const clientRef = useRef<GatewayClient | null>(null);
  const { url, setStatus, setError } = useGatewayStore();

  useEffect(() => {
    // Read gateway URL from query params or store
    const params = new URLSearchParams(window.location.search);
    const gatewayUrl = params.get("gatewayUrl") ?? url;

    const client = new GatewayClient(gatewayUrl);
    clientRef.current = client;

    client.on("_connected", () => setStatus("connected"));
    client.on("_disconnected", () => setStatus("connecting"));

    setStatus("connecting");
    client.connect();

    return () => {
      client.disconnect();
      setStatus("disconnected");
    };
  }, [url, setStatus, setError]);

  return clientRef;
}
