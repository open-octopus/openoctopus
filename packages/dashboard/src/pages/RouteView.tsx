import { TopologyGraph } from "../components/family/TopologyGraph";
import { useFamilyStore } from "../stores/family";

const PLACEHOLDER_MEMBERS = [
  { id: "grandpa", name: "爷爷", icon: "👴" },
  { id: "dad", name: "爸爸", icon: "👨" },
  { id: "mom", name: "妈妈", icon: "👩" },
  { id: "daughter", name: "女儿", icon: "👧" },
];

const PLACEHOLDER_ROUTES = [
  { from: "grandpa", to: "dad", relevance: "high" as const, pushed: true },
  { from: "grandpa", to: "mom", relevance: "medium" as const, pushed: true },
  { from: "grandpa", to: "daughter", relevance: "low" as const, pushed: false },
];

const RELEVANCE_LABEL = { high: "高相关", medium: "中相关", low: "低相关" } as const;

export function RouteView() {
  const storeMembers = useFamilyStore((s) => s.members);
  const routeEvents = useFamilyStore((s) => s.routeEvents);

  const members =
    storeMembers.length > 0
      ? storeMembers.map((m) => ({ id: m.id, name: m.name, icon: m.avatar ?? "👤" }))
      : PLACEHOLDER_MEMBERS;

  const routes =
    routeEvents.length > 0
      ? routeEvents.flatMap((ev) =>
          ev.targets.map((t) => ({
            from: ev.source.memberId,
            to: t.memberId,
            relevance: t.relevance,
            pushed: t.pushed,
          })),
        )
      : PLACEHOLDER_ROUTES;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <h1 className="text-xl font-bold text-ocean">🔀 消息路由</h1>
      <TopologyGraph members={members} routes={routes} />

      <div className="bg-white rounded-card border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-ocean mb-3">最近路由</h3>
        <div className="space-y-3">
          {routeEvents.length > 0 ? (
            routeEvents.slice(0, 5).map((ev) => (
              <div key={ev.id} className="text-xs space-y-1">
                <p className="font-medium text-gray-800">
                  [{ev.source.message}] {ev.realms.join(", ")}
                </p>
                {ev.targets.map((t) => (
                  <p
                    key={t.memberId}
                    className={`pl-3 ${t.pushed ? "text-gray-600" : "text-gray-400"}`}
                  >
                    → {t.memberId}：{t.summary}（{RELEVANCE_LABEL[t.relevance]}）
                    {!t.pushed && " — 未推送"}
                  </p>
                ))}
              </div>
            ))
          ) : (
            <div className="text-xs space-y-1">
              <p className="font-medium text-gray-800">[爷爷膝盖疼] Health → Finance, Calendar</p>
              <p className="text-gray-600 pl-3">→ 👨 爸爸：就医建议（高相关）</p>
              <p className="text-gray-600 pl-3">→ 👩 妈妈：采购止痛贴（中相关）</p>
              <p className="text-gray-400 pl-3">→ 👧 女儿：未推送（低相关）</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
