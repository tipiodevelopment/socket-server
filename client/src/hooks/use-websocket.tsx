import { useState, useEffect, useRef, useCallback } from 'react';
import type { WebSocketEvent, ConnectionStatus } from '@shared/schema';
import { webSocketEventSchema } from '@shared/schema';

interface UseWebSocketOptions {
  campaignId?: number;
  onMessage?: (event: WebSocketEvent) => void;
  onClientCountUpdate?: (count: number) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketEvent | null>(null);
  const [clientCount, setClientCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus('connecting');
    
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsPath = options.campaignId ? `/ws/${options.campaignId}` : '/ws';
    const wsUrl = `${protocol}//${window.location.host}${wsPath}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      console.log('Connected to WebSocket server');
      
      // Clear any existing reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle client count updates separately
        if (data.type === 'client_count') {
          setClientCount(data.data.count);
          options.onClientCountUpdate?.(data.data.count);
          return;
        }
        
        // Validate and handle event messages
        const parseResult = webSocketEventSchema.safeParse(data);
        if (parseResult.success) {
          const validEvent = parseResult.data;
          setLastMessage(validEvent);
          options.onMessage?.(validEvent);
        } else {
          console.warn('Received invalid event message:', parseResult.error);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('disconnected');
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
      console.log('Disconnected from WebSocket server');
      
      // Attempt to reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };
  }, [options]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setConnectionStatus('disconnected');
  }, []);

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    connectionStatus,
    lastMessage,
    clientCount,
    connect,
    disconnect,
    isConnected: connectionStatus === 'connected'
  };
}
