interface RealmCardProps {
  name: string;
  icon: string;
  lines: string[];
  alert?: boolean;
}

export function RealmCard({ name, icon, lines, alert }: RealmCardProps) {
  return (
    <div
      className={`bg-white rounded-card p-4 border transition-shadow hover:shadow-md ${
        alert ? "border-orange-300" : "border-gray-200"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="font-medium text-ocean text-sm">{name}</span>
        {alert && <span className="text-orange-500 text-xs">⚠️</span>}
      </div>
      <div className="space-y-1">
        {lines.map((line, i) => (
          <p key={i} className="text-xs text-gray-600 truncate">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
