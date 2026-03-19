import { useState } from "react";
import { useRealmsStore } from "../stores/realms";
import { EntityCard } from "../components/entity/EntityCard";
import { SoulEditor } from "../components/entity/SoulEditor";

const PLACEHOLDER_REALMS = ["全部", "宠物", "健康", "车辆", "教育"];
const PLACEHOLDER_ENTITIES = [
  { name: "橘子", icon: "🐱", type: "living", realm: "宠物", attributes: ["英短", "3岁", "5.2kg"], memoryCount: 23, healthScore: 85 },
  { name: "爷爷的膝盖", icon: "🦵", type: "abstract", realm: "健康", attributes: ["左膝", "复查中"], memoryCount: 8, healthScore: 60 },
  { name: "家用车", icon: "🚗", type: "asset", realm: "车辆", attributes: ["荣威", "2022款"], memoryCount: 12, healthScore: 75 },
];

const REALM_NAMES: Record<string, string> = {
  health: "健康", finance: "财务", pet: "宠物", education: "教育",
  vehicle: "车辆", household: "家务", legal: "法务", work: "工作",
};

export function Entities() {
  const [filter, setFilter] = useState("全部");
  const [editingEntity, setEditingEntity] = useState<string | null>(null);

  const storeRealms = useRealmsStore((s) => s.realms);
  const storeEntities = useRealmsStore((s) => s.entities);

  const realmFilters = storeRealms.length > 0
    ? ["全部", ...storeRealms.map((r) => r.name)]
    : PLACEHOLDER_REALMS;

  const entities = storeEntities.length > 0
    ? storeEntities.map((e) => {
        const realm = storeRealms.find((r) => r.id === e.realmId);
        return {
          name: e.name,
          icon: e.type === "living" ? "🐾" : e.type === "asset" ? "📦" : "💡",
          type: e.type,
          realm: realm?.name ?? REALM_NAMES[e.realmId] ?? e.realmId,
          attributes: Object.values(e.attributes ?? {}).map(String),
          memoryCount: 0,
          healthScore: 0,
        };
      })
    : PLACEHOLDER_ENTITIES;

  const filtered = filter === "全部" ? entities : entities.filter((e) => e.realm === filter);

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-ocean">🎯 实体管理</h1>
        <button className="bg-cyan text-white px-4 py-2 rounded-xl text-sm hover:bg-cyan/90">
          + 添加实体
        </button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {realmFilters.map((r) => (
          <button
            key={r}
            onClick={() => setFilter(r)}
            className={`px-3 py-1.5 rounded-lg text-xs ${
              filter === r ? "bg-ocean text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map((e) => (
          <div key={e.name}>
            <EntityCard {...e} onEdit={() => setEditingEntity(editingEntity === e.name ? null : e.name)} />
            {editingEntity === e.name && (
              <div className="mt-2 ml-4">
                <SoulEditor name={e.name} tone="活泼好动、偶尔撒娇" traits={["贪吃", "怕打雷", "爱游泳"]} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
