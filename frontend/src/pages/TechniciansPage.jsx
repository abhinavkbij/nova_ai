import { useEffect, useState } from "react";
import { getTechnicians, createTechnician, deleteTechnician } from "../api/technicians";

export default function TechniciansPage() {
  const [technicians, setTechnicians] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", specialty: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = () => getTechnicians().then((r) => setTechnicians(r.data));
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createTechnician(form);
      setForm({ name: "", email: "", phone: "", specialty: "" });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create technician");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id, name) => {
    if (!confirm(`Delete ${name}?`)) return;
    await deleteTechnician(id);
    load();
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Technicians</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">
          {showForm ? "Cancel" : "+ Add Technician"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-gray-50 border rounded-lg p-4 mb-6 space-y-3">
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {[["name", "Name", true], ["email", "Email", true], ["phone", "Phone", false], ["specialty", "Specialty", false]].map(
            ([name, label, required]) => (
              <div key={name}>
                <label className="block text-sm font-medium mb-1">{label}{required && " *"}</label>
                <input
                  type={name === "email" ? "email" : "text"}
                  required={required}
                  className="border rounded px-3 py-2 text-sm w-full"
                  value={form[name]}
                  onChange={(e) => setForm({ ...form, [name]: e.target.value })}
                />
              </div>
            )
          )}
          <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
            {saving ? "Saving..." : "Add Technician"}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {technicians.length === 0 && <p className="text-gray-400 text-sm">No technicians yet.</p>}
        {technicians.map((t) => (
          <div key={t.id} className="flex justify-between items-center bg-white border rounded-lg p-4 shadow-sm">
            <div>
              <p className="font-medium">{t.name}</p>
              <p className="text-sm text-gray-500">{t.email} {t.phone && `· ${t.phone}`}</p>
              {t.specialty && <p className="text-xs text-blue-600 mt-1">{t.specialty}</p>}
            </div>
            <button onClick={() => remove(t.id, t.name)} className="text-red-400 hover:text-red-600 text-sm">
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
