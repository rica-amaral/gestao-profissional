import { Card, CardContent } from "@/components/ui/card";
import { CalendarCheck, MessageCircle, ShieldCheck, Clock, Star, Smartphone } from "lucide-react";

export const Benefits = () => {
  const benefits = [
    {
      icon: CalendarCheck,
      title: "Agenda organizada",
      description: "Controle completo dos atendimentos, confirmações e histórico de cada cliente em um só lugar."
    },
    {
      icon: MessageCircle,
      title: "WhatsApp integrado",
      description: "Envie lembretes, confirmações e mensagens de aniversário com um clique direto pelo WhatsApp."
    },
    {
      icon: ShieldCheck,
      title: "Dados seguros",
      description: "Cada profissional acessa apenas os próprios dados. Segurança e privacidade garantidas."
    },
    {
      icon: Clock,
      title: "Recorrência automática",
      description: "Crie séries de atendimentos com frequência personalizada (semanal, quinzenal, mensal)."
    },
    {
      icon: Star,
      title: "Financeiro em dia",
      description: "Acompanhe receitas, despesas, pendências e projeções sem planilhas ou cadernos."
    },
    {
      icon: Smartphone,
      title: "Funciona em qualquer tela",
      description: "Acesse do celular, tablet ou computador. Sem instalação, direto pelo navegador."
    }
  ];

  return (
    <section className="py-24 bg-health-bg">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground">
            Tudo que você precisa para gerir seus atendimentos
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Para nutricionistas, quiropraxistas, psicólogos, massagistas, manicures e mais
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {benefits.map((benefit, index) => (
            <Card 
              key={index}
              className="border-border hover:shadow-medium transition-all duration-300 hover:-translate-y-1 group"
            >
              <CardContent className="p-8 space-y-4">
                <div className="p-4 rounded-xl bg-primary/10 w-fit group-hover:bg-primary/20 transition-colors">
                  <benefit.icon className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-2">
                    {benefit.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
