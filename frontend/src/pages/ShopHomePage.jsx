import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, ArrowRight, ChevronDown, ArrowUpDown, Mail,
  LayoutGrid, List, LogOut, X, HelpCircle, Globe, Store, Check,
} from 'lucide-react';
import { getTechniciansPage, getShops } from '../api/technicians';
import PinModal from '../components/PinModal';

const GRID_PER_PAGE = 12;
const LIST_ROWS_OPTIONS = [10, 25, 50];

export default function ShopHomePage() {
  const navigate = useNavigate();
  const [search, setSearch]                 = useState('');
  const [searchInput, setSearchInput]       = useState('');
  const [selectedShop, setSelectedShop]     = useState('all');
  const [shopDropdownOpen, setShopDropdownOpen] = useState(false);
  const [sortAsc, setSortAsc]               = useState(true);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [lang, setLang]                     = useState('EN');
  const [viewMode, setViewMode]             = useState('grid');
  const [page, setPage]                     = useState(1);
  const [rowsPerPage, setRowsPerPage]       = useState(10);
  const [rowsDropdownOpen, setRowsDropdownOpen] = useState(false);
  const [pinTechnician, setPinTechnician]   = useState(null);
  const [logoutModal, setLogoutModal]       = useState(false);

  // API data
  const [technicians, setTechnicians]       = useState([]);
  const [total, setTotal]                   = useState(0);
  const [totalPages, setTotalPages]         = useState(1);
  const [shops, setShops]                   = useState([{ id: 'all', name: 'All Shops' }]);
  const [loading, setLoading]               = useState(false);

  const effectiveRows = viewMode === 'grid' ? GRID_PER_PAGE : rowsPerPage;

  // Fetch shops once
  useEffect(() => {
    getShops()
      .then((r) => {
        const list = r.data || [];
        setShops([{ id: 'all', name: 'All Shops' }, ...list.map((s) => ({ id: s.id, name: s.name }))]);
      })
      .catch(() => {});
  }, []);

  // Fetch technicians whenever filters/page change
  const fetchTechnicians = useCallback(() => {
    setLoading(true);
    getTechniciansPage({
      page,
      pageSize: effectiveRows,
      shopId: selectedShop !== 'all' ? selectedShop : undefined,
      technicianName: search || undefined,
      sort: sortAsc ? 'asc' : 'desc',
    })
      .then((r) => {
        const d = r.data;
        const items = (d?.data || []).map((t) => ({
          id:       t.id,
          name:     t.name,
          role:     t.role,
          shop:     t.shopName || '',
          shopId:   t.shopId,
          hasEmail: !!t.email,
        }));
        setTechnicians(items);
        setTotal(d?.total ?? items.length);
        setTotalPages(d?.totalPages ?? 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, effectiveRows, selectedShop, search, sortAsc]);

  useEffect(() => { fetchTechnicians(); }, [fetchTechnicians]);

  const from = total === 0 ? 0 : (page - 1) * effectiveRows + 1;
  const to   = Math.min(page * effectiveRows, total);

  const currentShopName = shops.find((s) => s.id === selectedShop)?.name || 'All Shops';
  const shopChipLabel   = selectedShop === 'all' ? null : currentShopName;

  const closeAll = () => {
    setShopDropdownOpen(false);
    setSortDropdownOpen(false);
    setLangDropdownOpen(false);
    setRowsDropdownOpen(false);
  };

  const handleShopSelect = (id) => { setSelectedShop(id); setShopDropdownOpen(false); setPage(1); };
  const handleSearch     = (e)  => { setSearchInput(e.target.value); };
  const commitSearch     = ()   => { setSearch(searchInput); setPage(1); };

  const buildPages = () => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = [1];
    if (page > 3) pages.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('…');
    if (totalPages > 1) pages.push(totalPages);
    return pages;
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col" onClick={closeAll}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="font-bold text-gray-900 text-base">Company</span>
            <span className="font-light text-gray-400 text-base">Logo</span>
          </div>
          {shopChipLabel && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-700 bg-gray-100 border border-gray-200 rounded-full">
              <Store className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              <span className="truncate max-w-[160px]">{shopChipLabel}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {/* Logout */}
          <button
            onClick={() => setLogoutModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>

          {/* Help */}
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50 rounded-lg transition-colors">
            <HelpCircle className="w-4 h-4" />
            Help
          </button>

          {/* Language dropdown */}
          <div className="relative">
            <button
              onClick={() => { setLangDropdownOpen((o) => !o); setSortDropdownOpen(false); setShopDropdownOpen(false); }}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <Globe className="w-4 h-4" />
              {lang}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {langDropdownOpen && (
              <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 w-36 py-1 overflow-hidden">
                {[{ label: 'English', code: 'EN' }, { label: 'Spanish', code: 'ES' }].map(({ label, code }) => (
                  <button
                    key={code}
                    onClick={() => { setLang(code); setLangDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors
                      ${lang === code ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Welcome to the Shop Home Screen</h1>
        <p className="text-sm text-gray-400 mt-1">Select your profile to continue</p>
      </div>

      {/* ── Filter card ─────────────────────────────────────────────────── */}
      <div
        className="mx-6 mb-4 bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search */}
        <div className="flex items-center flex-1 border border-gray-200 rounded-lg overflow-hidden bg-white focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-200 transition-all">
          <Search className="w-4 h-4 text-gray-400 ml-3 shrink-0" />
          <input
            type="text"
            placeholder="Search by first or last name"
            value={searchInput}
            onChange={handleSearch}
            onKeyDown={(e) => e.key === 'Enter' && commitSearch()}
            className="flex-1 px-3 py-2 text-sm outline-none bg-transparent"
          />
          <button onClick={commitSearch} className="px-3 py-2 bg-gray-50 hover:bg-gray-100 border-l border-gray-200 transition-colors">
            <ArrowRight className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Shop dropdown */}
        <div className="relative">
          <button
            onClick={() => { setShopDropdownOpen((o) => !o); setSortDropdownOpen(false); setLangDropdownOpen(false); }}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors min-w-[140px] justify-between"
          >
            <span className="text-gray-700 truncate">{currentShopName}</span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          </button>
          {shopDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 min-w-[220px] py-1.5 overflow-hidden">
              {shops.map((shop) => {
                const isSelected = selectedShop === shop.id;
                return (
                  <button
                    key={shop.id}
                    onClick={() => handleShopSelect(shop.id)}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between gap-2 transition-colors
                      ${isSelected
                        ? 'mx-1 my-0.5 w-[calc(100%-8px)] border border-blue-200 bg-blue-50 rounded-lg text-gray-900 font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                      }`}
                  >
                    <span className="truncate">{shop.name}</span>
                    {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Sort dropdown */}
        <div className="relative">
          <button
            onClick={() => { setSortDropdownOpen((o) => !o); setShopDropdownOpen(false); setLangDropdownOpen(false); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors"
          >
            Sort
            <ArrowUpDown className="w-4 h-4 text-gray-500" />
          </button>
          {sortDropdownOpen && (
            <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 w-32 py-1.5 overflow-hidden">
              {[{ label: 'A to Z', asc: true }, { label: 'Z to A', asc: false }].map(({ label, asc }) => (
                <button
                  key={label}
                  onClick={() => { setSortAsc(asc); setSortDropdownOpen(false); setPage(1); }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors
                    ${sortAsc === asc ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Results card ────────────────────────────────────────────────── */}
      <div className="mx-6 mb-6 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
        {/* Card top bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <p className="text-sm text-gray-600">
            Showing <span className="font-semibold text-gray-900">{total}</span> technicians
          </p>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => { setViewMode('grid'); setPage(1); }}
              className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:bg-gray-50'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setViewMode('list'); setPage(1); }}
              className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:bg-gray-50'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          {loading ? (
            <div className="text-center py-16 text-gray-400 text-sm">Loading...</div>
          ) : technicians.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="font-medium">No technicians found</p>
              <p className="text-sm mt-1">Try adjusting your search or filter</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {technicians.map((tech) => (
                <TechCard key={tech.id} tech={tech} onClick={() => setPinTechnician(tech)} />
              ))}
            </div>
          ) : (
            <TechTable rows={technicians} onRowClick={setPinTechnician} />
          )}
        </div>

        {/* Pagination */}
        {total > 0 && (viewMode === 'list' || totalPages > 1) && (
          <div
            className="border-t border-gray-100 px-5 py-3 flex items-center justify-between text-sm"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Rows per page + entry count */}
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-xs">Rows per page</span>
              <div className="relative">
                <button
                  onClick={() => setRowsDropdownOpen((o) => !o)}
                  className="flex items-center gap-1 px-2.5 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 text-xs"
                >
                  {viewMode === 'list' ? rowsPerPage : GRID_PER_PAGE}
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                </button>
                {rowsDropdownOpen && viewMode === 'list' && (
                  <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20">
                    {LIST_ROWS_OPTIONS.map((r) => (
                      <button
                        key={r}
                        onClick={() => { setRowsPerPage(r); setPage(1); setRowsDropdownOpen(false); }}
                        className={`block w-full text-left px-4 py-2 text-xs hover:bg-gray-50 ${rowsPerPage === r ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-gray-500 text-xs">
                Showing <span className="font-semibold text-gray-700">{from} to {to}</span> of{' '}
                <span className="font-semibold text-gray-700">{total}</span> entries
              </span>
            </div>

            {/* Page buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-xs border border-gray-200 rounded-lg text-blue-500 font-semibold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:text-gray-400 transition-colors"
              >
                PREV
              </button>
              {buildPages().map((p, i) =>
                p === '…'
                  ? <span key={`e${i}`} className="px-1 text-gray-400 text-xs">...</span>
                  : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors
                        ${page === p ? 'bg-blue-500 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                      {p}
                    </button>
                  )
              )}
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages || totalPages === 0}
                className="px-3 py-1 text-xs border border-gray-200 rounded-lg text-blue-500 font-semibold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:text-gray-400 transition-colors"
              >
                NEXT
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Logout modal ────────────────────────────────────────────────── */}
      {logoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-[360px] p-6">
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">Confirm Logging out</h2>
              <button onClick={() => setLogoutModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-6">Are you sure you want to log out?</p>
            <div className="flex justify-end">
              <button
                onClick={() => navigate('/')}
                className="px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PIN modal ───────────────────────────────────────────────────── */}
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
      className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-blue-300 hover:shadow-md transition-all relative"
    >
      {tech.hasEmail && (
        <div className="absolute top-3 right-3">
          <Mail className="w-4 h-4 text-blue-500" />
        </div>
      )}
      <p className="font-semibold text-gray-900 text-sm leading-tight pr-6">{tech.name}</p>
      <p className="text-xs text-gray-500 mt-1">{tech.role}</p>
      <p className="text-xs text-gray-400 mt-0.5">{tech.shop}</p>
    </button>
  );
}

function TechTable({ rows, onRowClick }) {
  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[560px]">
        {/* Table header */}
        <div className="grid grid-cols-[2fr_1.5fr_2fr_120px] pb-2 border-b border-gray-100">
          {['Technician', 'Role', 'Shop', 'Part Message'].map((h) => (
            <span key={h} className="text-xs font-medium text-gray-400 uppercase tracking-wide px-1">{h}</span>
          ))}
        </div>
        {/* Rows */}
        {rows.map((tech, i) => (
          <button
            key={tech.id}
            onClick={() => onRowClick(tech)}
            className={`w-full grid grid-cols-[2fr_1.5fr_2fr_120px] py-3.5 text-left text-sm hover:bg-gray-50 transition-colors
              ${i < rows.length - 1 ? 'border-b border-gray-100' : ''}`}
          >
            <span className="text-gray-900 font-medium px-1">{tech.name}</span>
            <span className="text-gray-600 px-1">{tech.role}</span>
            <span className="text-gray-600 px-1">{tech.shop}</span>
            <span className="px-1">
              {tech.hasEmail
                ? <Mail className="w-4 h-4 text-blue-500" />
                : <span className="text-gray-400">--</span>
              }
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
