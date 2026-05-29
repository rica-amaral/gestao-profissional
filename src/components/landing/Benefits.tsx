import { Card, CardContent } from "@/components/ui/card";
import { HeartPulse, Activity, ArrowUpRight, Minimize2, Moon } from "lucide-react";

export const Benefits = () => {
  const benefits = [
    {
      icon: HeartPulse,
      title: "Redução de Dores",
      description: "Alívio efetivo de dores lombares, cervicais e articulares através de ajustes precisos"
    },
    {
      icon: Activity,
      title: "Mobilidade Melhorada",
      description: "Restauração da amplitude de movimento e flexibilidade para atividades diárias"
    },
    {
      icon: ArrowUpRight,
      title: "Correção Postural",
      description: "Ajustes que promovem melhor postura e previnem problemas futuros"
    },
    {
      icon: Minimize2,
      title: "Relaxamento Muscular",
      description: "Redução de tensões e espasmos musculares causados por estresse ou má postura"
    },
    {
      icon: Moon,
      title: "Melhora no Sono",
      description: "Sono mais profundo e reparador com a redução de desconfortos noturnos"
    }
  ];

  return (
    <section className="py-24 bg-health-bg">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground">
            Benefícios da Quiropraxia
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Resultados comprovados para sua saúde e bem-estar
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
