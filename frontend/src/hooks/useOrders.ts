import { useState, useEffect, useRef } from 'react';

const DEFAULT_DEV_WS_URL = 'ws://localhost:8000/ws/orders/';

function getWebSocketUrl() {
  if (process.env.NEXT_PUBLIC_WEBSOCKET_URL) {
    return process.env.NEXT_PUBLIC_WEBSOCKET_URL;
  }

  if (typeof window === 'undefined') {
    return DEFAULT_DEV_WS_URL;
  }

  const { protocol, hostname, port } = window.location;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isFrontendDevPort = port === '3000';
  const wsProtocol = protocol === 'https:' ? 'wss' : 'ws';

  if (isLocalhost && isFrontendDevPort) {
    return DEFAULT_DEV_WS_URL;
  }

  return `${wsProtocol}://${window.location.host}/ws/orders/`;
}

interface Order {
  id: number;
  order_number: string;
  display_code: string;
  status: string;
  customer: number | null;
  customer_name: string | null;
  total: string;
  created_at: string;
  created_by_email: string;
  item_count: number;
}

interface WebSocketMessage {
  action: string;
  order?: Order;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export function useOrders({ onReconnect }: { onReconnect?: () => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const ws = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const isReconnecting = useRef(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected.');
      return;
    }

    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    try {
      setConnectionStatus('connecting');
      const wsUrl = getWebSocketUrl();
      ws.current = new WebSocket(wsUrl);
      console.log(`Attempting to connect to ${wsUrl}...`);

      ws.current.onopen = () => {
        console.log('WebSocket connected.');
        setConnectionStatus('connected');
        if (isReconnecting.current && onReconnect) {
          console.log('Reconnected. Fetching missed orders...');
          onReconnect();
        }
        reconnectAttempts.current = 0; // Reset reconnect attempts on successful connection
        isReconnecting.current = false;
      };

      ws.current.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);
          console.log('WebSocket message received:', data);
          if (data.action === 'new_order') {
            const newOrder = data.order;
            console.log('New order received:', newOrder);
            setOrders((prevOrders) => {
              // Avoid adding duplicates
              if (prevOrders.find((o) => o.id === newOrder.id)) {
                return prevOrders;
              }
              return [newOrder, ...prevOrders];
            });
          } else if (data.action === 'order_updated') {
            const updatedOrder = data.order;
            console.log('Order updated:', updatedOrder);
            setOrders((prevOrders) => {
              // Update existing order or add it if not present
              const orderIndex = prevOrders.findIndex((o) => o.id === updatedOrder.id);
              if (orderIndex !== -1) {
                // Replace existing order with updated one
                const newOrders = [...prevOrders];
                newOrders[orderIndex] = updatedOrder;
                return newOrders;
              } else {
                // Order not in list, add it
                return [updatedOrder, ...prevOrders];
              }
            });
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.current.onerror = (_error) => {
        // WebSocket connection errors are normal during initial connection attempts
        // Don't set error status immediately, wait for onclose to determine if it's a real issue
        // Logging suppressed as this is expected behavior
      };

      ws.current.onclose = (event) => {
        console.log('WebSocket disconnected.', event.reason || 'No reason provided');

        // Determine if this was an error or normal close
        const wasError = event.code !== 1000 && event.code !== 1001;

        if (wasError) {
          setConnectionStatus('error');
        } else {
          setConnectionStatus('disconnected');
        }

        isReconnecting.current = true; // Set flag before attempting to reconnect

        // Exponential backoff for reconnection
        const timeout = Math.min(30000, 2 ** reconnectAttempts.current * 1000);
        console.log(`Will attempt to reconnect in ${timeout / 1000}s`);

        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttempts.current++;
          setConnectionStatus('connecting');
          connect(); // Attempt to reconnect
        }, timeout);
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('error');
    }
  };

  useEffect(() => {
    connect();

    return () => {
      // Clear reconnect timeout on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (ws.current) {
        ws.current.onclose = null; // Prevent reconnection logic from firing on component unmount
        ws.current.close();
        console.log('WebSocket connection closed.');
      }
    };
  }, []);

  return { orders, connectionStatus };
}
