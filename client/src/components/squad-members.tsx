import { Users } from "lucide-react";

const squadMembers = [
  { name: "Analista de Dados", icon: "📈", color: "var(--accent-orange)", code: "DATA" },
  { name: "QA", icon: "✅", color: "var(--success)", code: "QA" },
  { name: "Scrum Master", icon: "🧝", color: "var(--accent-lime)", code: "SM" },
  { name: "UX Designer", icon: "🎨", color: "var(--accent-magenta)", code: "UX" },
  { name: "Tech Lead", icon: "💧", color: "var(--accent-cyan)", code: "TECH" },
  { name: "Product Manager", icon: "📋", color: "var(--accent-gold)", code: "PM" },
];

export function SquadMembers() {
  return (
    <div className="neo-card">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b-2 border-[var(--border)] bg-[var(--muted)]">
        <div className="w-8 h-8 bg-[var(--accent-violet)] flex items-center justify-center">
          <Users className="w-4 h-4 text-[var(--background)]" />
        </div>
        <span className="font-mono text-sm font-bold">SQUAD ATIVA</span>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Info Banner */}
        <div className="border-l-4 border-[var(--accent-violet)] bg-[var(--muted)] p-3 mb-4">
          <p className="font-mono text-xs text-[var(--foreground-muted)]">
            Cada agente contribui com expertise especializada para o refinamento da sua demanda.
          </p>
        </div>

        {/* Agent Grid */}
        <div className="grid grid-cols-2 gap-2">
          {squadMembers.map((member, index) => (
            <div
              key={index}
              className="group p-3 border border-[var(--border)] hover:border-current transition-colors cursor-default"
              style={{ '--hover-color': member.color } as React.CSSProperties}
            >
              <div className="flex items-center gap-2">
                {/* Avatar */}
                <div
                  className="w-8 h-8 flex items-center justify-center border-2 text-lg"
                  style={{ borderColor: member.color }}
                >
                  {member.icon}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p
                    className="font-mono text-[10px] font-bold truncate"
                    style={{ color: member.color }}
                  >
                    {member.code}
                  </p>
                  <div className="flex items-center gap-1">
                    <div className="status-dot online w-1.5 h-1.5" />
                    <span className="font-mono text-[9px] text-[var(--foreground-muted)]">ONLINE</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Stats */}
        <div className="mt-4 pt-3 border-t border-[var(--border)]">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="text-[var(--foreground-muted)]">AGENTES ATIVOS</span>
            <span className="brutal-badge cyan">
              <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" />
              {squadMembers.length}/6
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
