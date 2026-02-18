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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Settings, Employee, NonEmployee } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { isRoomActive } from '@/lib/address-filters';

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

  const isOwnAddressEntry = (addressName: string) => {
    const words = addressName.trim().split(/\s+/);
    return words.length >= 2 && words[0].toLowerCase() === 'własne' && words[1].toLowerCase() === 'mieszkanie';
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

      address.rooms.forEach(room => {
        const key = `${address.name}|${room.name}`;
        const occupied = occupancyMap.get(key) || 0;
        const available = Math.max(0, room.capacity - occupied);

        // Check if room is active using the centralized filter logic
        const roomActive = isRoomActive(room, address);

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
  const availableAddresses = useMemo(() => {
    if (!selectedLocality) return [];
    const addressSet = new Set(
      addressOccupancy
        .filter(item => item.locality === selectedLocality && item.isActive)
        .map(item => item.address)
    );
    return Array.from(addressSet).sort();
  }, [addressOccupancy, selectedLocality]);

  // Get rooms for selected address
  const availableRooms = useMemo(() => {
    if (!selectedAddress) return [];
    return addressOccupancy
      .filter(item =>
        item.locality === selectedLocality &&
        item.address === selectedAddress &&
        item.isActive
      )
      .sort((a, b) => a.roomName.localeCompare(b.roomName));
  }, [addressOccupancy, selectedLocality, selectedAddress]);

  // Get occupancy info for selected items
  const selectedRoomInfo = useMemo(() => {
    if (!selectedRoom) return null;
    return addressOccupancy.find(item =>
      item.locality === selectedLocality &&
      item.address === selectedAddress &&
      item.roomName === selectedRoom
    );
  }, [addressOccupancy, selectedLocality, selectedAddress, selectedRoom]);

  // Group by locality for table view
  const groupedByLocality = useMemo(() => {
    const groups = new Map<string, AddressOccupancy[]>();
    addressOccupancy.forEach(item => {
      const items = groups.get(item.locality) || [];
      items.push(item);
      groups.set(item.locality, items);
    });
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [addressOccupancy]);

  const localitySummary = useMemo(() => {
    const summary = new Map<string, { total: number; occupied: number; available: number }>();

    // Only include active (non-blocked) rooms in the summary
    addressOccupancy.forEach(item => {
      if (!item.isActive) return;

      const current = summary.get(item.locality) || { total: 0, occupied: 0, available: 0 };
      summary.set(item.locality, {
        total: current.total + item.capacity,
        occupied: current.occupied + item.occupied,
        available: current.available + item.available,
      });
    });

    return Array.from(summary.entries()).map(([locality, data]) => ({
      locality,
      ...data,
    })).sort((a, b) => a.locality.localeCompare(b.locality));
  }, [addressOccupancy]);

  const getAvailabilityBadge = (available: number, capacity: number) => {
    const percentage = capacity > 0 ? (available / capacity) * 100 : 0;

    if (percentage === 0) {
      return <Badge variant="destructive">Pełny</Badge>;
    } else if (percentage <= 25) {
      return <Badge variant="destructive">Mało miejsc</Badge>;
    } else if (percentage <= 50) {
      return <Badge className="bg-orange-500 hover:bg-orange-600">Średnio</Badge>;
    } else {
      return <Badge className="bg-green-500 hover:bg-green-600">Dostępne</Badge>;
    }
  };

  const handleApply = () => {
    if (selectedLocality && selectedAddress && selectedRoom && onApplySelection) {
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
            Wybierz miejscowość, adres i pokój, aby zastosować w formularzu
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[52vh] sm:h-[60vh] lg:h-[70vh]">
          <div className="pr-3 space-y-4 sm:space-y-6">
            {/* Interactive Selection Section */}
            <div className="p-3 sm:p-4 border rounded-lg bg-muted/50">
              <h3 className="text-sm font-semibold mb-3 sm:mb-4">Wybierz zakwaterowanie</h3>
              <div className="flex flex-col gap-3 sm:grid sm:grid-cols-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="locality-select">Miejscowość</Label>
                  <Select value={selectedLocality} onValueChange={(value) => {
                    setSelectedLocality(value);
                    setSelectedAddress('');
                    setSelectedRoom('');
                  }}>
                    <SelectTrigger id="locality-select">
                      <SelectValue placeholder="Wybierz miejscowość" />
                    </SelectTrigger>
                    <SelectContent>
                      {localities.map(locality => (
                        <SelectItem key={locality} value={locality}>
                          {locality}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address-select">Adres</Label>
                  <Select
                    value={selectedAddress}
                    onValueChange={(value) => {
                      setSelectedAddress(value);
                      setSelectedRoom('');
                    }}
                    disabled={!selectedLocality}
                  >
                    <SelectTrigger id="address-select">
                      <SelectValue placeholder={!selectedLocality ? "Najpierw wybierz miejscowość" : "Wybierz adres"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableAddresses.map(address => (
                        <SelectItem key={address} value={address}>
                          {address}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="room-select">Pokój</Label>
                  <Select
                    value={selectedRoom}
                    onValueChange={setSelectedRoom}
                    disabled={!selectedAddress}
                  >
                    <SelectTrigger id="room-select">
                      <SelectValue placeholder={!selectedAddress ? "Najpierw wybierz adres" : "Wybierz pokój"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRooms.map(room => (
                        <SelectItem
                          key={room.roomName}
                          value={room.roomName}
                          disabled={room.available === 0 || !room.isActive}
                        >
                          {room.roomName} - {room.isActive ? `Dostępne: ${room.available}/${room.capacity}` : '(Zablokowany)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedRoomInfo && (
                <div className="mt-3 sm:mt-4 p-3 border rounded-lg bg-background">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-xs sm:text-sm">
                    <div>
                      <span className="text-muted-foreground">Pojemność:</span>
                      <span className="ml-2 font-medium">{selectedRoomInfo.capacity}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Zajęte:</span>
                      <span className="ml-2 font-medium text-orange-600">{selectedRoomInfo.occupied}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Dostępne:</span>
                      <span className="ml-2 font-medium text-green-600">{selectedRoomInfo.available}</span>
                    </div>
                    <div className="flex items-center">
                      {getAvailabilityBadge(selectedRoomInfo.available, selectedRoomInfo.capacity)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Summary Cards */}
            {localitySummary.length > 0 && (
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

            {/* Detailed Table by Locality */}
            {groupedByLocality.map(([locality, items]) => (
              <div key={locality}>
                <h3 className="text-sm font-semibold mb-2 sticky top-0 bg-background py-2 z-10">
                  {locality}
                </h3>
                {/* Mobile: Card layout */}
                <div className="sm:hidden space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className={cn("border rounded-lg p-3", !item.isActive && 'opacity-50 bg-muted')}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-medium text-sm">
                          {item.address}
                          {!item.isActive && <span className="ml-2 text-xs text-muted-foreground">(Niedostępny)</span>}
                        </div>
                        <div className="text-sm font-medium">Pokój {item.roomName}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="text-muted-foreground">Pojemność</div>
                          <div className="font-medium">{item.capacity}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Zajęte</div>
                          <div className="font-medium text-orange-600">{item.occupied}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Wolne</div>
                          <div className="font-medium text-green-600">{item.available}</div>
                        </div>
                      </div>
                      {item.isActive && (
                        <div className="mt-2">
                          {getAvailabilityBadge(item.available, item.capacity)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {/* Desktop: Table layout */}
                <div className="hidden sm:block border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs sm:text-sm whitespace-nowrap">Adres</TableHead>
                          <TableHead className="text-xs sm:text-sm whitespace-nowrap">Pokój</TableHead>
                          <TableHead className="text-center text-xs sm:text-sm whitespace-nowrap">Pojemność</TableHead>
                          <TableHead className="text-center text-xs sm:text-sm whitespace-nowrap">Zajęte</TableHead>
                          <TableHead className="text-center text-xs sm:text-sm whitespace-nowrap">Wolne</TableHead>
                          <TableHead className="text-center text-xs sm:text-sm whitespace-nowrap">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, idx) => (
                          <TableRow key={idx} className={!item.isActive ? 'opacity-50' : ''}>
                            <TableCell className="font-medium text-xs sm:text-sm whitespace-nowrap">
                              {item.address}
                              {!item.isActive && <span className="ml-2 text-xs text-muted-foreground">(Niedostępny)</span>}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm">{item.roomName}</TableCell>
                            <TableCell className="text-center text-xs sm:text-sm">{item.capacity}</TableCell>
                            <TableCell className="text-center text-orange-600 font-medium text-xs sm:text-sm">
                              {item.occupied}
                            </TableCell>
                            <TableCell className="text-center text-green-600 font-medium text-xs sm:text-sm">
                              {item.available}
                            </TableCell>
                            <TableCell className="text-center whitespace-nowrap">
                              {item.isActive && getAvailabilityBadge(item.available, item.capacity)}
                              {!item.isActive && <Badge variant="secondary" className="text-xs">Nieaktywny</Badge>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            ))}

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
              disabled={!selectedLocality || !selectedAddress || !selectedRoom}
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
