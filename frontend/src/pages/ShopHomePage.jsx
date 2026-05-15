import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowRight, ChevronDown, ArrowUpDown, Mail, LayoutGrid, List, LogOut } from 'lucide-react';
import { TECHNICIANS, SHOPS } from '../data/mockData';
import PinModal from '../components/PinModal';

const ROWS_OPTIONS = [9, 18, 27];

export default function ShopHomePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedShop, setSelectedShop] = useState('all');
  const [shopDropdownOpen, setShopDropdownOpen] = useState(false);
  const [sortAsc, setSortAsc] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(9);
  const [rowsDropdownOpen, setRowsDropdownOpen] = useState(false);
  const [pinTechnician, setPinTechnician] = useState(null);

  const filtered = useMemo(() => {
    let list = TECHNICIANS.filter((t) => {
      const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase());
      const matchShop = selectedShop === 'all' || t.shopId === selectedShop;
      return matchSearch && matchShop;
    });
    list.sort((a, b) => sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
    return list;
  }, [search, selectedShop, sortAsc]);

  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const paginated = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const from = filtered.length === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const to = Math.min(page * rowsPerPage, filtered.length);

  const handleShopSelect = (id) => {
    setSelectedShop(id);
    setShopDropdownOpen(false);
    setPage(1);
  };

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const currentShopName = SHOPS.find((s) => s.id === selectedShop)?.name || 'All Shops';

  const pageNumbers = () => {
    const pages = [];
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" onClick={() => { setShopDropdownOpen(false); setRowsDropdownOpen(false); }}>
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-900 text-base">Company</span>
          <span className="font-light text-gray-400 text-base">Logo</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <LogOut className="w-4 h-4" />
            Logout
          </button>
          <button className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            EN
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Welcome to the Shop Home Screen</h1>
        <p className="text-sm text-gray-400 mt-0.5">Select your profile to continue</p>
      </div>

      {/* Controls */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        {/* Search */}
        <div className="flex items-center flex-1 max-w-lg border border-gray-200 rounded-lg overflow-hidden bg-white focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-200 transition-all">
          <Search className="w-4 h-4 text-gray-400 ml-3 shrink-0" />
          <input
            type="text"
            placeholder="Search by first or last name"
            value={search}
            onChange={handleSearch}
            className="flex-1 px-3 py-2 text-sm outline-none bg-transparent"
          />
          <button className="px-3 py-2 bg-gray-50 hover:bg-gray-100 border-l border-gray-200 transition-colors">
            <ArrowRight className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Shop filter */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShopDropdownOpen(!shopDropdownOpen)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors min-w-[130px] justify-between"
          >
            <span className="text-gray-700 truncate">{currentShopName}</span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          </button>
          {shopDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 min-w-[200px] py-1 overflow-hidden">
              {SHOPS.map((shop) => (
                <button
                  key={shop.id}
                  onClick={() => handleShopSelect(shop.id)}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center justify-between transition-colors
                    ${selectedShop === shop.id ? 'text-blue-600 bg-blue-50' : 'text-gray-700'}`}
                >
                  {shop.name}
                  {selectedShop === shop.id && (
                    <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sort */}
        <button
          onClick={() => setSortAsc(!sortAsc)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors"
        >
          <ArrowUpDown className="w-4 h-4 text-gray-500" />
          Sort
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 px-6 py-4">
        {/* Count + view toggle */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-600">
            Showing <span className="font-semibold text-gray-900">{filtered.length}</span> technicians
          </p>
          <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden bg-white">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:bg-gray-50'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:bg-gray-50'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Grid */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {paginated.map((tech) => (
              <TechCard key={tech.id} tech={tech} onClick={() => setPinTechnician(tech)} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {paginated.map((tech) => (
              <TechRow key={tech.id} tech={tech} onClick={() => setPinTechnician(tech)} />
            ))}
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="font-medium">No technicians found</p>
            <p className="text-sm mt-1">Try adjusting your search or filter</p>
          </div>
        )}
      </div>

      {/* Pagination footer */}
      <footer className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <span className="text-gray-500">Rows per page</span>
          <div className="relative">
            <button
              onClick={() => setRowsDropdownOpen(!rowsDropdownOpen)}
              className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
            >
              {rowsPerPage}
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
            {rowsDropdownOpen && (
              <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20">
                {ROWS_OPTIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => { setRowsPerPage(r); setPage(1); setRowsDropdownOpen(false); }}
                    className={`block w-full text-left px-4 py-2 hover:bg-gray-50 ${rowsPerPage === r ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <span className="text-gray-500">
          Showing <span className="font-medium text-gray-700">{from} to {to}</span> of{' '}
          <span className="font-medium text-gray-700">{filtered.length}</span> entries
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            PREV
          </button>
          {pageNumbers().map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors
                ${page === p ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages || totalPages === 0}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            NEXT
          </button>
        </div>
      </footer>

      {/* PIN Modal */}
      {pinTechnician && (
        <PinModal
          technician={pinTechnician}
          onClose={() => setPinTechnician(null)}
          onSuccess={(tech) => navigate('/dashboard', { state: { technician: tech } })}
        />
      )}
    </div>
  );
}

function TechCard({ tech, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-blue-300 hover:shadow-md transition-all group relative"
    >
      {tech.hasEmail && (
        <div className="absolute top-3 right-3 w-6 h-6 rounded bg-blue-50 flex items-center justify-center">
          <Mail className="w-3.5 h-3.5 text-blue-500" />
        </div>
      )}
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3 group-hover:bg-blue-50 transition-colors">
        <span className="text-sm font-semibold text-gray-600 group-hover:text-blue-600">
          {tech.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
        </span>
      </div>
      <p className="font-semibold text-gray-900 text-sm leading-tight">{tech.name}</p>
      <p className="text-xs text-gray-500 mt-0.5">{tech.role}</p>
      <p className="text-xs text-gray-400 uppercase tracking-wide mt-1 leading-tight">{tech.shop}</p>
    </button>
  );
}

function TechRow({ tech, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-left hover:border-blue-300 hover:shadow-sm transition-all flex items-center gap-4"
    >
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
        <span className="text-sm font-semibold text-gray-600">
          {tech.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm">{tech.name}</p>
        <p className="text-xs text-gray-500">{tech.role} · <span className="uppercase">{tech.shop}</span></p>
      </div>
      {tech.hasEmail && <Mail className="w-4 h-4 text-blue-400 shrink-0" />}
    </button>
  );
}
