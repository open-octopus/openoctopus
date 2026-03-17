import { RealmCard } from "./RealmCard";

const PLACEHOLDER_REALMS = [
  { name: "健康", icon: "🏥", lines: ["爷爷膝盖待复查", "降压药剩 5 天"], alert: true },
  { name: "财务", icon: "💰", lines: ["本月 ¥8,240", "预算剩 ¥3,760"] },
  { name: "宠物", icon: "🐱", lines: ["橘子：驱虫 3/24", "体重 5.2kg 正常"] },
  { name: "教育", icon: "📚", lines: ["春游费 ✅ 已交", "舞蹈课 周二"] },
  { name: "车辆", icon: "🚗", lines: ["保养还剩 1200km", "车险 4/15 到期"] },
  { name: "家务", icon: "🏠", lines: ["洗衣液快用完", "猫粮剩 3 天"] },
];

export function RealmGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {PLACEHOLDER_REALMS.map((r) => (
        <RealmCard key={r.name} {...r} />
      ))}
    </div>
  );
}
