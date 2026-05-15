import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getJobs } from "../api/jobs";
import { StatusBadge, PriorityBadge } from "../components/StatusBadge";

const STATUSES = ["pending", "assigned", "in_progress", "completed", "cancelled"];

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    getJobs(statusFilter ? { status: statusFilter } : {})
      .then((r) => setJobs(r.data))
      .catch(() => setError("Failed to load jobs"))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Jobs</h1>
        <Link to="/jobs/new" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">
          + New Job
        </Link>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setStatusFilter("")}
          className={`px-3 py-1 rounded text-sm ${!statusFilter ? "bg-blue-600 text-white" : "bg-gray-100"}`}
        >
          All
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded text-sm ${statusFilter === s ? "bg-blue-600 text-white" : "bg-gray-100"}`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-500">Loading...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="p-3 border-b">Title</th>
                <th className="p-3 border-b">Customer</th>
                <th className="p-3 border-b">Status</th>
                <th className="p-3 border-b">Priority</th>
                <th className="p-3 border-b">Technician</th>
                <th className="p-3 border-b">Scheduled</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 && (
                <tr><td colSpan={6} className="p-3 text-gray-400 text-center">No jobs found</td></tr>
              )}
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50 border-b">
                  <td className="p-3">
                    <Link to={`/jobs/${job.id}`} className="text-blue-600 hover:underline font-medium">
                      {job.title}
                    </Link>
                  </td>
                  <td className="p-3">{job.customer_name}</td>
                  <td className="p-3"><StatusBadge status={job.status} /></td>
                  <td className="p-3"><PriorityBadge priority={job.priority} /></td>
                  <td className="p-3">{job.technician?.name || <span className="text-gray-400">Unassigned</span>}</td>
                  <td className="p-3">{job.scheduled_at ? new Date(job.scheduled_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
