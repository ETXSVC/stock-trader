import { useEffect, useRef, useState } from "react";

type WsMessage = { event: string; data: any };

export function useWebSocket(onMessage?: (msg: WsMessage) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
      ws = new WebSocket("ws://localhost:8000/ws");
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        reconnectTimeout = setTimeout(connect, 3000);
      };
      ws.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data);
          onMessageRef.current?.(msg);
        } catch {}
      };
      wsRef.current = ws;
    };

    connect();
    return () => {
      clearTimeout(reconnectTimeout);
      ws?.close();
    };
  }, []);

  return { connected };
}
