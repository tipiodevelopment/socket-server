import { useState, useEffect, useRef, useCallback } from 'react';
import type { WebSocketEvent, ConnectionStatus } from '@shared/schema';
import { webSocketEventSchema } from '@shared/schema';

interface UseWebSocketOptions {
  campaignId?: number;
  onMessage?: (event: WebSocketEvent) => void;
  maxRetries?: number;
  baseDelay?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { 
    campaignId, 
    onMessage, 
    maxRetries = 5, 
    baseDelay = 2000 
  } = options;
  
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const retryCountRef = useRef(0);
  const isUnmountedRef = useRef(false);

  const connect = useCallback(() => {
    // Don't connect if component is unmounted
    if (isUnmountedRef.current) {
      return;
    }

    // Don't create new connection if already connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Stop retrying if max retries reached
    if (retryCountRef.current >= maxRetries) {
      console.warn(`WebSocket max retries (${maxRetries}) reached. Stopped reconnecting.`);
      setConnectionStatus('disconnected');
      return;
    }

    setConnectionStatus('connecting');
    
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsPath = campaignId ? `/ws/${campaignId}` : '/ws';
    const wsUrl = `${protocol}//${window.location.host}${wsPath}`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmountedRef.current) {
          ws.close();
          return;
        }
        
        setConnectionStatus('connected');
        console.log(`WebSocket connected to campaign ${campaignId || 'global'}`);
        
        // Reset retry count on successful connection
        retryCountRef.current = 0;
        
        // Clear any existing reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
      };

      ws.onmessage = (event) => {
        if (isUnmountedRef.current) {
          return;
        }
        
        try {
          const data = JSON.parse(event.data);
          
          // Validate and handle event messages
          const parseResult = webSocketEventSchema.safeParse(data);
          if (parseResult.success) {
            const validEvent = parseResult.data;
            setLastMessage(validEvent);
            onMessage?.(validEvent);
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

      ws.onclose = (event) => {
        // Don't reconnect if component is unmounted
        if (isUnmountedRef.current) {
          return;
        }
        
        setConnectionStatus('disconnected');
        console.log(`WebSocket disconnected from campaign ${campaignId || 'global'}. Code: ${event.code}`);
        
        // Increment retry count
        retryCountRef.current += 1;
        
        // Calculate exponential backoff delay
        const delay = Math.min(baseDelay * Math.pow(2, retryCountRef.current - 1), 30000);
        
        if (retryCountRef.current <= maxRetries) {
          console.log(`Reconnecting in ${delay}ms (attempt ${retryCountRef.current}/${maxRetries})`);
          
          // Attempt to reconnect with exponential backoff
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setConnectionStatus('disconnected');
    }
  }, [campaignId, onMessage, maxRetries, baseDelay]);

  const disconnect = useCallback(() => {
    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    // Close WebSocket connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setConnectionStatus('disconnected');
  }, []);

  useEffect(() => {
    // Mark as mounted
    isUnmountedRef.current = false;
    
    // Connect on mount
    connect();
    
    return () => {
      // Mark as unmounted
      isUnmountedRef.current = true;
      
      // Clean up on unmount
      disconnect();
    };
  }, [campaignId]); // Only reconnect when campaignId changes

  return {
    connectionStatus,
    lastMessage,
    connect,
    disconnect,
    isConnected: connectionStatus === 'connected',
    retryCount: retryCountRef.current
  };
}
