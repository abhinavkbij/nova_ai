import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getJob, updateJob, deleteJob } from "../api/jobs";
import { getTechnicians } from "../api/technicians";
import { StatusBadge, PriorityBadge } from "../components/StatusBadge";

const STATUSES = ["pending", "assigned", "in_progress", "completed", "cancelled"];

export default function JobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [technicians, setTechnicians] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getJob(id).then((r) => { setJob(r.data); setForm(r.data); });
    getTechnicians().then((r) => setTechnicians(r.data));
  }, [id]);

  const save = async () => {
    setSaving(true);
    const updated = await updateJob(id, {
      status: form.status,
      technician_id: form.technician_id || null,
      notes: form.notes,
      priority: form.priority,
    });
    setJob(updated.data);
    setEditing(false);
    setSaving(false);
  };

  const remove = async () => {
    if (!confirm("Delete this job?")) return;
    await deleteJob(id);
    navigate("/jobs");
  };

  if (!job) return <p className="p-6 text-gray-500">Loading...</p>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link to="/jobs" className="text-blue-600 hover:underline text-sm">← Back to Jobs</Link>
      <div className="mt-4 bg-white border rounded-lg p-6 shadow-sm">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-xl font-bold">{job.title}</h1>
            <p className="text-gray-500 text-sm mt-1">{job.description}</p>
          </div>
          <div className="flex gap-2">
            <StatusBadge status={job.status} />
            <PriorityBadge priority={job.priority} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm mb-6">
          <div><span className="font-medium">Customer:</span> {job.customer_name}</div>
          <div><span className="font-medium">Phone:</span> {job.customer_phone || "—"}</div>
          <div className="col-span-2"><span className="font-medium">Address:</span> {job.customer_address}</div>
          <div><span className="font-medium">Technician:</span> {job.technician?.name || "Unassigned"}</div>
          <div><span className="font-medium">Scheduled:</span> {job.scheduled_at ? new Date(job.scheduled_at).toLocaleString() : "—"}</div>
        </div>

        {job.notes && (
          <div className="mb-6">
            <p className="font-medium text-sm mb-1">Notes</p>
            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">{job.notes}</p>
          </div>
        )}

        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                className="border rounded px-3 py-2 text-sm w-full"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Assign Technician</label>
              <select
                className="border rounded px-3 py-2 text-sm w-full"
                value={form.technician_id || ""}
                onChange={(e) => setForm({ ...form, technician_id: e.target.value ? parseInt(e.target.value) : null })}
              >
                <option value="">Unassigned</option>
                {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                className="border rounded px-3 py-2 text-sm w-full"
                rows={3}
                value={form.notes || ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={save} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
                {saving ? "Saving..." : "Save"}
              </button>
              <button onClick={() => setEditing(false)} className="bg-gray-100 px-4 py-2 rounded text-sm">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setEditing(true)} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
              Edit Job
            </button>
            <button onClick={remove} className="bg-red-50 text-red-600 px-4 py-2 rounded text-sm hover:bg-red-100">
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
