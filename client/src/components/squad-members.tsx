import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Circle } from "lucide-react";
import CustomDisclaimer from "@/components/ui/custom-disclaimer";

const squadMembers = [
  { name: "Analista de Dados", icon: "📈", color: "bg-blue-500" },
  { name: "QA", icon: "✅", color: "bg-green-500" },
  { name: "Scrum Master", icon: "🧝", color: "bg-purple-500" },
  { name: "UX Designer", icon: "🎨", color: "bg-pink-500" },
  { name: "Tech Lead", icon: "💧", color: "bg-cyan-500" },
  { name: "Product Manager", icon: "📋", color: "bg-orange-500" },
];

export function SquadMembers() {
  return (
    <Card className="shadow-sm">
      <CardHeader className="border-b border-border">
        <CardTitle className="flex items-center space-x-2">
          <Users className="text-primary" size={20} />
          <span>Squad Ativa</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {/* Disclaimer sobre colaboração dos agentes */}
        <CustomDisclaimer
          title="Como os agentes colaboram"
          variant="note"
          className="mb-4"
        >
          <p className="text-sm">
            Cada agente contribui com sua especialidade para refinar sua demanda.
            Eles trabalham em conjunto para garantir que todas as perspectivas
            importantes sejam consideradas antes da geração dos documentos finais.
          </p>
        </CustomDisclaimer>

        <div className="space-y-3">
          {squadMembers.map((member, index) => (
            <div key={index} className="flex items-center space-x-3">
              <div className={`w-8 h-8 ${member.color} rounded-full flex items-center justify-center`}>
                <span className="text-white text-sm font-medium">{member.icon}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{member.name}</p>
                <div className="flex items-center space-x-1">
                  <Circle className="w-2 h-2 text-green-500 fill-current" />
                  <p className="text-xs text-muted-foreground">Online</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
