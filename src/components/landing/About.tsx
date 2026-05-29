import { Card, CardContent } from "@/components/ui/card";
import { Award, GraduationCap, Calendar, Target, UserCircle2 } from "lucide-react";

export const About = () => {
  const credentials = [
    {
      icon: GraduationCap,
      title: "Formação",
      description: "Preencha com a formação acadêmica do profissional.",
    },
    {
      icon: Award,
      title: "Aprimoramento",
      description: "Especializações e cursos de aperfeiçoamento realizados.",
    },
    {
      icon: Calendar,
      title: "Experiência",
      description: "Anos de atuação na área de saúde e bem-estar.",
    },
    {
      icon: Target,
      title: "Atuação",
      description: "Principais áreas de atendimento e especialidades.",
    },
  ];

  const specialties: string[] = [
    // Preencha com as especialidades do profissional
    "Especialidade 1",
    "Especialidade 2",
    "Especialidade 3",
    "Especialidade 4",
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
            {/* Placeholder de foto — substitua por <img src={...} /> quando tiver a foto */}
            <div className="relative animate-in fade-in slide-in-from-left duration-700">
              <div className="relative rounded-2xl overflow-hidden shadow-medium aspect-[3/4] max-w-md mx-auto lg:max-w-none bg-primary/5 border border-primary/20 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-muted-foreground">
                  <UserCircle2 className="h-32 w-32 text-primary/30" />
                  <p className="text-sm">Adicione a foto do profissional</p>
                </div>
              </div>
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-primary/20 rounded-full blur-2xl -z-10" />
            </div>

            <div className="space-y-6 animate-in fade-in slide-in-from-right duration-700 delay-150">
              <div className="space-y-4">
                <h3 className="text-2xl font-bold text-foreground">
                  Nome do Profissional
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Descreva aqui a trajetória profissional, experiência e diferenciais do
                  atendimento. Este texto será exibido na página pública para os pacientes.
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
                Especialidades e técnicas
              </h4>
              <ul className="grid sm:grid-cols-2 gap-3 text-sm text-muted-foreground">
                {specialties.map((item) => (
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
