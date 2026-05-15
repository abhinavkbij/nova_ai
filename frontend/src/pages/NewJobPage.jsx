import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createJob } from "../api/jobs";
import { getTechnicians } from "../api/technicians";

export default function NewJobPage() {
  const navigate = useNavigate();
  const [technicians, setTechnicians] = useState([]);
  const [form, setForm] = useState({
    title: "", description: "", customer_name: "", customer_address: "",
    customer_phone: "", priority: "medium", technician_id: "", scheduled_at: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { getTechnicians().then((r) => setTechnicians(r.data)); }, []);

  const field = (name, label, type = "text", required = false) => (
    <div>
      <label className="block text-sm font-medium mb-1">{label}{required && " *"}</label>
      <input
        type={type}
        required={required}
        className="border rounded px-3 py-2 text-sm w-full"
        value={form[name]}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
      />
    </div>
  );

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        technician_id: form.technician_id ? parseInt(form.technician_id) : null,
        scheduled_at: form.scheduled_at || null,
      };
      const res = await createJob(payload);
      navigate(`/jobs/${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create job");
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <Link to="/jobs" className="text-blue-600 hover:underline text-sm">← Back to Jobs</Link>
      <h1 className="text-xl font-bold mt-4 mb-6">New Job</h1>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <form onSubmit={submit} className="space-y-4">
        {field("title", "Title", "text", true)}
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea className="border rounded px-3 py-2 text-sm w-full" rows={2}
            value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        {field("customer_name", "Customer Name", "text", true)}
        {field("customer_address", "Customer Address", "text", true)}
        {field("customer_phone", "Customer Phone")}
        <div>
          <label className="block text-sm font-medium mb-1">Priority</label>
          <select className="border rounded px-3 py-2 text-sm w-full"
            value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            {["low", "medium", "high", "urgent"].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Assign Technician</label>
          <select className="border rounded px-3 py-2 text-sm w-full"
            value={form.technician_id} onChange={(e) => setForm({ ...form, technician_id: e.target.value })}>
            <option value="">Unassigned</option>
            {technicians.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.specialty || "General"}</option>)}
          </select>
        </div>
        {field("scheduled_at", "Scheduled Date/Time", "datetime-local")}
        <div>
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea className="border rounded px-3 py-2 text-sm w-full" rows={3}
            value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 w-full">
          {saving ? "Creating..." : "Create Job"}
        </button>
      </form>
    </div>
  );
}
