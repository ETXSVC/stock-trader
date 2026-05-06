import { useEffect, useState } from "react";
import { api } from "../api/client";

type Priority = "low" | "medium" | "high";
type Filter = "all" | "pending" | "done";

interface Task {
  id: number;
  title: string;
  description: string;
  priority: Priority;
  due_date: string | null;
  completed: boolean;
  created_at: string;
}

const PRIORITY_COLOR: Record<Priority, string> = {
  high: "#ef5350",
  medium: "#ffa726",
  low: "#66bb6a",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  high: "High",
  medium: "Med",
  low: "Low",
};

export function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const data = await api.getTasks();
      setTasks(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const task = await api.createTask({
        title: title.trim(),
        description: description.trim(),
        priority,
        due_date: dueDate || undefined,
      });
      setTasks((prev) => [task, ...prev]);
      setTitle("");
      setDescription("");
      setPriority("medium");
      setDueDate("");
      setShowForm(false);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function toggleComplete(task: Task) {
    try {
      const updated = await api.updateTask(task.id, { completed: !task.completed });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleDelete(id: number) {
    try {
      await api.deleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
  }

  const visible = tasks.filter((t) => {
    if (filter === "pending") return !t.completed;
    if (filter === "done") return t.completed;
    return true;
  });

  const pending = tasks.filter((t) => !t.completed).length;

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Tasks</h2>
          <span style={{ fontSize: 13, color: "#888" }}>{pending} pending</span>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          style={{
            background: "#1a1a2e", color: "#fff", border: "none", borderRadius: 24,
            padding: "10px 20px", fontSize: 15, fontWeight: 600, cursor: "pointer",
          }}
        >
          {showForm ? "Cancel" : "+ Add"}
        </button>
      </div>

      {error && (
        <div style={{ background: "#ffebee", color: "#c62828", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 14 }}>
          {error}
          <button onClick={() => setError("")} style={{ float: "right", background: "none", border: "none", cursor: "pointer", color: "#c62828" }}>✕</button>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} style={{
          background: "#fff", borderRadius: 12, padding: 16, marginBottom: 16,
          boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
        }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title *"
            required
            style={inputStyle}
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            style={inputStyle}
          />
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {(["low", "medium", "high"] as Priority[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 8, border: "2px solid",
                  borderColor: priority === p ? PRIORITY_COLOR[p] : "#ddd",
                  background: priority === p ? PRIORITY_COLOR[p] + "22" : "#fff",
                  color: priority === p ? PRIORITY_COLOR[p] : "#888",
                  fontWeight: 600, fontSize: 13, cursor: "pointer",
                }}
              >
                {PRIORITY_LABEL[p]}
              </button>
            ))}
          </div>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            style={{ ...inputStyle, marginBottom: 12 }}
          />
          <button
            type="submit"
            style={{
              width: "100%", padding: 12, background: "#1a1a2e", color: "#fff",
              border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer",
            }}
          >
            Add Task
          </button>
        </form>
      )}

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12, background: "#e9e9ee", borderRadius: 10, padding: 4 }}>
        {(["all", "pending", "done"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              flex: 1, padding: "8px 0", borderRadius: 7, border: "none",
              background: filter === f ? "#fff" : "transparent",
              color: filter === f ? "#1a1a2e" : "#777",
              fontWeight: filter === f ? 700 : 500,
              fontSize: 14, cursor: "pointer",
              boxShadow: filter === f ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Task list */}
      {loading ? (
        <div style={{ textAlign: "center", color: "#aaa", padding: 40 }}>Loading…</div>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: "center", color: "#bbb", padding: 40, fontSize: 15 }}>
          {filter === "done" ? "No completed tasks." : "No tasks yet — add one above!"}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visible.map((task) => (
            <div
              key={task.id}
              style={{
                background: "#fff", borderRadius: 12, padding: "14px 16px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                display: "flex", alignItems: "flex-start", gap: 12,
                opacity: task.completed ? 0.6 : 1,
              }}
            >
              {/* Checkbox */}
              <button
                onClick={() => toggleComplete(task)}
                style={{
                  width: 26, height: 26, borderRadius: "50%", border: "2px solid",
                  borderColor: task.completed ? "#66bb6a" : "#ccc",
                  background: task.completed ? "#66bb6a" : "#fff",
                  cursor: "pointer", flexShrink: 0, marginTop: 1,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, color: "#fff",
                }}
              >
                {task.completed ? "✓" : ""}
              </button>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{
                    fontSize: 15, fontWeight: 600,
                    textDecoration: task.completed ? "line-through" : "none",
                    color: task.completed ? "#aaa" : "#1a1a2e",
                    wordBreak: "break-word",
                  }}>
                    {task.title}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 10,
                    background: PRIORITY_COLOR[task.priority] + "22",
                    color: PRIORITY_COLOR[task.priority],
                  }}>
                    {PRIORITY_LABEL[task.priority]}
                  </span>
                </div>
                {task.description && (
                  <div style={{ fontSize: 13, color: "#666", marginTop: 3, wordBreak: "break-word" }}>
                    {task.description}
                  </div>
                )}
                {task.due_date && (
                  <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
                    Due: {task.due_date}
                  </div>
                )}
              </div>

              {/* Delete */}
              <button
                onClick={() => handleDelete(task.id)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#ccc", fontSize: 18, padding: "0 2px", flexShrink: 0,
                  lineHeight: 1,
                }}
                title="Delete"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: "1px solid #ddd", fontSize: 15, marginBottom: 10,
  boxSizing: "border-box", outline: "none",
};
