import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";

export const Testimonials = () => {
  const testimonials = [
    {
      name: "Camila Rodrigues",
      role: "Nutricionista",
      city: "São Paulo",
      text: "Antes eu usava planilha e caderno para tudo. Agora tenho agenda, financeiro e histórico dos pacientes em um só lugar. Economizo horas toda semana.",
      rating: 5
    },
    {
      name: "Dr. Felipe Mendes",
      role: "Quiropraxista",
      city: "Campinas",
      text: "O sistema de lembretes pelo WhatsApp reduziu as faltas pela metade. Os pacientes confirmam com um clique e eu fico sabendo na hora.",
      rating: 5
    },
    {
      name: "Ana Beatriz",
      role: "Psicóloga",
      city: "Belo Horizonte",
      text: "A parte financeira é o que mais gosto. Vejo o faturamento do mês, as pendências e a projeção dos próximos atendimentos sem abrir uma planilha.",
      rating: 5
    }
  ];

  return (
    <section className="py-24 bg-health-bg">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground">
            O que dizem os profissionais
          </h2>
          <p className="text-xl text-muted-foreground">
            Resultados reais de quem já usa no dia a dia
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <Card
              key={index}
              className="border-border hover:shadow-medium transition-all duration-300"
            >
              <CardContent className="p-8 space-y-4">
                <div className="flex gap-1">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-primary text-primary" />
                  ))}
                </div>

                <p className="text-foreground leading-relaxed italic">
                  "{testimonial.text}"
                </p>

                <div className="pt-4 border-t border-border">
                  <p className="font-semibold text-foreground">{testimonial.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {testimonial.role} • {testimonial.city}
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
