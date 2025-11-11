'use client'
import React from 'react'
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {Label} from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {Input} from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { PooledOrderWithDetails } from '@/types/auction';
import { toast } from 'sonner';

// TODO: Replace with actual supplier ID from auth once auth is integrated
// PROTOTYPE: Fetch test supplier ID on mount
export default function OrderForBidding(){
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [areaFilter, setAreaFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [orders, setOrders] = useState<PooledOrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [biddingOrders, setBiddingOrders] = useState<Record<number, { price: string; loading: boolean }>>({});

  // Fetch prototype supplier ID on mount
  useEffect(() => {
    fetch('/api/prototype/user-id?role=supplier')
      .then(res => res.json())
      .then(data => {
        if (data.user_id) {
          setSupplierId(data.user_id);
        }
      })
      .catch(err => {
        console.error('Failed to get supplier ID:', err);
        setError('Failed to initialize');
      });
  }, []);

  // Fetch orders from API
  const fetchOrders = useCallback(async () => {
    try {
      setError(null);
      const params = new URLSearchParams({ status: 'AUCTION_OPEN' });
      if (areaFilter !== 'All' && !isNaN(parseInt(areaFilter))) {
        params.append('area_group_id', areaFilter);
      }

      const response = await fetch(`/api/pooled-orders?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setOrders(data.data.pooled_orders);
      } else {
        setError(data.message || 'Failed to fetch orders');
      }
    } catch (err) {
      setError('Failed to fetch orders');
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  }, [areaFilter]);

  // Initial fetch and polling
  useEffect(() => {
    fetchOrders();
    // Poll every 10 seconds for updates
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Handle bid submission
  const handleBid = async (orderId: number) => {
    const bidData = biddingOrders[orderId];
    if (!supplierId) {
      toast.error('Supplier ID not loaded yet');
      return;
    }

    if (!bidData || !bidData.price) {
      toast.error('Please enter a bid amount');
      return;
    }

    const price = parseFloat(bidData.price);
    if (isNaN(price) || price <= 0) {
      toast.error('Please enter a valid bid amount');
      return;
    }

    // Update loading state for this order
    setBiddingOrders(prev => ({
      ...prev,
      [orderId]: { ...prev[orderId], loading: true }
    }));

    try {
      const response = await fetch('/api/bids', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pooled_order_id: orderId,
          supplier_id: supplierId,
          price_per_unit: price,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Bid submitted successfully!');
        // Clear bid input
        setBiddingOrders(prev => ({
          ...prev,
          [orderId]: { price: '', loading: false }
        }));
        // Refresh orders to show updated lowest bid
        fetchOrders();
      } else {
        toast.error(data.message || 'Failed to submit bid');
      }
    } catch (err) {
      toast.error('Failed to submit bid');
      console.error('Error submitting bid:', err);
    } finally {
      setBiddingOrders(prev => ({
        ...prev,
        [orderId]: { ...prev[orderId], loading: false }
      }));
    }
  };

  // Get current lowest bid for an order
  const getCurrentLowestBid = (order: PooledOrderWithDetails): number | null => {
    if (order.bids.length === 0) return null;
    return order.bids[0].price_per_unit; // Bids are sorted by price (asc)
  };

  // Get minimum next bid (current lowest - 50)
  const getMinNextBid = (order: PooledOrderWithDetails): number => {
    const currentLowest = getCurrentLowestBid(order);
    if (!currentLowest) return 0;
    return Math.max(0, currentLowest - 50);
  };

  // Filter orders by category (if we had category data, for now just show all)
  const filteredOrders = orders.filter(order => {
    // TODO: Add category filtering when product categories are available
    return true;
  });

  // Get unique area groups for filter (with IDs)
  const areaGroupsMap = new Map<number, string>();
  orders.forEach(order => {
    if (!areaGroupsMap.has(order.areaGroup.id)) {
      areaGroupsMap.set(order.areaGroup.id, order.areaGroup.area_name);
    }
  });
  const areaGroups = Array.from(areaGroupsMap.entries()).map(([id, name]) => ({ id, name }));

  if (loading) {
    return (
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4 mt-8">
          Available Orders for Bidding
        </h2>
        <div className="text-center py-8">Loading orders...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4 mt-8">
          Available Orders for Bidding
        </h2>
        <div className="text-center py-8 text-red-600">{error}</div>
      </section>
    );
  }


  return (
    <section className="mb-8">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4 mt-8">
        Available Orders for Bidding
      </h2>
      
      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div>
          <Label htmlFor="areaFilter">Area</Label>
          <Select value={areaFilter} onValueChange={setAreaFilter}>
            <SelectTrigger className="w-40 mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Areas</SelectItem>
              {areaGroups.map(area => (
                <SelectItem key={area.id} value={area.id.toString()}>{area.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* TODO: Add category filter when product categories are available */}
      </div>

      {/* Order Cards */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No open auctions available at the moment.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {filteredOrders.map((order) => {
            const currentLowest = getCurrentLowestBid(order);
            const minNextBid = getMinNextBid(order);
            const bidInput = biddingOrders[order.id] || { price: '', loading: false };
            const deadline = new Date(order.auction_ends_at);
            const isExpired = deadline < new Date();

            return (
              <Card key={order.id} className="bg-gray-50 p-5 rounded-xl shadow-md border border-gray-200">
                <CardContent className="p-0">
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">
                    {order.product.name}
                  </h3>
                  <div className="space-y-1 mb-3">
                    <div className="text-gray-600 text-sm">
                      Area: <span className="font-medium">{order.areaGroup.area_name}</span>
                    </div>
                    <div className="text-gray-600 text-sm">
                      City: <span className="font-medium">{order.areaGroup.city.name}</span>
                    </div>
                    <div className="text-gray-600 text-sm">
                      Quantity: <span className="font-medium">{order.total_quantity_committed} {order.product.unit}</span>
                    </div>
                    <div className="text-gray-600 text-sm">
                      Bids: <span className="font-medium">{order.bids.length}</span>
                    </div>
                  </div>
                  
                  <div className="text-gray-700 font-bold text-lg mb-3">
                    {currentLowest ? (
                      <>Current Lowest: ₹{currentLowest.toLocaleString()}</>
                    ) : (
                      <>No bids yet</>
                    )}
                  </div>
                  
                  <div className="text-gray-600 text-xs mb-3">
                    Deadline: {deadline.toLocaleString()}
                  </div>

                  {isExpired ? (
                    <div className="text-red-600 text-sm font-medium mb-3">
                      Auction Closed
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder={currentLowest ? `Min ₹${minNextBid.toLocaleString()}` : 'Enter bid amount'}
                        className="grow text-sm"
                        value={bidInput.price}
                        onChange={(e) => setBiddingOrders(prev => ({
                          ...prev,
                          [order.id]: { ...prev[order.id], price: e.target.value }
                        }))}
                        disabled={bidInput.loading}
                        min={minNextBid}
                        step="0.01"
                      />
                      <Button 
                        className="bg-accent hover:bg-accent/90 text-accent-foreground px-4 py-2 text-sm shadow-md"
                        onClick={() => handleBid(order.id)}
                        disabled={bidInput.loading}
                      >
                        {bidInput.loading ? 'Bidding...' : 'Bid'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  )
}