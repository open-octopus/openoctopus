interface EntityCardProps {
  name: string;
  type: string;
  realm: string;
  icon: string;
  attributes: string[];
  memoryCount: number;
  healthScore: number;
  onEdit?: () => void;
}

export function EntityCard({
  name,
  icon,
  type,
  realm,
  attributes,
  memoryCount,
  healthScore,
  onEdit,
}: EntityCardProps) {
  return (
    <div className="bg-white rounded-card border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <div>
            <p className="font-medium text-ocean">{name}</p>
            <p className="text-xs text-gray-400">
              {type} · {realm}
            </p>
          </div>
        </div>
        <div className="text-right text-xs">
          <p className="text-gray-400">{memoryCount} 条记忆</p>
          <p className={healthScore >= 80 ? "text-green-600" : "text-orange-500"}>
            健康分 {healthScore}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {attributes.map((attr) => (
          <span key={attr} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {attr}
          </span>
        ))}
      </div>
      {onEdit && (
        <button onClick={onEdit} className="mt-3 text-xs text-cyan hover:underline">
          编辑
        </button>
      )}
    </div>
  );
}
