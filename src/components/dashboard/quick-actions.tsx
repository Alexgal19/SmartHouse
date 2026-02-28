
"use client";

import { Building, UserPlus, Search, Bell, BellOff, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMainLayout } from "@/components/main-layout";
import { useRouter } from "next/navigation";
import { usePushSubscription } from "@/hooks/use-push-subscription";

type ActionButtonProps = {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    disabled?: boolean;
}

const ActionButton = ({ icon, label, onClick, disabled }: ActionButtonProps) => (
    <Button variant="outline" className="flex-1 min-w-[140px] h-20 flex-col gap-2" onClick={onClick} disabled={disabled}>
        {icon}
        <span>{label}</span>
    </Button>
);

export function QuickActions({ onOpenAddressPreview }: { onOpenAddressPreview?: () => void }) {
    const { handleAddEmployeeClick, handleAddNonEmployeeClick } = useMainLayout();
    const { pushSubscription, subscribe, unsubscribe, isSupported, isSubscribing, isUnsubscribing } = usePushSubscription();
    const router = useRouter();

    const actions: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }[] = [
        {
            icon: <UserPlus className="h-6 w-6 text-primary" />,
            label: "Dodaj pracownika",
            onClick: handleAddEmployeeClick
        },
        {
            icon: <UserPlus className="h-6 w-6 text-purple-500" />,
            label: "Dodaj mieszkańca (NZ)",
            onClick: handleAddNonEmployeeClick
        },
        {
            icon: <Search className="h-6 w-6 text-blue-500" />,
            label: "Wyszukaj mieszkańca",
            onClick: () => router.push('/dashboard?view=employees')
        },
        {
            icon: <Building className="h-6 w-6 text-green-500" />,
            label: "Przeglądaj mieszkania",
            onClick: () => router.push('/dashboard?view=housing')
        },
        {
            icon: <Building className="h-6 w-6 text-indigo-500" />,
            label: "Podgląd miejsc",
            onClick: () => onOpenAddressPreview && onOpenAddressPreview()
        },
    ];

    // Always show the button, but it might fail if not supported
    const isLoading = isSubscribing || isUnsubscribing;
    actions.push({
        icon: isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : (pushSubscription ? <BellOff className="h-6 w-6 text-red-500" /> : <Bell className="h-6 w-6 text-yellow-500" />),
        label: pushSubscription ? "Wyłącz PUSH Powiadomienia" : "Włącz PUSH Powiadomienia",
        onClick: pushSubscription ? unsubscribe : subscribe,
        disabled: isLoading || !isSupported
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Szybkie działania</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-wrap gap-4">
                    {actions.map((action, index) => (
                        <ActionButton key={index} {...action} />
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
