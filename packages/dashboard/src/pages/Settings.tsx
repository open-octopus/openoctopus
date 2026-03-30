import { useFamilyStore } from "../stores/family";
import { useGatewayStore } from "../stores/gateway";
import { useRealmsStore } from "../stores/realms";

const STATUS_LABEL = {
  connected: "✅ 已连接",
  connecting: "🔄 连接中…",
  disconnected: "⬜ 未连接",
  error: "❌ 连接错误",
} as const;

const PLACEHOLDER_CHANNELS = [
  { name: "微信小程序", status: true },
  { name: "Telegram Bot", status: true },
  { name: "Discord", status: false },
];

export function Settings() {
  const { status, url, error } = useGatewayStore();
  const realmCount = useRealmsStore((s) => s.realms.length);
  const entityCount = useRealmsStore((s) => s.entities.length);
  const memberCount = useFamilyStore((s) => s.members.length);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      <h1 className="text-xl font-bold text-ocean">⚙️ 设置</h1>

      {/* Gateway Connection */}
      <section className="bg-white rounded-card border border-gray-200 p-4">
        <h2 className="text-sm font-medium text-ocean mb-3">🌐 网关连接</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">网关地址</span>
            <span className="text-ocean font-mono text-xs">{url}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">状态</span>
            <span
              className={
                status === "connected"
                  ? "text-green-600"
                  : status === "error"
                    ? "text-red-500"
                    : "text-gray-400"
              }
            >
              {STATUS_LABEL[status]}
            </span>
          </div>
          {error && <div className="text-xs text-red-500 bg-red-50 rounded p-2">{error}</div>}
          <div className="flex justify-between items-center">
            <span className="text-gray-600">数据概览</span>
            <span className="text-gray-500 text-xs">
              {realmCount} 个领域 · {entityCount} 个实体 · {memberCount} 个成员
            </span>
          </div>
        </div>
      </section>

      {/* AI Model */}
      <section className="bg-white rounded-card border border-gray-200 p-4">
        <h2 className="text-sm font-medium text-ocean mb-3">🤖 AI 模型</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">当前模型</span>
            <span className="text-ocean font-medium">Claude Sonnet 4</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">API Key</span>
            <span className="text-gray-400 font-mono text-xs">sk-ant-•••••••el3</span>
          </div>
        </div>
      </section>

      {/* Channels */}
      <section className="bg-white rounded-card border border-gray-200 p-4">
        <h2 className="text-sm font-medium text-ocean mb-3">📱 通道连接</h2>
        <div className="space-y-2">
          {PLACEHOLDER_CHANNELS.map((ch) => (
            <div key={ch.name} className="flex justify-between items-center text-sm">
              <span className="text-gray-600">{ch.name}</span>
              <span className={ch.status ? "text-green-600" : "text-gray-400"}>
                {ch.status ? "✅ 已连接" : "⬜ 未连接"}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Notifications */}
      <section className="bg-white rounded-card border border-gray-200 p-4">
        <h2 className="text-sm font-medium text-ocean mb-3">🔔 通知策略</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">晨间简报</span>
            <span className="text-ocean">每天 08:00</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">最大推送频率</span>
            <span className="text-ocean">每小时 3 条</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">免打扰时段</span>
            <span className="text-ocean">22:00 - 07:00</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">紧急事件</span>
            <span className="text-red-500 text-xs">始终推送</span>
          </div>
        </div>
      </section>

      {/* Data */}
      <section className="bg-white rounded-card border border-gray-200 p-4">
        <h2 className="text-sm font-medium text-ocean mb-3">💾 数据</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">存储位置</span>
            <span className="text-ocean">本地 (SQLite)</span>
          </div>
          <button className="text-cyan text-xs hover:underline">导出家庭数据</button>
        </div>
      </section>
    </div>
  );
}
