import { useState } from "react";

interface SoulEditorProps {
  name: string;
  tone: string;
  traits: string[];
  onSave?: (data: { tone: string; traits: string[] }) => void;
}

export function SoulEditor({ name, tone: initialTone, traits: initialTraits, onSave }: SoulEditorProps) {
  const [tone, setTone] = useState(initialTone);
  const [traits, setTraits] = useState(initialTraits.join(", "));

  return (
    <div className="bg-white rounded-card border border-gray-200 p-4 space-y-3">
      <h3 className="text-sm font-medium text-ocean">✨ {name} 的性格设置</h3>
      <div>
        <label className="block text-xs text-gray-500 mb-1">语气风格</label>
        <input
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          placeholder="例：活泼好动、偶尔撒娇"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">性格特征（逗号分隔）</label>
        <input
          value={traits}
          onChange={(e) => setTraits(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          placeholder="例：贪吃, 怕打雷, 爱游泳"
        />
      </div>
      <button
        onClick={() => onSave?.({ tone, traits: traits.split(",").map((t) => t.trim()).filter(Boolean) })}
        className="bg-cyan text-white px-4 py-1.5 rounded-lg text-sm hover:bg-cyan/90"
      >
        保存
      </button>
    </div>
  );
}
