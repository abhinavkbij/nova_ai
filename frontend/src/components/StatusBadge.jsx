const STATUS_STYLES = {
  pending: "bg-yellow-100 text-yellow-800",
  assigned: "bg-blue-100 text-blue-800",
  in_progress: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-600",
};

const PRIORITY_STYLES = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

export function StatusBadge({ status }) {
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_STYLES[status] || ""}`}>
      {status?.replace("_", " ")}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${PRIORITY_STYLES[priority] || ""}`}>
      {priority}
    </span>
  );
}
