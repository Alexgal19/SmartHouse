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
      address.rooms.forEach(room => {
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
          isActive: address.isActive && room.isActive && !room.isLocked,
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
      <DialogContent className="sm:max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Podgląd i wybór dostępności miejsc</DialogTitle>
          <DialogDescription>
            Wybierz miejscowość, adres i pokój, aby zastosować w formularzu
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[70vh] pr-4">
          {/* Interactive Selection Section */}
          <div className="mb-6 p-4 border rounded-lg bg-muted/50">
            <h3 className="text-sm font-semibold mb-4">Wybierz zakwaterowanie</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <div className="mt-4 p-3 border rounded-lg bg-background">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-3">Podsumowanie według miejscowości</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {localitySummary.map((summary) => (
                  <Card key={summary.locality}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">{summary.locality}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1 text-sm">
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
            <div key={locality} className="mb-6">
              <h3 className="text-sm font-semibold mb-2 sticky top-0 bg-background py-2">
                {locality}
              </h3>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Adres</TableHead>
                      <TableHead>Pokój</TableHead>
                      <TableHead className="text-center">Pojemność</TableHead>
                      <TableHead className="text-center">Zajęte</TableHead>
                      <TableHead className="text-center">Wolne</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, idx) => (
                      <TableRow key={idx} className={!item.isActive ? 'opacity-50' : ''}>
                        <TableCell className="font-medium">
                          {item.address}
                          {!item.isActive && <span className="ml-2 text-xs text-muted-foreground">(Niedostępny)</span>}
                        </TableCell>
                        <TableCell>{item.roomName}</TableCell>
                        <TableCell className="text-center">{item.capacity}</TableCell>
                        <TableCell className="text-center text-orange-600 font-medium">
                          {item.occupied}
                        </TableCell>
                        <TableCell className="text-center text-green-600 font-medium">
                          {item.available}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.isActive && getAvailabilityBadge(item.available, item.capacity)}
                          {!item.isActive && <Badge variant="secondary">Nieaktywny</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}

          {addressOccupancy.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Brak danych o adresach
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Anuluj
          </Button>
          {onApplySelection && (
            <Button 
              onClick={handleApply} 
              disabled={!selectedLocality || !selectedAddress || !selectedRoom}
            >
              Zastosuj wybór
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
