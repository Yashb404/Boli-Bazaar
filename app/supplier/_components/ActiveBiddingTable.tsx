'use client'
import React from 'react'
import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import type { SupplierBidStatus } from '@/types/auction';
import { toast } from 'sonner';

// TODO: Replace with actual supplier ID from auth once auth is integrated
// PROTOTYPE: Fetch test supplier ID on mount

type SupplierBid = {
  bid: {
    id: number;
    price_per_unit: number;
    notes: string | null;
    created_at: string;
  };
  pooled_order: {
    id: number;
    status: string;
    auction_ends_at: string;
    total_quantity_committed: number;
    final_price_per_unit: number | null;
    product: {
      id: number;
      name: string;
      grade: string | null;
      unit: string;
      description: string | null;
      image_url: string | null;
    };
    areaGroup: {
      id: number;
      area_name: string;
      city: {
        id: number;
        name: string;
      };
    };
  };
  status: SupplierBidStatus;
  is_winning: boolean;
  is_auction_active: boolean;
  current_lowest_bid: number | null;
};

const ActiveBiddingTable = () => {
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [bids, setBids] = useState<SupplierBid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingBids, setCancellingBids] = useState<Set<number>>(new Set());

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

  // Fetch supplier bids from API
  const fetchBids = useCallback(async () => {
    if (!supplierId) return;
    
    try {
      setError(null);
      const response = await fetch(`/api/suppliers/bids?supplier_id=${supplierId}`);
      const data = await response.json();

      if (data.success) {
        setBids(data.data.bids);
      } else {
        setError(data.message || 'Failed to fetch bids');
      }
    } catch (err) {
      setError('Failed to fetch bids');
      console.error('Error fetching bids:', err);
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  // Initial fetch and polling (only when supplierId is available)
  useEffect(() => {
    if (supplierId) {
      fetchBids();
      // Poll every 10 seconds for updates
      const interval = setInterval(fetchBids, 10000);
      return () => clearInterval(interval);
    }
  }, [fetchBids, supplierId]);

  // Handle bid cancellation
  const handleCancelBid = async (bidId: number) => {
    if (!confirm('Are you sure you want to cancel this bid?')) {
      return;
    }

    setCancellingBids(prev => new Set(prev).add(bidId));

    try {
      const response = await fetch(`/api/bids/${bidId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Bid cancelled successfully');
        fetchBids(); // Refresh bids
      } else {
        toast.error(data.message || 'Failed to cancel bid');
      }
    } catch (err) {
      toast.error('Failed to cancel bid');
      console.error('Error cancelling bid:', err);
    } finally {
      setCancellingBids(prev => {
        const newSet = new Set(prev);
        newSet.delete(bidId);
        return newSet;
      });
    }
  };

  const getStatusBadge = (status: SupplierBidStatus) => {
    switch (status) {
      case 'WINNING':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Winning</Badge>;
      case 'AWARDED':
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Awarded</Badge>;
      case 'OUTBID':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Outbid</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Active</Badge>;
    }
  };

  if (loading) {
    return (
      <section>
        <h2 className="text-2xl font-semibold text-gray-800 mb-4 mt-8">
          Active Bids
        </h2>
        <div className="text-center py-8">Loading bids...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <h2 className="text-2xl font-semibold text-gray-800 mb-4 mt-8">
          Active Bids
        </h2>
        <div className="text-center py-8 text-red-600">{error}</div>
      </section>
    );
  }

  // Filter to show only active bids (auction still open or recently closed)
  const activeBids = bids.filter(bid => 
    bid.is_auction_active || 
    bid.status === 'WINNING' || 
    bid.status === 'AWARDED' ||
    (bid.status === 'OUTBID' && bid.is_auction_active)
  );

  return (
    <section>
      <h2 className="text-2xl font-semibold text-gray-800 mb-4 mt-8">
        Active Bids
      </h2>
      {activeBids.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No active bids at the moment.
        </div>
      ) : (
        <Card className="bg-white rounded-xl shadow-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-100">
                <TableHead className="text-gray-600 uppercase text-sm font-medium">Item</TableHead>
                <TableHead className="text-gray-600 uppercase text-sm font-medium">Quantity</TableHead>
                <TableHead className="text-gray-600 uppercase text-sm font-medium">Your Bid</TableHead>
                <TableHead className="text-gray-600 uppercase text-sm font-medium">Current Lowest</TableHead>
                <TableHead className="text-gray-600 uppercase text-sm font-medium">Deadline</TableHead>
                <TableHead className="text-gray-600 uppercase text-sm font-medium">Status</TableHead>
                <TableHead className="text-gray-600 uppercase text-sm font-medium">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeBids.map((item) => {
                const deadline = new Date(item.pooled_order.auction_ends_at);
                const canCancel = item.is_auction_active && !cancellingBids.has(item.bid.id);

                return (
                  <TableRow key={item.bid.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <TableCell className="font-medium">{item.pooled_order.product.name}</TableCell>
                    <TableCell>
                      {item.pooled_order.total_quantity_committed} {item.pooled_order.product.unit}
                    </TableCell>
                    <TableCell>₹{item.bid.price_per_unit.toLocaleString()}</TableCell>
                    <TableCell className="font-medium">
                      {item.current_lowest_bid 
                        ? `₹${item.current_lowest_bid.toLocaleString()}`
                        : 'No bids'}
                    </TableCell>
                    <TableCell>{deadline.toLocaleString()}</TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell>
                      {canCancel && (
                        <Button 
                          className="bg-red-500 text-white px-3 py-1 rounded-md text-xs hover:bg-red-600"
                          onClick={() => handleCancelBid(item.bid.id)}
                          disabled={cancellingBids.has(item.bid.id)}
                        >
                          {cancellingBids.has(item.bid.id) ? 'Cancelling...' : 'Cancel'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </section>
  )
}

export default ActiveBiddingTable