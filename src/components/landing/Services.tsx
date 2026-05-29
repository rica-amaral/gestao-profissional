import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, MessageCircle, User } from "lucide-react";
import { whatsappHref } from "@/lib/contact";
import { defaultClinicSettings } from "@/lib/admin-types";
import { formatBRL } from "@/lib/utils";

// Os planos exibidos na landing usam os valores padrão definidos em
// `defaultClinicSettings`. A landing é pública, então não puxa dados
// específicos do admin (que estão sob RLS por usuário). Para alterar
// preços/modalidades aqui, edite `defaultClinicSettings.services` em
// `src/lib/admin-types.ts`.
const plans = defaultClinicSettings().services;

export const Services = () => {
  const subtitle =
    plans.length === 1
      ? `Sessão no consultório — a partir de ${formatBRL(plans[0].price)}`
      : "Modalidades e valores de atendimento";

  return (
    <section className="py-24 bg-health-bg" id="services">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground">Modalidade de atendimento</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">{subtitle}</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((service) => {
            const Icon = User;
            const handleWhatsAppClick = () => {
              window.open(whatsappHref(`Olá! Gostaria de agendar uma ${service.name}.`), "_blank");
            };
            return (
              <Card
                key={service.id}
                className="border-border hover:shadow-medium transition-all duration-300 hover:-translate-y-1 relative overflow-hidden"
              >
                <CardHeader className="space-y-4">
                  <div className="p-4 rounded-xl bg-primary/10 w-fit">
                    <Icon className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl mb-2">{service.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {service.durationLabel}
                    </CardDescription>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>• Atendimento personalizado no consultório</p>
                    <p className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Presencial em Bauru
                    </p>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <p className="text-2xl font-bold text-primary mb-4">{formatBRL(service.price)}</p>
                    <Button className="w-full" onClick={handleWhatsAppClick}>
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Agendar via WhatsApp
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};
