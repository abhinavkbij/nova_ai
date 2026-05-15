import { Link, useLocation } from "react-router-dom";

export default function Navbar() {
  const { pathname } = useLocation();
  const link = (to, label) => (
    <Link
      to={to}
      className={`px-3 py-2 rounded text-sm font-medium ${
        pathname.startsWith(to) ? "bg-blue-700 text-white" : "text-blue-100 hover:bg-blue-700"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="bg-blue-800 text-white px-6 py-3 flex items-center gap-4">
      <Link to="/" className="font-bold text-lg mr-4">TechDispatch</Link>
      {link("/jobs", "Jobs")}
      {link("/technicians", "Technicians")}
    </nav>
  );
}
