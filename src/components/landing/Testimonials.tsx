import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";

export const Testimonials = () => {
  const testimonials = [
    {
      name: "Maria Silva",
      age: 45,
      city: "Bauru",
      text: "Após anos de dor lombar, finalmente encontrei alívio. As sessões são precisas e o profissionalismo é excepcional. Recomendo!",
      rating: 5
    },
    {
      name: "João Santos",
      age: 52,
      city: "Bauru",
      text: "Excelente atendimento! Minha postura melhorou muito e as dores no pescoço desapareceram. Vale cada sessão.",
      rating: 5
    },
    {
      name: "Ana Paula",
      age: 28,
      city: "Bauru",
      text: "Comecei por indicação e não me arrependo. Sinto muito mais mobilidade e minha qualidade de vida melhorou significativamente.",
      rating: 5
    }
  ];

  return (
    <section className="py-24 bg-health-bg">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground">
            O que Dizem Nossos Pacientes
          </h2>
          <p className="text-xl text-muted-foreground">
            Resultados reais de pessoas reais
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
                    {testimonial.age} anos • {testimonial.city}
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
