import { Card, CardContent } from "@/components/ui/card";
import { Award, GraduationCap, Calendar, Target } from "lucide-react";
import profileImage from "@/assets/felipe-ceribelli.png";

export const About = () => {
  const credentials = [
    {
      icon: GraduationCap,
      title: "Formação",
      description:
        "Fisioterapia pela Universidade Sagrado Coração e Dip em Quiropraxia.",
    },
    {
      icon: Award,
      title: "Aprimoramento",
      description: "Ortopedia e Traumatologia pela Santa Casa de Batatais"
    },
    {
      icon: Calendar,
      title: "Experiência",
      description: "Mais de 12 anos de atuação em Quiropraxia e Fisioterapia"
    },
    {
      icon: Target,
      title: "Atuação",
      description: "Dores na coluna, articulações, terapias manuais e atendimento esportivo e clínico",
    },
  ];

  const quiroSpecialties = [
    "Quiropraxia de Palmer",
    "Quiropraxia de Gonstead",
    "Quiropraxia de Thompson",
    "Terapia Instrumental Quiropráxica",
    "Mobilização Neural",
    "Liberação Miofascial",
    "Avaliação por ThermoScan",
    "Dry Needling (agulhamento a seco)",
  ];

  return (
    <section className="py-24 bg-background" id="about">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground">
            Sobre o Profissional
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Expertise e dedicação para seu bem-estar
          </p>
        </div>

        <div className="max-w-6xl mx-auto space-y-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="relative animate-in fade-in slide-in-from-left duration-700">
            <div className="relative rounded-2xl overflow-hidden shadow-medium aspect-[3/4] max-w-md mx-auto lg:max-w-none">
              <img 
                src={profileImage}
                alt="Felipe Ceribelli - Quiropraxista"
                className="w-full h-full object-cover object-top"
              />
            </div>
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-primary/20 rounded-full blur-2xl -z-10" />
          </div>

          <div className="space-y-6 animate-in fade-in slide-in-from-right duration-700 delay-150">
            <div className="space-y-4">
              <h3 className="text-2xl font-bold text-foreground">
                Felipe Ceribelli
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Profissional com mais de 12 anos de experiência contínua em Quiropraxia e 
                Fisioterapia, atuando em Bauru e região. Especializado em tratamento de dores 
                na coluna, articulações e disfunções musculoesqueléticas através de terapias 
                manuais, ajustes quiropráticos e reabilitação. Experiência em atendimento 
                esportivo e clínico, com foco em restaurar sua mobilidade e qualidade de vida.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {credentials.map((credential, index) => (
                <Card key={index} className="border-border hover:shadow-soft transition-shadow">
                  <CardContent className="p-6 space-y-3">
                    <div className="p-3 rounded-lg bg-primary/10 w-fit">
                      <credential.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">
                        {credential.title}
                      </h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {credential.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        <Card className="border-border animate-in fade-in duration-700">
          <CardContent className="p-6 sm:p-8">
            <h4 className="text-lg font-semibold text-foreground mb-4 text-center sm:text-left">
              Especialidades em quiropraxia e técnicas complementares
            </h4>
            <ul className="grid sm:grid-cols-2 gap-3 text-sm text-muted-foreground">
              {quiroSpecialties.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-primary font-bold shrink-0">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        </div>
      </div>
    </section>
  );
};
