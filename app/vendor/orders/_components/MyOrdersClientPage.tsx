'use client';

import { useMemo, useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { VendorOrderItem } from "@/types/auction";

// TODO: Replace with actual vendor ID from auth once auth is integrated
// PROTOTYPE: Fetch test vendor ID on mount

// Helper to determine the display status and color for an order item
const getDisplayStatus = (order: VendorOrderItem) => {
  if (order.pooledOrder.status === 'CANCELLED' || order.status === 'CANCELLED') {
    return { text: 'Cancelled', style: 'bg-red-100 text-red-800' };
  }
  if (order.status === 'DELIVERED') {
    return { text: 'Delivered', style: 'bg-purple-100 text-purple-800' };
  }
  if (order.pooledOrder.status === 'AWARDED' || order.pooledOrder.status === 'COMPLETED') {
    return { text: 'Won', style: 'bg-green-100 text-green-800' };
  }
  return { text: 'Pooling', style: 'bg-blue-100 text-blue-800' };
};

export function MyOrdersClientPage({ initialOrders }: { initialOrders: VendorOrderItem[] }) {
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [orders, setOrders] = useState<VendorOrderItem[]>(initialOrders);
  const [loading, setLoading] = useState(initialOrders.length === 0);
  const [error, setError] = useState<string | null>(null);

  // Fetch prototype vendor ID on mount
  useEffect(() => {
    fetch('/api/prototype/user-id?role=vendor')
      .then(res => res.json())
      .then(data => {
        if (data.user_id) {
          setVendorId(data.user_id);
        }
      })
      .catch(err => {
        console.error('Failed to get vendor ID:', err);
        setError('Failed to initialize');
      });
  }, []);

  // Fetch orders from API
  const fetchOrders = useCallback(async () => {
    if (!vendorId) return;
    
    try {
      setError(null);
      const response = await fetch(`/api/vendors/orders?vendor_id=${vendorId}`);
      const data = await response.json();

      if (data.success) {
        setOrders(data.data.orders);
      } else {
        setError(data.message || 'Failed to fetch orders');
      }
    } catch (err) {
      setError('Failed to fetch orders');
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  // Fetch orders on mount if initialOrders is empty
  useEffect(() => {
    if (initialOrders.length === 0) {
      fetchOrders();
    }
    // Poll every 30 seconds for updates
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders, initialOrders.length]);

  const { activeOrders, orderHistory } = useMemo(() => {
    const active = orders.filter(o => {
      const status = getDisplayStatus(o);
      return status.text === 'Pooling' || status.text === 'Won';
    });
    const history = orders.filter(o => {
      const status = getDisplayStatus(o);
      return status.text === 'Delivered' || status.text === 'Cancelled';
    });
    return { activeOrders: active, orderHistory: history };
  }, [orders]);

  if (loading) {
    return (
      <>
        <h1 className="text-3xl font-bold tracking-tight mb-6">My Orders</h1>
        <div className="text-center py-8">Loading orders...</div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <h1 className="text-3xl font-bold tracking-tight mb-6">My Orders</h1>
        <div className="text-center py-8 text-red-600">{error}</div>
      </>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight mb-6">My Orders</h1>
      <Tabs defaultValue="active">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="active">Active Orders ({activeOrders.length})</TabsTrigger>
          <TabsTrigger value="history">Order History ({orderHistory.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          {activeOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No active orders at the moment.
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>My Qty</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Final Price</TableHead>
                      <TableHead>My Total Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeOrders.map((order) => {
                      const status = getDisplayStatus(order);
                      const finalPrice = order.pooledOrder.final_price_per_unit;
                      const totalCost = finalPrice ? (finalPrice * Number(order.quantity_committed)).toFixed(2) : 'TBD';
                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.pooledOrder.product.name}</TableCell>
                          <TableCell>{String(order.quantity_committed)}{order.pooledOrder.product.unit}</TableCell>
                          <TableCell><Badge className={cn("font-medium", status.style)}>{status.text}</Badge></TableCell>
                          <TableCell>{finalPrice ? `₹${finalPrice}/${order.pooledOrder.product.unit}` : 'Bidding...'}</TableCell>
                          <TableCell className="font-medium">{finalPrice ? `₹${totalCost}` : 'TBD'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          {orderHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No order history.
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>My Qty</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Final Price</TableHead>
                      <TableHead>My Total Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderHistory.map((order) => {
                      const status = getDisplayStatus(order);
                      const finalPrice = order.pooledOrder.final_price_per_unit;
                      const totalCost = finalPrice ? (finalPrice * Number(order.quantity_committed)).toFixed(2) : 'N/A';
                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.pooledOrder.product.name}</TableCell>
                          <TableCell>{String(order.quantity_committed)}{order.pooledOrder.product.unit}</TableCell>
                          <TableCell><Badge className={cn("font-medium", status.style)}>{status.text}</Badge></TableCell>
                          <TableCell>{finalPrice ? `₹${finalPrice}/${order.pooledOrder.product.unit}` : 'N/A'}</TableCell>
                          <TableCell className="font-medium">{finalPrice ? `₹${totalCost}` : 'N/A'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}