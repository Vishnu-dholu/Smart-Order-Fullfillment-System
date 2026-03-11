import { useEffect, useState } from 'react';
import { orderApi } from '../../../api/axiosConfig';
import type { OrderItemResponse } from '../../../types';

export const useOrders = () => {
  const [orders, setOrders] = useState<OrderItemResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        // Java OrderController has a GET /orders endpoint that filters by the X-User-Id header automatically!
        const response = await orderApi.get<OrderItemResponse[]>('/orders');
        setOrders(response.data);
      } catch (err: any) {
        console.error('Error fetching orders:', err);
        if (err.response?.status === 404) {
          setOrders([]);
        } else {
          setError('Failed to load your order history.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, []);

  return { orders, isLoading, error };
};
