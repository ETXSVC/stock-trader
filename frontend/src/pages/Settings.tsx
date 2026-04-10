import { useState, useEffect } from "react";
import { api } from "../api/client";

const section = { background: "#fff", borderRadius: 8, padding: 16, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" };
const inp = { padding: "6px 10px", border: "1px solid #ddd", borderRadius: 4 };
const btn = (color = "#1976d2") => ({ padding: "6px 16px", background: color, color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" as const });
const td = { padding: "6px 10px", borderBottom: "1px solid #eee", fontSize: 13 };

function fmtUtc(hour: number, minute: number) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} UTC`;
}

function fmtEt(hour: number, minute: number) {
  // UTC → ET offset: ET is UTC-5 (EST) or UTC-4 (EDT). Use -4 as approximation for EDT.
  const etOffset = -4;
  let h = ((hour + etOffset) % 24 + 24) % 24;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${ampm} ET`;
}

function SchedulesSection() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [label, setLabel] = useState("");
  const [sampleType, setSampleType] = useState("mid");
  const [hour, setHour] = useState(13);
  const [minute, setMinute] = useState(30);
  const [editId, setEditId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editSampleType, setEditSampleType] = useState("mid");
  const [editHour, setEditHour] = useState(0);
  const [editMinute, setEditMinute] = useState(0);

  const load = () => api.getSchedules()
    .then(jobs => setJobs([...jobs].sort((a, b) => a.hour !== b.hour ? a.hour - b.hour : a.minute - b.minute)))
    .catch(() => {});
  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createSchedule({ label, sample_type: sampleType, hour, minute });
    setLabel(""); setSampleType("mid"); setHour(13); setMinute(30);
    load();
  };

  const handleSaveEdit = async (id: number) => {
    await api.updateSchedule(id, { label: editLabel, sample_type: editSampleType, hour: editHour, minute: editMinute });
    setEditId(null);
    load();
  };

  const startEdit = (job: any) => {
    setEditId(job.id);
    setEditLabel(job.label);
    setEditSampleType(job.sample_type);
    setEditHour(job.hour);
    setEditMinute(job.minute);
  };

  return (
    <div style={section}>
      <h3 style={{ marginTop: 0 }}>Scheduled Pulls</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
        <thead>
          <tr>
            {["Label", "Sample Type", "Time (UTC)", "Time (ET)", "Enabled", "Actions"].map(h => (
              <th key={h} style={{ ...td, borderBottom: "2px solid #ddd", fontWeight: 600, background: "#fafafa", textAlign: "left" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {jobs.length === 0 && (
            <tr><td colSpan={6} style={{ ...td, color: "#999", textAlign: "center" }}>No scheduled jobs</td></tr>
          )}
          {jobs.map((job) => editId === job.id ? (
            <tr key={job.id} style={{ background: "#f5f9ff" }}>
              <td style={td}><input value={editLabel} onChange={e => setEditLabel(e.target.value)} style={{ ...inp, width: 120 }} /></td>
              <td style={td}>
                <select value={editSampleType} onChange={e => setEditSampleType(e.target.value)} style={inp}>
                  <option value="open">Open</option>
                  <option value="mid">Midday</option>
                  <option value="close">Close</option>
                  <option value="custom">Custom</option>
                </select>
              </td>
              <td style={td}>
                <input type="number" min={0} max={23} value={editHour} onChange={e => setEditHour(+e.target.value)} style={{ ...inp, width: 50 }} />
                {" : "}
                <input type="number" min={0} max={59} value={editMinute} onChange={e => setEditMinute(+e.target.value)} style={{ ...inp, width: 50 }} />
              </td>
              <td style={td}>{fmtEt(editHour, editMinute)}</td>
              <td style={td} />
              <td style={td}>
                <button onClick={() => handleSaveEdit(job.id)} style={{ ...btn(), marginRight: 6, fontSize: 12, padding: "4px 10px" }}>Save</button>
                <button onClick={() => setEditId(null)} style={{ ...btn("#666"), fontSize: 12, padding: "4px 10px" }}>Cancel</button>
              </td>
            </tr>
          ) : (
            <tr key={job.id}>
              <td style={{ ...td, fontWeight: 600 }}>{job.label}</td>
              <td style={td}>{job.sample_type}</td>
              <td style={td}>{fmtUtc(job.hour, job.minute)}</td>
              <td style={td}>{fmtEt(job.hour, job.minute)}</td>
              <td style={td}>
                <button
                  onClick={() => api.updateSchedule(job.id, { enabled: !job.enabled }).then(load)}
                  style={{ background: job.enabled ? "#2e7d32" : "#999", color: "#fff", border: "none", borderRadius: 4, padding: "2px 10px", cursor: "pointer", fontSize: 12 }}>
                  {job.enabled ? "ON" : "OFF"}
                </button>
              </td>
              <td style={td}>
                <button onClick={() => startEdit(job)} style={{ background: "none", border: "none", color: "#1976d2", cursor: "pointer", fontSize: 12, marginRight: 8 }}>Edit</button>
                <button onClick={() => api.deleteSchedule(job.id).then(load)} style={{ background: "none", border: "none", color: "#c62828", cursor: "pointer", fontSize: 12 }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 style={{ marginTop: 0, marginBottom: 10 }}>Add Schedule</h4>
      <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input placeholder="Label (e.g. Pre-Market)" value={label} onChange={e => setLabel(e.target.value)} style={{ ...inp, width: 160 }} required />
        <select value={sampleType} onChange={e => setSampleType(e.target.value)} style={inp}>
          <option value="open">Open</option>
          <option value="mid">Midday</option>
          <option value="close">Close</option>
          <option value="custom">Custom</option>
        </select>
        <label style={{ fontSize: 13 }}>
          Hour (UTC):&nbsp;
          <input type="number" min={0} max={23} value={hour} onChange={e => setHour(+e.target.value)} style={{ ...inp, width: 55 }} required />
        </label>
        <label style={{ fontSize: 13 }}>
          Minute:&nbsp;
          <input type="number" min={0} max={59} value={minute} onChange={e => setMinute(+e.target.value)} style={{ ...inp, width: 55 }} required />
        </label>
        <span style={{ fontSize: 12, color: "#666" }}>= {fmtEt(hour, minute)}</span>
        <button type="submit" style={btn()}>Add</button>
      </form>
    </div>
  );
}

export function Settings() {
  const [stocks, setStocks] = useState<any[]>([]);
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [sampleType, setSampleType] = useState("mid");
  const [triggerStatus, setTriggerStatus] = useState("");
  const [initStatus, setInitStatus] = useState("");
  const [exportTickers, setExportTickers] = useState("");
  const [exportStart, setExportStart] = useState("");
  const [exportEnd, setExportEnd] = useState("");

  const loadStocks = () => api.getStocks().then(setStocks).catch(() => {});
  useEffect(() => { loadStocks(); }, []);

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createStock({ ticker, name, sector });
    setTicker(""); setName(""); setSector("");
    loadStocks();
  };

  return (
    <div>
      <h1>Settings</h1>
      <div style={section}>
        <h3 style={{ marginTop: 0 }}>Initialize S&P 500</h3>
        <button style={btn()} onClick={async () => { setInitStatus("Loading..."); const r = await api.initSp500(); setInitStatus(r.detail); loadStocks(); }}>
          Load S&P 500 Stocks
        </button>
        {initStatus && <span style={{ marginLeft: 12, color: "#666" }}>{initStatus}</span>}
      </div>
      <div style={section}>
        <h3 style={{ marginTop: 0 }}>Manual Sample Trigger</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={sampleType} onChange={(e) => setSampleType(e.target.value)} style={inp}>
            <option value="open">Open</option>
            <option value="mid">Midday</option>
            <option value="close">Close</option>
          </select>
          <button style={btn()} onClick={async () => { setTriggerStatus("Running in background..."); const r = await api.triggerSample(sampleType); setTriggerStatus(r.detail); }}>
            Run Sample Now
          </button>
          {triggerStatus && <span style={{ color: "#666" }}>{triggerStatus}</span>}
        </div>
      </div>
      <SchedulesSection />
      <div style={section}>
        <h3 style={{ marginTop: 0 }}>Export CSV</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input placeholder="Tickers (comma-separated)" value={exportTickers} onChange={(e) => setExportTickers(e.target.value)} style={{ ...inp, width: 200 }} />
          <input type="date" value={exportStart} onChange={(e) => setExportStart(e.target.value)} style={inp} />
          <input type="date" value={exportEnd} onChange={(e) => setExportEnd(e.target.value)} style={inp} />
          <button style={btn()} onClick={() => {
            const params: Record<string, string> = {};
            if (exportTickers) params.tickers = exportTickers;
            if (exportStart) params.start_date = exportStart;
            if (exportEnd) params.end_date = exportEnd;
            window.open(api.exportCsvUrl(params), "_blank");
          }}>Download CSV</button>
        </div>
      </div>
      <div style={section}>
        <h3 style={{ marginTop: 0 }}>Add Custom Ticker</h3>
        <form onSubmit={handleAddStock} style={{ display: "flex", gap: 8 }}>
          <input placeholder="Ticker" value={ticker} onChange={(e) => setTicker(e.target.value)} style={inp} required />
          <input placeholder="Company Name" value={name} onChange={(e) => setName(e.target.value)} style={{ ...inp, flex: 1 }} required />
          <input placeholder="Sector" value={sector} onChange={(e) => setSector(e.target.value)} style={inp} />
          <button type="submit" style={btn()}>Add</button>
        </form>
      </div>
      <div style={section}>
        <h3 style={{ marginTop: 0 }}>Managed Stocks ({stocks.length})</h3>
        <div style={{ overflowX: "auto", maxHeight: 400, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>{["Ticker","Name","Sector","Source","Active","Actions"].map(h => (
                <th key={h} style={{ ...td, borderBottom: "2px solid #ddd", fontWeight: 600, background: "#fafafa" }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {stocks.map((s) => (
                <tr key={s.id}>
                  <td style={{ ...td, fontWeight: 600 }}>{s.ticker}</td>
                  <td style={td}>{s.name}</td>
                  <td style={td}>{s.sector}</td>
                  <td style={td}>{s.source}</td>
                  <td style={td}>
                    <button onClick={async () => { await api.updateStock(s.id, { active: !s.active }); loadStocks(); }}
                      style={{ background: s.active ? "#2e7d32" : "#999", color: "#fff", border: "none", borderRadius: 4, padding: "2px 10px", cursor: "pointer", fontSize: 12 }}>
                      {s.active ? "ON" : "OFF"}
                    </button>
                  </td>
                  <td style={td}>
                    {s.source === "custom" && (
                      <button onClick={async () => { await api.deleteStock(s.id); loadStocks(); }}
                        style={{ background: "none", border: "none", color: "#c62828", cursor: "pointer", fontSize: 12 }}>Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
