import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, MessageCircle } from "lucide-react";

import { whatsappHref } from "@/lib/contact";

export const Plans = () => {
  const plan = {
    name: "Sessão individual",
    description: "Atendimento personalizado, um paciente por vez",
    features: [
      "Em torno de 50 minutos",
      "Avaliação e ajustes com tempo dedicado",
      "Presencial no consultório",
      "R$ 180",
    ],
    cta: "Agendar sessão",
  };

  const handleWhatsAppClick = () => {
    window.open(whatsappHref(`Olá! Gostaria de agendar: ${plan.name}.`), "_blank");
  };

  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground">Modalidade de atendimento</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Sessão individual no consultório — R$ 180
          </p>
        </div>

        <div className="max-w-md mx-auto">
          <Card className="border-primary shadow-health border-border hover:shadow-medium transition-all duration-300">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl">{plan.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{plan.description}</p>
            </CardHeader>

            <CardContent className="space-y-6">
              <ul className="space-y-3">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-3">
                    <div className="mt-1 p-1 rounded-full bg-primary/10">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-foreground text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button className="w-full" onClick={handleWhatsAppClick}>
                <MessageCircle className="mr-2 h-4 w-4" />
                {plan.cta}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};
