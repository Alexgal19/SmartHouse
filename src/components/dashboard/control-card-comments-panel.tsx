"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Bell, BellOff, ExternalLink } from 'lucide-react';
import type { ControlCard, SessionData, Settings, ControlCardCommentStatus } from '@/types';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/lib/i18n';

interface CommentItem {
  cardId: string;
  commentId: string;
  addressId: string;
  coordinator: string;
  locality: string;
  addressName: string;
  context: string;
  text: string;
  fillDate: string;
  controlMonth: string;
  status: ControlCardCommentStatus | null;
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

    if (Array.isArray(card.comments)) {
      for (const comment of card.comments) {
        if (comment.text.trim()) {
          items.push({
            cardId: card.id,
            commentId: comment.id,
            addressId: card.addressId,
            coordinator: card.coordinatorName,
            locality,
            addressName: card.addressName,
            context: '📝 Komentarze/Usterki',
            text: comment.text.trim(),
            fillDate: card.fillDate,
            controlMonth: card.controlMonth,
            status: comment.status,
          });
        }
      }
    }

    for (const room of card.roomRatings ?? []) {
      if (room.comment?.trim()) {
        items.push({
          cardId: card.id,
          commentId: room.roomId,
          addressId: card.addressId,
          coordinator: card.coordinatorName,
          locality,
          addressName: card.addressName,
          context: `🚪 ${room.roomName}`,
          text: room.comment.trim(),
          fillDate: card.fillDate,
          controlMonth: card.controlMonth,
          status: null,
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
  const { t } = useLanguage();
  const [items, setItems] = useState<CommentItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const { toast } = useToast();
  const [updatingCommentId, setUpdatingCommentId] = useState<string | null>(null);

  const handleStatusChange = async (cardId: string, commentId: string, newStatus: ControlCardCommentStatus) => {
    setUpdatingCommentId(commentId);
    try {
      const { updateControlCardCommentStatusAction } = await import('@/lib/actions');
      const res = await updateControlCardCommentStatusAction(cardId, commentId, newStatus);
      if (res.success) {
        setItems(prev => prev?.map(it => it.commentId === commentId ? { ...it, status: newStatus } : it) ?? null);
        toast({ title: t('dashboard.statusUpdated') });
      } else {
        toast({ title: t('dashboard.statusUpdateError'), description: res.error, variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: t('dashboard.errorOccurred'), description: String(e), variant: 'destructive' });
    } finally {
      setUpdatingCommentId(null);
    }
  };

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

  const AUTO_REFRESH_MS = 60 * 60 * 1000; // 1 hour

  useEffect(() => {
    fetchComments();
    const interval = setInterval(() => fetchComments(true), AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          {t('dashboard.controlCardComments')}
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
          {t('common.refresh')}
        </Button>
      </CardHeader>

      <CardContent>
        {loading ? (
          <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
        ) : error ? (
          <p className="text-xs text-destructive">{t('dashboard.commentsLoadError')}</p>
        ) : !hasComments ? (
          <p className="text-xs text-green-600 font-medium">{t('dashboard.noComments')}</p>
        ) : (
          <div className="space-y-3">
            {items!.map((item, i) => (
              <div key={`${item.cardId}-${item.commentId}`}>
                {i > 0 && <div className="border-t border-muted my-2" />}
                <div className="relative rounded-md hover:bg-muted/50 transition-colors -mx-2 px-2 py-1 group">
                  <Link
                    href={`/dashboard?view=control-cards&address=${item.addressId}`}
                    className="block space-y-0.5"
                  >
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
                  </Link>
                  {item.status && (
                    <div className="flex flex-wrap gap-1.5 mt-2 mb-1 pointer-events-auto">
                      {(['Nie przyjęte', 'W trakcie', 'Temat rozwiązany'] as ControlCardCommentStatus[]).map((status) => {
                        const statusLabelMap: Record<string, string> = {
                          'Nie przyjęte': t('controlCards.commentStatusNew'),
                          'W trakcie': t('controlCards.commentStatusInProgress'),
                          'Temat rozwiązany': t('controlCards.commentStatusResolved'),
                        };
                        return (
                          <button
                            key={status}
                            type="button"
                            disabled={updatingCommentId === item.commentId}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleStatusChange(item.cardId, item.commentId, status);
                            }}
                            className={`px-2 py-0.5 text-[10px] font-medium rounded-full border transition-all ${
                              item.status === status
                                ? status === 'Nie przyjęte' ? 'bg-red-500/10 text-red-600 border-red-500/30 animate-pulse'
                                : status === 'W trakcie' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30 animate-pulse'
                                : 'bg-green-500/10 text-green-600 border-green-500/30 animate-pulse'
                                : 'bg-background text-muted-foreground border-border hover:bg-muted'
                            } ${updatingCommentId === item.commentId && 'opacity-50 cursor-not-allowed'}`}
                          >
                            {status === 'Nie przyjęte' ? '🔴' : status === 'W trakcie' ? '🟡' : '🟢'} {statusLabelMap[status]}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {total > LIMIT && (
              <p className="text-[10px] text-muted-foreground text-center pt-1">
                {t('dashboard.showingOf', { shown: LIMIT, total })}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
