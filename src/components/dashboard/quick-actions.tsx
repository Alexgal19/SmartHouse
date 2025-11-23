
"use client";

import { Building, UserPlus, Users, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMainLayout } from "@/components/main-layout";
import { useRouter } from "next/navigation";

type ActionButtonProps = {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
}

const ActionButton = ({ icon, label, onClick }: ActionButtonProps) => (
    <Button variant="outline" className="flex-1 min-w-[140px] h-20 flex-col gap-2" onClick={onClick}>
        {icon}
        <span>{label}</span>
    </Button>
);

export function QuickActions() {
    const { handleAddEmployeeClick, handleAddNonEmployeeClick } = useMainLayout();
    const router = useRouter();

    const actions = [
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
    ];

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
