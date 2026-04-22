"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Bell, BellOff, ExternalLink } from 'lucide-react';
import type { ControlCard, SessionData, Settings } from '@/types';

interface CommentItem {
  cardId: string;
  addressId: string;
  coordinator: string;
  locality: string;
  addressName: string;
  context: string;
  text: string;
  fillDate: string;
  controlMonth: string;
}

function formatMonth(ym: string): string {
  const [y, m] = ym.split('-');
  const months = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
    'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
  const idx = parseInt(m, 10) - 1;
  return `${months[idx] ?? m} ${y}`;
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function extractComments(
  cards: ControlCard[],
  addresses: Settings['addresses'],
  uid: string,
  isAdmin: boolean,
): CommentItem[] {
  const items: CommentItem[] = [];

  const filtered = isAdmin ? cards : cards.filter(c => c.coordinatorId === uid);

  for (const card of filtered) {
    const locality = addresses.find(a => a.id === card.addressId)?.locality ?? '';

    if (card.comments?.trim()) {
      items.push({
        cardId: card.id,
        addressId: card.addressId,
        coordinator: card.coordinatorName,
        locality,
        addressName: card.addressName,
        context: '📝 Komentarze/Usterki',
        text: card.comments.trim(),
        fillDate: card.fillDate,
        controlMonth: card.controlMonth,
      });
    }

    for (const room of card.roomRatings ?? []) {
      if (room.comment?.trim()) {
        items.push({
          cardId: `${card.id}-${room.roomId}`,
          addressId: card.addressId,
          coordinator: card.coordinatorName,
          locality,
          addressName: card.addressName,
          context: `🚪 ${room.roomName}`,
          text: room.comment.trim(),
          fillDate: card.fillDate,
          controlMonth: card.controlMonth,
        });
      }
    }
  }

  items.sort((a, b) => b.fillDate.localeCompare(a.fillDate));
  return items;
}

const LIMIT = 15;

interface Props {
  currentUser: SessionData;
  settings: Settings;
}

export function ControlCardCommentsPanel({ currentUser, settings }: Props) {
  const [items, setItems] = useState<CommentItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const fetchComments = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/control-cards');
      if (!res.ok) throw new Error('HTTP error');
      const cards: ControlCard[] = await res.json();
      const all = extractComments(cards, settings.addresses, currentUser.uid, currentUser.isAdmin);
      setTotal(all.length);
      setItems(all.slice(0, LIMIT));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchComments(); }, []);

  const hasComments = items !== null && items.length > 0;

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {hasComments
            ? <Bell className="h-4 w-4 text-red-500" />
            : items?.length === 0
              ? <BellOff className="h-4 w-4 text-green-500" />
              : <Bell className="h-4 w-4 text-muted-foreground" />}
          Komentarze z kart kontroli
          {hasComments && (
            <Badge variant="destructive" className="text-xs h-5 px-1.5">{total}</Badge>
          )}
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => fetchComments(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
          Odśwież
        </Button>
      </CardHeader>

      <CardContent>
        {loading ? (
          <p className="text-xs text-muted-foreground">Ładowanie...</p>
        ) : error ? (
          <p className="text-xs text-destructive">Błąd ładowania komentarzy.</p>
        ) : !hasComments ? (
          <p className="text-xs text-green-600 font-medium">✓ Brak komentarzy</p>
        ) : (
          <div className="space-y-3">
            {items!.map((item, i) => (
              <div key={item.cardId}>
                {i > 0 && <div className="border-t border-muted my-2" />}
                <Link
                  href={`/dashboard?view=control-cards&address=${item.addressId}`}
                  className="block rounded-md hover:bg-muted/50 transition-colors -mx-2 px-2 py-1 group"
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-foreground flex items-center gap-1">
                      {item.coordinator}
                      {item.locality
                        ? <span className="text-muted-foreground font-normal"> · {item.locality} · {item.addressName}</span>
                        : <span className="text-muted-foreground font-normal"> · {item.addressName}</span>
                      }
                      <ExternalLink className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-60 flex-shrink-0 ml-0.5 transition-opacity" />
                    </p>
                    <p className="text-xs text-muted-foreground">{item.context}</p>
                    <p className="text-xs text-foreground italic line-clamp-3 whitespace-pre-wrap">
                      &ldquo;{item.text}&rdquo;
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatMonth(item.controlMonth)} · {formatDate(item.fillDate)}
                    </p>
                  </div>
                </Link>
              </div>
            ))}
            {total > LIMIT && (
              <p className="text-[10px] text-muted-foreground text-center pt-1">
                Wyświetlono {LIMIT} z {total} komentarzy
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
