import { useEffect, useState } from 'react';
import { warehouseApi } from '../../../api/axiosConfig';
import type { WarehouseStock } from '../../../types';

export const useWarehouseInventory = () => {
  const [inventory, setInventory] = useState<WarehouseStock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const response = await warehouseApi.get<WarehouseStock[]>('/stock');
        setInventory(response.data);
      } catch (err: any) {
        console.error('Error fetching warehouse inventory:', err);
        setError('Failed to load warehouse data. Please check the connection.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInventory();
  }, []);

  return { inventory, isLoading, error };
};
