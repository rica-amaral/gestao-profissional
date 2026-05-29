import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dashboard } from "@/components/admin/Dashboard";
import { Schedule } from "@/components/admin/Schedule";
import { Clients } from "@/components/admin/Clients";
import { AvailableSlots } from "@/components/admin/AvailableSlots";
import { Adherence } from "@/components/admin/Adherence";
import { Evaluation } from "@/components/admin/Evaluation";
import { Settings } from "@/components/admin/Settings";
import { Waitlist } from "@/components/admin/Waitlist";
import { Financeiro } from "@/components/admin/Financeiro";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2, Stethoscope } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminData } from "@/contexts/AdminDataContext";

const Admin = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState("dashboard");
  const { loading, store } = useAdminData();
  const clinicName = store?.settings?.clinicName || "Gestão de Profissional";
  const professionalName = store?.settings?.professionalName || "";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-health-bg">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Carregando seus dados...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-health-bg">
      <header className="bg-card border-b border-border sticky top-0 z-50 shadow-soft">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Stethoscope className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{clinicName}</h1>
              {professionalName && (
                <p className="text-sm text-muted-foreground">{professionalName}</p>
              )}
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout} size="sm">
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-1 h-auto p-1">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="schedule">Agenda</TabsTrigger>
            <TabsTrigger value="clients">Clientes</TabsTrigger>
            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
            <TabsTrigger value="evaluation">Avaliações</TabsTrigger>
            <TabsTrigger value="adherence">Cancel./Reag.</TabsTrigger>
            <TabsTrigger value="slots">Horários</TabsTrigger>
            <TabsTrigger value="waitlist">Fila</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <Dashboard onOpenSchedule={() => setTab("schedule")} />
          </TabsContent>

          <TabsContent value="schedule" className="space-y-6">
            <Schedule />
          </TabsContent>

          <TabsContent value="clients" className="space-y-6">
            <Clients />
          </TabsContent>

          <TabsContent value="financeiro" className="space-y-6">
            <Financeiro />
          </TabsContent>

          <TabsContent value="evaluation" className="space-y-6">
            <Evaluation />
          </TabsContent>

          <TabsContent value="adherence" className="space-y-6">
            <Adherence />
          </TabsContent>

          <TabsContent value="slots" className="space-y-6">
            <AvailableSlots />
          </TabsContent>

          <TabsContent value="waitlist" className="space-y-6">
            <Waitlist />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Settings />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
