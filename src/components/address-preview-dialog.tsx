"use client";

import React, { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Settings, Employee, NonEmployee } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { isRoomActive, isOwnAddressEntry } from '@/lib/address-filters';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { FilterableHeader } from '@/components/ui/filterable-header';

type AddressOccupancy = {
  locality: string;
  address: string;
  roomName: string;
  capacity: number;
  occupied: number;
  available: number;
  isActive: boolean;
};

interface AddressPreviewDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  settings: Settings;
  allEmployees: Employee[] | null;
  allNonEmployees: NonEmployee[] | null;
  coordinatorId?: string;
  onApplySelection?: (locality: string, address: string, roomNumber: string) => void;
}

export function AddressPreviewDialog({
  isOpen,
  onOpenChange,
  settings,
  allEmployees,
  allNonEmployees,
  coordinatorId,
  onApplySelection,
}: AddressPreviewDialogProps) {

  const [selectedLocality, setSelectedLocality] = useState<string>('');
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [expandedAddress, setExpandedAddress] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{key: keyof AddressOccupancy | null, direction: 'asc' | 'desc'}>({ key: null, direction: 'asc' });

  const ALL_LOCALITIES = '__all__';

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key: key as keyof AddressOccupancy,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const addressOccupancy = useMemo<AddressOccupancy[]>(() => {
    if (!allEmployees || !allNonEmployees) return [];

    const activeResidents = [
      ...allEmployees.filter(e => e.status === 'active'),
      ...allNonEmployees.filter(ne => ne.status === 'active'),
    ];

    const occupancyMap = new Map<string, number>();
    activeResidents.forEach(resident => {
      if (resident.address && resident.roomNumber) {
        const key = `${resident.address}|${resident.roomNumber}`;
        occupancyMap.set(key, (occupancyMap.get(key) || 0) + 1);
      }
    });

    const result: AddressOccupancy[] = [];

    const filteredAddresses = coordinatorId
      ? settings.addresses.filter(addr => addr.coordinatorIds.includes(coordinatorId))
      : settings.addresses;

    filteredAddresses.forEach(address => {
      // Skip addresses that are "Własne mieszkanie ..."
      if (isOwnAddressEntry(address.name)) return;

      // Skip blocked/inactive addresses entirely
      if (!address.isActive) return;

      address.rooms.forEach(room => {
        // Check if room is active using the centralized filter logic
        const roomActive = isRoomActive(room, address);

        // Skip blocked/inactive rooms entirely
        if (!roomActive) return;

        const key = `${address.name}|${room.name}`;
        const occupied = occupancyMap.get(key) || 0;
        const available = Math.max(0, room.capacity - occupied);


        result.push({
          locality: address.locality,
          address: address.name,
          roomName: room.name,
          capacity: room.capacity,
          occupied,
          available,
          isActive: roomActive,
        });
      });
    });

    return result.sort((a, b) => {
      if (a.locality !== b.locality) return a.locality.localeCompare(b.locality);
      if (a.address !== b.address) return a.address.localeCompare(b.address);
      return a.roomName.localeCompare(b.roomName);
    });
  }, [settings, allEmployees, allNonEmployees, coordinatorId]);

  // Get unique localities
  const localities = useMemo(() => {
    const localitySet = new Set(addressOccupancy.map(item => item.locality));
    return Array.from(localitySet).sort();
  }, [addressOccupancy]);

  // Get addresses for selected locality
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const availableAddresses = useMemo(() => {
    if (!selectedLocality || selectedLocality === ALL_LOCALITIES) return [];
    const addressSet = new Set(
      addressOccupancy
        .filter(item => item.locality === selectedLocality && item.isActive)
        .map(item => item.address)
    );
    return Array.from(addressSet).sort();
  }, [addressOccupancy, selectedLocality, ALL_LOCALITIES]);

  // Address-level summary for selected locality (to show address blocks)
  const selectedLocalityAddresses = useMemo(() => {
    if (!selectedLocality || selectedLocality === ALL_LOCALITIES) return [];
    const addressMap = new Map<string, { total: number; occupied: number; available: number }>();
    addressOccupancy
      .filter(item => item.locality === selectedLocality && item.isActive)
      .forEach(item => {
        const current = addressMap.get(item.address) || { total: 0, occupied: 0, available: 0 };
        addressMap.set(item.address, {
          total: current.total + item.capacity,
          occupied: current.occupied + item.occupied,
          available: current.available + Math.max(0, item.capacity - item.occupied),
        });
      });
    return Array.from(addressMap.entries())
      .map(([address, data]) => ({ address, ...data }))
      .sort((a, b) => a.address.localeCompare(b.address));
  }, [addressOccupancy, selectedLocality, ALL_LOCALITIES]);

  // Get rooms for selected address
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const availableRooms = useMemo(() => {
    if (!selectedAddress || selectedLocality === ALL_LOCALITIES) return [];
    return addressOccupancy
      .filter(item =>
        item.locality === selectedLocality &&
        item.address === selectedAddress &&
        item.isActive
      )
      .sort((a, b) => a.roomName.localeCompare(b.roomName));
  }, [addressOccupancy, selectedLocality, selectedAddress, ALL_LOCALITIES]);

  // Get occupancy info for selected items
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const selectedRoomInfo = useMemo(() => {
    if (!selectedRoom) return null;
    return addressOccupancy.find(item =>
      item.locality === selectedLocality &&
      item.address === selectedAddress &&
      item.roomName === selectedRoom
    );
  }, [addressOccupancy, selectedLocality, selectedAddress, selectedRoom]);

  // Group by locality for table view
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const groupedByLocality = useMemo(() => {
    const groups = new Map<string, AddressOccupancy[]>();
    addressOccupancy.forEach(item => {
      const items = groups.get(item.locality) || [];
      items.push(item);
      groups.set(item.locality, items);
    });
    
    // Sort items within each locality
    const entries = Array.from(groups.entries()).map(([loc, items]) => {
       const sortedItems = [...items];
       if (sortConfig.key) {
         sortedItems.sort((a, b) => {
           let valA = a[sortConfig.key as keyof AddressOccupancy];
           let valB = b[sortConfig.key as keyof AddressOccupancy];
           
           if (sortConfig.key === 'isActive') {
              valA = a.isActive ? 1 : 0;
              valB = b.isActive ? 1 : 0;
           }
           
           if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
           if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
           return 0;
         });
       }
       return [loc, sortedItems] as [string, AddressOccupancy[]];
    });

    return entries.sort((a, b) => a[0].localeCompare(b[0]));
  }, [addressOccupancy, sortConfig]);

  const localitySummary = useMemo(() => {
    const summary = new Map<string, { total: number; occupied: number; available: number }>();

    // Only include active (non-blocked) rooms in the summary
    addressOccupancy.forEach(item => {
      if (!item.isActive) return;

      const current = summary.get(item.locality) || { total: 0, occupied: 0, available: 0 };

      // Calculate true available for this specific item (never negative)
      const trueAvailable = Math.max(0, item.capacity - item.occupied);

      summary.set(item.locality, {
        total: current.total + item.capacity,
        occupied: current.occupied + item.occupied,
        available: current.available + trueAvailable,
      });
    });

    return Array.from(summary.entries()).map(([locality, data]) => ({
      locality,
      ...data,
    })).sort((a, b) => a.locality.localeCompare(b.locality));
  }, [addressOccupancy]);

  const getAvailabilityBadge = (available: number, _capacity: number) => {
    if (available === 0) {
      return <Badge variant="destructive">Pełny</Badge>;
    }
    return <Badge className="bg-green-500 hover:bg-green-600">Wolne</Badge>;
  };

  const handleApply = () => {
    if (selectedLocality && selectedLocality !== ALL_LOCALITIES && selectedAddress && selectedRoom && onApplySelection) {
      onApplySelection(selectedLocality, selectedAddress, selectedRoom);
      onOpenChange(false);
      // Reset selections
      setSelectedLocality('');
      setSelectedAddress('');
      setSelectedRoom('');
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset selections on close
    setSelectedLocality('');
    setSelectedAddress('');
    setSelectedRoom('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-[96vw] sm:max-w-3xl lg:max-w-5xl max-h-[92vh] p-3 sm:p-6 gap-3 sm:gap-4">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Podgląd i wybór dostępności miejsc</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Wybierz miejscowość, aby zobaczyć dostępność adresów
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[52vh] sm:h-[60vh] lg:h-[70vh]">
          <div className="pr-3 space-y-4 sm:space-y-6">
            {/* Interactive Selection Section */}
            <div className="p-3 sm:p-4 border rounded-lg bg-muted/50">
              <h3 className="text-sm font-semibold mb-3 sm:mb-4">Wybierz zakwaterowanie</h3>
              <div className="space-y-2 max-w-xs">
                <Label htmlFor="locality-select">Miejscowość</Label>
                <Select value={selectedLocality} onValueChange={(value) => {
                  setSelectedLocality(value);
                  setSelectedAddress('');
                  setSelectedRoom('');
                  setExpandedAddress(null);
                }}>
                  <SelectTrigger id="locality-select">
                    <SelectValue placeholder="Wybierz miejscowość" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_LOCALITIES}>Wszystkie miejscowości</SelectItem>
                    {localities.map(locality => (
                      <SelectItem key={locality} value={locality}>
                        {locality}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Summary Cards — gdy wybrane "Wszystkie" lub nic */}
            {(!selectedLocality || selectedLocality === ALL_LOCALITIES) && localitySummary.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Podsumowanie według miejscowości</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                  {localitySummary.map((summary) => (
                    <Card key={summary.locality}>
                      <CardHeader className="p-3 sm:pb-3">
                        <CardTitle className="text-sm font-medium">{summary.locality}</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                        <div className="space-y-1 text-xs sm:text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Całkowita pojemność:</span>
                            <span className="font-medium">{summary.total}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Zajęte:</span>
                            <span className="font-medium text-orange-600">{summary.occupied}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Dostępne:</span>
                            <span className="font-medium text-green-600">{summary.available}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Address blocks — gdy wybrana konkretna miejscowość */}
            {selectedLocalityAddresses.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3">
                  Adresy w miejscowości: <span className="text-primary">{selectedLocality}</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                  {selectedLocalityAddresses.map((addr) => {
                    const isExpanded = expandedAddress === addr.address;
                    return (
                      <Card
                        key={addr.address}
                        className={cn('cursor-pointer transition-all hover:shadow-md', addr.available === 0 && 'opacity-60', isExpanded && 'ring-2 ring-primary')}
                        onClick={() => setExpandedAddress(isExpanded ? null : addr.address)}
                      >
                        <CardHeader className="p-3 pb-2">
                          <CardTitle className="text-xs font-medium leading-tight">{addr.address}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 pt-0">
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Całkowita pojemność:</span>
                              <span className="font-medium">{addr.total}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Zajęte:</span>
                              <span className="font-medium text-orange-600">{addr.occupied}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Dostępne:</span>
                              <span className="font-medium text-green-600">{addr.available}</span>
                            </div>
                          </div>
                          <div className="mt-2">
                            {getAvailabilityBadge(addr.available, addr.total)}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Panel pokojów — pełna szerokość pod kartami */}
                {expandedAddress && (() => {
                  const rooms = addressOccupancy
                    .filter(item => item.locality === selectedLocality && item.address === expandedAddress && item.isActive)
                    .sort((a, b) => b.available - a.available || a.roomName.localeCompare(b.roomName));
                  return (
                    <div className="mt-3 border rounded-lg overflow-hidden">
                      <div className="bg-muted/50 px-4 py-2 text-sm font-semibold">
                        Pokoje — {expandedAddress}
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/30 border-b">
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Pokój</th>
                            <th className="text-center px-4 py-2 font-medium text-muted-foreground">Pojemność</th>
                            <th className="text-center px-4 py-2 font-medium text-orange-600">Zajęte</th>
                            <th className="text-center px-4 py-2 font-medium text-green-600">Wolne</th>
                            <th className="text-center px-4 py-2 font-medium text-muted-foreground">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {rooms.map((room) => (
                            <tr key={room.roomName}>
                              <td className="px-4 py-2 font-medium">Pokój {room.roomName}</td>
                              <td className="px-4 py-2 text-center">{room.capacity}</td>
                              <td className="px-4 py-2 text-center font-medium text-orange-600">{room.occupied}</td>
                              <td className="px-4 py-2 text-center font-medium text-green-600">{room.available}</td>
                              <td className="px-4 py-2 text-center">
                                <div className="flex justify-center">
                                  {getAvailabilityBadge(room.available, room.capacity)}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            )}

            {addressOccupancy.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Brak danych o adresach
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button
            variant="outline"
            onClick={handleClose}
            className="w-full sm:w-auto min-h-[44px] order-2 sm:order-1"
          >
            Anuluj
          </Button>
          {onApplySelection && (
            <Button
              onClick={handleApply}
              disabled={!selectedLocality || selectedLocality === ALL_LOCALITIES || !selectedAddress || !selectedRoom}
              className="w-full sm:w-auto min-h-[44px] order-1 sm:order-2"
            >
              Zastosuj wybór
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
