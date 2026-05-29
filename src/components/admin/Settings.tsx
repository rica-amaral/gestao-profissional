import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Clock, MapPin, DollarSign, MessageSquare } from "lucide-react";
import { useAdminData } from "@/contexts/AdminDataContext";
import type { ServicePlan } from "@/lib/admin-types";
import { toast } from "@/hooks/use-toast";

export const Settings = () => {
  const { store, patch } = useAdminData();
  const { settings } = store;

  const update = (partial: Partial<typeof settings>) => {
    patch((s) => ({ ...s, settings: { ...s.settings, ...partial } }));
  };

  const updateService = (id: string, partial: Partial<ServicePlan>) => {
    patch((s) => ({
      ...s,
      settings: {
        ...s.settings,
        services: s.settings.services.map((x) => (x.id === id ? { ...x, ...partial } : x)),
      },
    }));
  };

  const addService = () => {
    const id = `srv_${Date.now()}`;
    patch((s) => ({
      ...s,
      settings: {
        ...s.settings,
        services: [...s.settings.services, { id, name: "Novo serviço", durationLabel: "~50 min", price: 0 }],
      },
    }));
  };

  const removeService = (id: string) => {
    if (store.settings.services.length <= 1) {
      toast({ variant: "destructive", title: "Mantenha ao menos um serviço" });
      return;
    }
    patch((s) => ({
      ...s,
      settings: { ...s.settings, services: s.settings.services.filter((x) => x.id !== id) },
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Configurações</h2>
        <p className="text-muted-foreground">
          A agenda na tela mostra sempre 6h–20h. Aqui você define o horário “normal” de atendimento (fora disso aparece
          destacado em vermelho, mas ainda pode marcar), bloqueio da manhã até as 8h (por dia na agenda), almoço e textos
          de mensagem.
        </p>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5" />
            Perfil do consultório
          </CardTitle>
          <CardDescription>
            Identificação do profissional. O campo <strong>Clínica</strong> é usado como <code>{"{clinica}"}</code> nas
            mensagens de WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-xl">
          <div className="space-y-2">
            <Label>Nome da clínica / consultório</Label>
            <Input
              placeholder="Ex: Dr. João Silva Quiropraxia"
              value={settings.clinicName}
              onChange={(e) => update({ clinicName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Nome do profissional</Label>
            <Input
              placeholder="Ex: Dr. João Silva"
              value={settings.professionalName}
              onChange={(e) => update({ professionalName: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Horários de atendimento (agenda 6h–20h)
          </CardTitle>
          <CardDescription>
            Início e fim do período em que você costuma atender. Fora desse intervalo, os horários aparecem em vermelho
            na agenda, porém continuam agendáveis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 max-w-xl">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Início atendimento</Label>
              <Input
                type="time"
                value={settings.scheduleStart}
                onChange={(e) => update({ scheduleStart: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Fim atendimento</Label>
              <Input
                type="time"
                value={settings.scheduleEnd}
                onChange={(e) => update({ scheduleEnd: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Bloquear manhã até (hora cheia, ex.: 8)</Label>
            <Input
              type="number"
              min={6}
              max={12}
              value={settings.earlyBlockUntilHour}
              onChange={(e) => update({ earlyBlockUntilHour: Number(e.target.value) || 8 })}
            />
            <p className="text-xs text-muted-foreground">
              Antes dessa hora fica bloqueado por dia até você liberar na própria agenda.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
            <div className="space-y-2">
              <Label>Almoço — início</Label>
              <Input type="time" value={settings.lunchStart} onChange={(e) => update({ lunchStart: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Almoço — fim</Label>
              <Input type="time" value={settings.lunchEnd} onChange={(e) => update({ lunchEnd: e.target.value })} />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            O intervalo de almoço aparece em destaque na agenda; ainda é possível agendar. Nos horários “sugeridos” para
            enviar a pacientes, esse período fica de fora.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5" />
            Localização
          </CardTitle>
          <CardDescription>Endereço usado nas comunicações e no site, se vinculado.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={3}
            value={settings.locationAddress}
            onChange={(e) => update({ locationAddress: e.target.value })}
          />
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5" />
            Serviços e planos
          </CardTitle>
          <CardDescription>Cadastro dos serviços (podem ser refletidos na página pública do site).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings.services.map((service) => (
            <div key={service.id} className="grid sm:grid-cols-[1fr_1fr_100px_auto] gap-3 items-end border border-border rounded-lg p-3">
              <div className="space-y-2">
                <Label className="text-xs">Nome</Label>
                <Input value={service.name} onChange={(e) => updateService(service.id, { name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Duração (texto)</Label>
                <Input
                  value={service.durationLabel}
                  onChange={(e) => updateService(service.id, { durationLabel: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Preço (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  value={service.price}
                  onChange={(e) => updateService(service.id, { price: Number(e.target.value) || 0 })}
                />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => removeService(service.id)}>
                Remover
              </Button>
            </div>
          ))}
          <Button type="button" variant="secondary" onClick={addService}>
            Adicionar serviço
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5" />
            Mensagens padrão (WhatsApp)
          </CardTitle>
          <CardDescription>
            Variáveis: {"{nome}"}, {"{data}"}, {"{hora}"}. Na agenda, ícones ao lado do horário abrem essas mensagens no
            WhatsApp do paciente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-2xl">
          <div className="space-y-2">
            <Label>Confirmação de horário</Label>
            <Textarea
              rows={3}
              value={settings.messageConfirmation}
              onChange={(e) => update({ messageConfirmation: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Lembrete</Label>
            <Textarea
              rows={3}
              value={settings.messageReminder}
              onChange={(e) => update({ messageReminder: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Parabéns (aniversário)</Label>
            <Textarea
              rows={3}
              value={settings.messageBirthday}
              onChange={(e) => update({ messageBirthday: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

    </div>
  );
};
