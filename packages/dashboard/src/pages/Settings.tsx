export function Settings() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      <h1 className="text-xl font-bold text-ocean">⚙️ 设置</h1>

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
          {[
            { name: "微信小程序", status: true },
            { name: "Telegram Bot", status: true },
            { name: "Discord", status: false },
          ].map((ch) => (
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
