import { useFamilyStore } from "../../stores/family";

interface TimelineEvent {
  time: string;
  text: string;
}

const PLACEHOLDER_EVENTS: Array<{ date: string; events: TimelineEvent[] }> = [
  {
    date: "今天",
    events: [
      { time: "10:32", text: "爷爷说膝盖疼 → 已通知爸爸(就医建议)、妈妈(采购)" },
      { time: "08:00", text: "晨间简报已推送给全家" },
    ],
  },
  {
    date: "昨天",
    events: [
      { time: "16:20", text: "女儿春游费 ¥180 → 妈妈已确认转账" },
      { time: "09:15", text: "橘子体重 5.2kg → 正常范围（自动记录）" },
    ],
  },
];

function formatRouteEvent(ev: {
  source: { message: string };
  targets: Array<{ memberId: string; summary: string }>;
}): string {
  const targetTexts = ev.targets.map((t) => `${t.memberId}(${t.summary})`).join("、");
  return `${ev.source.message} → ${targetTexts}`;
}

export function Timeline() {
  const routeEvents = useFamilyStore((s) => s.routeEvents);

  const liveGroups =
    routeEvents.length > 0
      ? [
          {
            date: "最近",
            events: routeEvents.slice(0, 10).map((ev) => ({
              time: new Date(ev.timestamp).toLocaleTimeString("zh-CN", {
                hour: "2-digit",
                minute: "2-digit",
              }),
              text: formatRouteEvent(ev),
            })),
          },
        ]
      : null;

  const groups = liveGroups ?? PLACEHOLDER_EVENTS;

  return (
    <div className="bg-white rounded-card border border-gray-200 p-4">
      <h3 className="text-sm font-medium text-ocean mb-3">📋 家庭时间线</h3>
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.date}>
            <p className="text-xs text-gray-400 mb-1.5">{group.date}</p>
            <div className="space-y-2">
              {group.events.map((event, i) => (
                <div key={i} className="flex gap-2 text-xs">
                  <span className="text-gray-400 shrink-0">{event.time}</span>
                  <span className="text-gray-700">{event.text}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
