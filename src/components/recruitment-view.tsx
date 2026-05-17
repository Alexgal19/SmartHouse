"use client";

import { useState, useEffect, useCallback } from "react";
import type { SessionData, Candidate, CandidateDemand } from "@/types";
import { useLanguage } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getCandidatesAction, sendCandidateDemandNotificationAction, getCandidateDemandsAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export default function RecruitmentView({ currentUser, activeView }: { currentUser: SessionData; activeView: string }) {
    const { t, dateLocale } = useLanguage();
    const { toast } = useToast();
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [demands, setDemands] = useState<CandidateDemand[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [sendingId, setSendingId] = useState<string | null>(null);

    const handleDemand = async (candidate: Candidate) => {
        setSendingId(candidate.id);
        try {
            const result = await sendCandidateDemandNotificationAction(candidate);
            if (result.success) {
                toast({ title: t("candidate.demandSent"), description: t("candidate.demandSentDesc", { count: result.sentCount }) });
                const updatedDemands = await getCandidateDemandsAction();
                setDemands(updatedDemands);
            } else {
                toast({ variant: "destructive", title: t("candidate.demandError"), description: result.error || "" });
            }
        } catch (err) {
            console.error(err);
            toast({ variant: "destructive", title: t("candidate.demandError"), description: String(err) });
        } finally {
            setSendingId(null);
        }
    };

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [candData, demandData] = await Promise.all([
                getCandidatesAction(),
                getCandidateDemandsAction(),
            ]);
            setCandidates(candData);
            setDemands(demandData);
        } catch (err) {
            console.error(err);
            toast({ variant: "destructive", title: t("common.error"), description: String(err) });
        } finally {
            setLoading(false);
        }
    }, [toast, t]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        if (activeView === 'recruitment') loadData();
    }, [activeView, loadData]);

    const filteredCandidates = candidates.filter((c) =>
        c.lastName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getCandidateDemand = (candidateId: string): CandidateDemand | undefined => {
        return demands
            .filter(d => d.candidateId === candidateId)
            .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())[0];
    };

    const demandStatusBadge = (demand?: CandidateDemand) => {
        if (!demand) return <span className="text-muted-foreground text-sm">—</span>;
        switch (demand.status) {
            case 'pending':
                return <Badge variant="secondary">{t("candidate.pendingAck")}</Badge>;
            case 'acknowledged':
                return (
                    <div className="text-xs text-muted-foreground">
                        ✅ {t("candidate.acknowledgedBy")}
                        <br />
                        {demand.acknowledgedAt ? format(new Date(demand.acknowledgedAt), "dd.MM.yyyy HH:mm", { locale: dateLocale }) : ''}
                    </div>
                );
            case 'expired':
                return <Badge variant="destructive">{t("candidate.demandExpired")}</Badge>;
            default:
                return <Badge>{demand.status}</Badge>;
        }
    };

    const statusBadge = (status: Candidate["status"]) => {
        switch (status) {
            case "nowy":
                return <Badge variant="secondary">{t("candidate.statusNowy")}</Badge>;
            case "w_trakcie":
                return <Badge variant="default">{t("candidate.statusWTrakcie")}</Badge>;
            case "zakonczony":
                return <Badge variant="outline">{t("candidate.statusZakonczony")}</Badge>;
            default:
                return <Badge>{status}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-2xl font-bold tracking-tight">{t("nav.recruitment")}</h1>
                <div className="w-full sm:w-72">
                    <Input
                        placeholder={t("candidate.searchBySurname")}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-1/3" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    </CardContent>
                </Card>
            ) : filteredCandidates.length === 0 ? (
                <Card>
                    <CardContent className="py-10 text-center text-muted-foreground">
                        {candidates.length === 0 ? t("common.noData") : t("candidate.searchBySurname")}
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>{t("candidate.title")}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[60vh]">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t("candidate.lastName")}</TableHead>
                                        <TableHead>{t("candidate.firstName")}</TableHead>
                                        <TableHead>{t("candidate.passportNumber")}</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>{t("candidate.dateAdded")}</TableHead>
                                        <TableHead>{t("candidate.demandStatus")}</TableHead>
                                        <TableHead className="w-[200px]">{t("col.actions")}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredCandidates.map((c) => {
                                        const demand = getCandidateDemand(c.id);
                                        return (
                                            <TableRow key={c.id}>
                                                <TableCell className="font-medium">{c.lastName}</TableCell>
                                                <TableCell>{c.firstName}</TableCell>
                                                <TableCell>{c.passportNumber || "-"}</TableCell>
                                                <TableCell>{statusBadge(c.status)}</TableCell>
                                                <TableCell>
                                                    {c.createdAt
                                                        ? format(new Date(c.createdAt), "dd.MM.yyyy HH:mm", { locale: dateLocale })
                                                        : "-"}
                                                </TableCell>
                                                <TableCell>{demandStatusBadge(demand)}</TableCell>
                                                <TableCell>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        disabled={sendingId === c.id || demand?.status === 'pending'}
                                                        onClick={() => handleDemand(c)}
                                                    >
                                                        {sendingId === c.id ? t("common.processing") : t("candidate.demandBtn")}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}