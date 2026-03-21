import { ReactFlow, type Node, type Edge, Position, Background } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

interface TopologyProps {
  members: Array<{ id: string; name: string; icon: string }>;
  routes?: Array<{ from: string; to: string; relevance: "high" | "medium" | "low"; pushed: boolean }>;
}

export function TopologyGraph({ members, routes = [] }: TopologyProps) {
  const centerX = 300;
  const centerY = 200;
  const radius = 150;

  const hubNode: Node = {
    id: "hub",
    data: { label: "\u{1F419} \u7BA1\u5BB6" },
    position: { x: centerX - 40, y: centerY - 20 },
    style: {
      background: "#00D4AA",
      color: "white",
      borderRadius: "16px",
      padding: "8px 16px",
      fontWeight: "bold",
      border: "none",
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  };

  const memberNodes: Node[] = members.map((m, i) => {
    const angle = (2 * Math.PI * i) / members.length - Math.PI / 2;
    return {
      id: m.id,
      data: { label: `${m.icon} ${m.name}` },
      position: {
        x: centerX + radius * Math.cos(angle) - 40,
        y: centerY + radius * Math.sin(angle) - 15,
      },
      style: {
        background: "white",
        borderRadius: "12px",
        padding: "6px 12px",
        border: "1px solid #e5e7eb",
        fontSize: "13px",
      },
    };
  });

  const edges: Edge[] = members.map((m) => {
    const route = routes.find((r) => r.to === m.id);
    return {
      id: `hub-${m.id}`,
      source: "hub",
      target: m.id,
      style: {
        stroke: route?.pushed ? (route.relevance === "high" ? "#00D4AA" : "#94a3b8") : "#e5e7eb",
        strokeWidth: route?.pushed ? 2 : 1,
        strokeDasharray: route?.pushed ? undefined : "5,5",
      },
      animated: route?.pushed ?? false,
    };
  });

  return (
    <div className="w-full h-80 bg-white rounded-card border border-gray-200">
      <ReactFlow
        nodes={[hubNode, ...memberNodes]}
        edges={edges}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
      </ReactFlow>
    </div>
  );
}
