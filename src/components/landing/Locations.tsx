import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Phone } from "lucide-react";
import { CITY_LINE, WHATSAPP_DISPLAY, whatsappHref } from "@/lib/contact";

export const Locations = () => {
  const locations = [
    {
      city: "Bauru",
      name: "Clínica Integrare",
      address: "Alameda Dr. Octávio Pinheiro Brisolla, 14-55 - Jardim Brasil, Bauru - SP, 17011-204",
      mapUrl:
        "https://maps.google.com/maps?q=Alameda+Dr.+Octávio+Pinheiro+Brisolla+14-55+Bauru+SP&output=embed&z=16",
    },
  ];

  return (
    <section className="py-24 bg-background" id="locations">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground">
            Local de Atendimento
          </h2>
          <p className="text-xl text-muted-foreground">Consultório em {CITY_LINE}</p>
        </div>

        <div className="max-w-3xl mx-auto mb-12">
          {locations.map((location, index) => (
            <Card key={index} className="overflow-hidden border-border hover:shadow-medium transition-shadow">
              <div className="h-64 w-full">
                <iframe
                  src={location.mapUrl}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title={`Mapa ${location.city}`}
                />
              </div>
              <CardContent className="p-6 space-y-4">
                <h3 className="text-2xl font-bold text-foreground flex items-center gap-2">
                  <MapPin className="h-6 w-6 text-primary" />
                  {location.name}
                </h3>
                <p className="text-muted-foreground">{location.address}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <Card className="inline-block border-primary/20 bg-primary/5">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 text-lg">
                <Phone className="h-5 w-5 text-primary" />
                <span className="font-semibold text-foreground">WhatsApp:</span>
                <a
                  href={whatsappHref()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-bold"
                >
                  {WHATSAPP_DISPLAY}
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};
