interface MemberCardProps {
  name: string;
  icon: string;
  role: string;
  channels: string[];
  watchedRealms: string[];
}

const ROLE_LABELS: Record<string, string> = {
  owner: "管理员",
  adult: "成人",
  child: "儿童",
  elder: "老人",
};

export function MemberCard({ name, icon, role, channels, watchedRealms }: MemberCardProps) {
  return (
    <div className="bg-white rounded-card border border-gray-200 p-4">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">{icon}</span>
        <div>
          <p className="font-medium text-ocean">{name}</p>
          <p className="text-xs text-gray-500">{ROLE_LABELS[role] ?? role}</p>
        </div>
      </div>
      <div className="space-y-2 text-xs">
        <div>
          <span className="text-gray-400">通道：</span>
          {channels.map((c) => (
            <span key={c} className="inline-block bg-green-50 text-green-700 px-1.5 py-0.5 rounded mr-1">
              {c} ✅
            </span>
          ))}
        </div>
        <div>
          <span className="text-gray-400">关注域：</span>
          <span className="text-gray-600">{watchedRealms.join("、")}</span>
        </div>
      </div>
      <button className="mt-3 text-xs text-cyan hover:underline">编辑</button>
    </div>
  );
}
