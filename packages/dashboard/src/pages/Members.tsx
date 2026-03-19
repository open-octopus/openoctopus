import { useFamilyStore } from "../stores/family";
import { MemberCard } from "../components/family/MemberCard";

const PLACEHOLDER_MEMBERS = [
  { name: "爸爸（王明）", icon: "👨", role: "adult", channels: ["微信", "Telegram"], watchedRealms: ["健康", "财务", "车辆", "工作"] },
  { name: "妈妈（李雪）", icon: "👩", role: "owner", channels: ["微信"], watchedRealms: ["全部"] },
  { name: "爷爷（王德）", icon: "👴", role: "elder", channels: ["微信"], watchedRealms: ["健康"] },
  { name: "女儿（王小雪）", icon: "👧", role: "child", channels: ["微信"], watchedRealms: ["教育"] },
];

export function Members() {
  const storeMembers = useFamilyStore((s) => s.members);

  const members = storeMembers.length > 0
    ? storeMembers.map((m) => ({
        name: m.name,
        icon: m.avatar ?? "👤",
        role: m.role,
        channels: m.channels,
        watchedRealms: m.watchedRealms,
      }))
    : PLACEHOLDER_MEMBERS;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-ocean">👥 家庭成员</h1>
        <button className="bg-cyan text-white px-4 py-2 rounded-xl text-sm hover:bg-cyan/90">
          + 邀请成员
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {members.map((m) => (
          <MemberCard key={m.name} {...m} />
        ))}
      </div>
    </div>
  );
}
