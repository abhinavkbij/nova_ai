import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Home, Wrench, Package, QrCode, HelpCircle,
  Clock, ChevronDown, LayoutGrid, List, X,
  Search, ArrowRight, LogOut, Plus, Mail,
  AlertCircle, ArrowUpCircle, MinusCircle, ArrowDownCircle,
} from 'lucide-react';
import { searchRepairs, beginRepair } from '../api/workOrders';
import { getPartsMessages, getRequestedParts } from '../api/parts';
import { getStatusIndicator, submitIndirectActivity, beginShift, endShift } from '../api/technicians';
import IndirectActivityModal from '../components/IndirectActivityModal';
import { useNova } from '../context/NovaContext';

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const days    = Math.floor(totalSeconds / 86400);
  const hours   = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}d ${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
}

const PRIORITY_BADGE = {
  URGENT: { bg: 'bg-red-50',    border: 'border-red-300',    text: 'text-red-600',    Icon: AlertCircle     },
  HIGH:   { bg: 'bg-amber-50',  border: 'border-amber-300',  text: 'text-amber-600',  Icon: ArrowUpCircle   },
  MEDIUM: { bg: 'bg-slate-50',  border: 'border-slate-300',  text: 'text-slate-600',  Icon: MinusCircle     },
  LOW:    { bg: 'bg-green-50',  border: 'border-green-300',  text: 'text-green-600',  Icon: ArrowDownCircle },
};

const STATUS_STYLES = {
  Requested: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  Issued:    'bg-green-50 text-green-700 border-green-200',
  Cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

function formatRepairDate(value) {
  if (!value) return '--';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '--';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function normalizePriority(priority) {
  const value = (priority || '').toUpperCase();
  if (value === 'MED') return 'MEDIUM';
  if (value === 'RED') return 'URGENT';
  return value || 'LOW';
}

function mapFasterWebRepair(item) {
  const titleParts = [item.actionDesc, item.groupDesc, item.componentDesc].filter(Boolean);
  const asset      = [item.yearMake, item.model].filter(Boolean).join(' ');
  return {
    id:           item.repairId,
    repairId:     item.repairId,
    woNumber:     item.documentNumber || item.assetNumber || String(item.documentId ?? ''),
    woStatus:     item.workOrderStatusCode || '',
    title:        titleParts.join(' ') || item.componentDesc || `Repair ${item.repairId}`,
    priority:     normalizePriority(item.priority),
    priorityCode: item.priority || '',
    partsStatus:  item.hasParts ? 'PARTS ASSIGNED' : 'PARTS UNASSIGNED',
    asset:        asset || '--',
    assetId:      item.assetNumber || item.assetId || '--',
    repairCode:   item.repairScheduleID || String(item.repairId ?? ''),
    shop:         item.maintShop || item.maintShopDesc || '--',
    timeStandard: item.timeStandardHours == null ? '--' : `${Number(item.timeStandardHours).toFixed(1)}h`,
    dateIn:       formatRepairDate(item.inDate),
    isOpen:       item.status !== 'Complete',
    rawStatus:    item.workOrderStatusCode === 'A' ? 'In Progress' : item.status,
    messageCount: item.messageCount ?? 0,
  };
}

function mapPartRequest(part) {
  return {
    id:          part.id,
    status:      part.statusName || 'Requested',
    name:        part.partName || '--',
    description: part.requestComment || '--',
    partId:      part.partId || '--',
    repairCode:  part.repairCode || '--',
    woNumber:    part.woNumber || '--',
  };
}

const REPAIR_ROWS_OPTIONS = [6, 10, 25];

function getRepairActionLabel(wo) {
  if (!wo?.isOpen || wo?.rawStatus === 'Complete') return 'View';
  return wo.rawStatus === 'In Progress' ? 'Resume' : 'Begin';
}

export default function DashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const technician = (() => {
    if (location.state?.technician) {
      sessionStorage.setItem('loggedInTechnician', JSON.stringify(location.state.technician));
      return location.state.technician;
    }
    const saved = sessionStorage.getItem('loggedInTechnician');
    return saved ? JSON.parse(saved) : null;
  })();

  useEffect(() => { if (!technician) navigate('/'); }, []); // eslint-disable-line
  if (!technician) return null;

  const { updateContext, registerActionHandler } = useNova();

  const [activeSection, setActiveSection]       = useState(location.state?.section || 'repairs');
  const [activeTab, setActiveTab]               = useState('all');
  const [repairsViewMode, setRepairsViewMode]   = useState('grid');
  const [priorityFilter, setPriorityFilter]     = useState('All');
  const [priorityFilterOpen, setPriorityFilterOpen] = useState(false);
  const [repairsPage, setRepairsPage]           = useState(1);
  const [repairsRows, setRepairsRows]           = useState(6);
  const [repairsRowsDDOpen, setRepairsRowsDDOpen] = useState(false);
  const [partsTab, setPartsTab]                 = useState('active');
  const [partsFilter, setPartsFilter]           = useState('All');
  const [partsFilterOpen, setPartsFilterOpen]   = useState(false);
  const [viewMode, setViewMode]                 = useState('grid');
  const [shiftActive, setShiftActive]           = useState(false);
  const [shiftStartedAt, setShiftStartedAt]     = useState(null);
  const [shiftDuration, setShiftDuration]       = useState(0);
  const [indirectModal, setIndirectModal]       = useState(false);
  const [logoutModal, setLogoutModal]           = useState(false);
  const activityKey = `status_activity_${technician.id}`;
  const [currentActivity, setCurrentActivity]   = useState(
    () => localStorage.getItem(activityKey) || ''
  );
  const [searchField, setSearchField]           = useState('Repair Id');
  const [searchInput, setSearchInput]           = useState('');
  const [searchValue, setSearchValue]           = useState('');
  const [scope, setScope]                       = useState('My Repairs in My Shop');
  const [searchFieldOpen, setSearchFieldOpen]   = useState(false);
  const [repairsTotalItems, setRepairsTotalItems] = useState(0);
  const [repairs, setRepairs]                   = useState([]);
  const [repairsLoading, setRepairsLoading]     = useState(false);
  const [repairsError, setRepairsError]         = useState('');
  const [parts, setParts]                       = useState([]);
  const [partsCounts, setPartsCounts]           = useState({ requested: 0, issued: 0, delayed: 0 });
  const [partsLoading, setPartsLoading]         = useState(false);
  const [partsError, setPartsError]             = useState('');
  const [partsMessages, setPartsMessages]       = useState([]);

  useEffect(() => {
    if (!shiftActive || !shiftStartedAt) return;
    const id = setInterval(() => setShiftDuration(Date.now() - new Date(shiftStartedAt).getTime()), 1000);
    return () => clearInterval(id);
  }, [shiftActive, shiftStartedAt]);

  // Push current screen context to Nova
  useEffect(() => {
    updateContext({
      screen: activeSection === 'repairs' ? 'repairs' : activeSection === 'parts' ? 'parts' : 'dashboard',
      technicianId: technician.id,
      technicianName: technician.name,
      shopId: technician.shopId,
      shopName: technician.shop,
      role: technician.role,
      shiftActive,
    });
  }, [activeSection, technician.id, shiftActive]); // eslint-disable-line

  // Register action handler so Nova can mutate dashboard state
  useEffect(() => {
    return registerActionHandler((action) => {
      if (action.action === 'navigate') {
        setActiveSection(action.section);
      }
      if (action.action === 'navigate_repair') {
        navigate(`/repair/${action.repair_id}`, { state: { technician, tab: action.tab } });
      }
      if (action.action === 'set_repairs_tab') {
        setActiveSection('repairs');
        setActiveTab(action.tab);
        setRepairsPage(1);
      }
      if (action.action === 'begin_shift') {
        // Backend already created the shift in DB — update state directly using
        // the begin_time the backend sends so there's no redundant API call.
        const startTime = action.begin_time ?? new Date().toISOString();
        setShiftActive(true);
        setShiftStartedAt(startTime);
        setShiftDuration(Date.now() - new Date(startTime).getTime());
      }
      if (action.action === 'end_shift') {
        // Backend already ended the shift — just clear local state.
        setShiftActive(false);
        setShiftStartedAt(null);
        setShiftDuration(0);
      }
      if (action.action === 'set_indirect_activity') {
        setCurrentActivity(action.activity);
        localStorage.setItem(activityKey, action.activity);
      }
    });
  }, [registerActionHandler, technician.id, technician.shopId]); // eslint-disable-line

  useEffect(() => {
    getStatusIndicator(technician.id)
      .then((response) => {
        const data = response.data;
        if (data?.isActive) {
          setShiftActive(true);
          setShiftStartedAt(data.startedAt ?? null);
          if (data.durationSeconds != null) setShiftDuration(data.durationSeconds * 1000);
        }
        if (data?.statusIndicator) {
          setCurrentActivity(data.statusIndicator);
          localStorage.setItem(activityKey, data.statusIndicator);
        }
      })
      .catch(() => {});
  }, [technician.id, activityKey]);

  useEffect(() => {
    const t = setTimeout(() => { setSearchValue(searchInput); setRepairsPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    let ignore = false;
    const statusFilter = activeTab === 'all' ? 'All' : (activeTab === 'completed' || activeTab === 'lastWO') ? 'Closed' : 'Open';
    setRepairsLoading(true);
    setRepairsError('');
    searchRepairs({
      technicianId: technician.id,
      shopId: technician.shopId,
      searchText: searchField,
      searchValue,
      scope,
      page: repairsPage,
      pageSize: repairsRows,
      statusFilter,
    })
      .then((response) => {
        if (ignore) return;
        const payload = response.data?.data;
        setRepairs((payload?.items || []).map(mapFasterWebRepair));
        setRepairsTotalItems(payload?.pagination?.totalItems ?? 0);
      })
      .catch(() => {
        if (ignore) return;
        setRepairs([]);
        setRepairsTotalItems(0);
        setRepairsError('Failed to load repairs');
      })
      .finally(() => { if (!ignore) setRepairsLoading(false); });
    return () => { ignore = true; };
  }, [activeTab, technician.id, searchValue, scope, repairsPage, repairsRows]);

  const repairsList = repairs.filter((wo) => {
    if (priorityFilter !== 'All' && wo.priority !== priorityFilter) return false;
    return true;
  });

  const repairsTotalPages = Math.max(1, Math.ceil(repairsTotalItems / repairsRows));
  const pagedRepairs      = repairsList;
  const repairsFrom       = repairsTotalItems === 0 ? 0 : (repairsPage - 1) * repairsRows + 1;
  const repairsTo         = Math.min(repairsPage * repairsRows, repairsTotalItems);

  useEffect(() => {
    let ignore = false;
    const isRequestActive = partsTab === 'active';
    const statusIdMap = { Requested: 1, Issued: 2, Cancelled: 3, Delayed: 4 };
    setPartsLoading(true);
    setPartsError('');
    getRequestedParts({ technicianId: technician.id, isRequestActive, requestedPartStatusId: statusIdMap[partsFilter], pageNumber: 1, pageSize: 20 })
      .then((response) => {
        if (ignore) return;
        const payload = response.data;
        setParts((payload?.data || []).map(mapPartRequest));
        setPartsCounts({ requested: payload?.requested ?? 0, issued: payload?.issued ?? 0, delayed: payload?.delayed ?? 0 });
      })
      .catch(() => { if (ignore) return; setParts([]); setPartsCounts({ requested: 0, issued: 0, delayed: 0 }); setPartsError('Failed to load parts'); })
      .finally(() => { if (!ignore) setPartsLoading(false); });
    return () => { ignore = true; };
  }, [partsFilter, partsTab, technician.id]);

  useEffect(() => {
    let ignore = false;
    getPartsMessages({ technicianID: technician.id, pageNumber: 1, pageSize: 20 })
      .then((response) => { if (!ignore) setPartsMessages(response.data?.data || []); })
      .catch(() => { if (!ignore) setPartsMessages([]); });
    return () => { ignore = true; };
  }, [technician.id]);

  const partsList = parts.filter((p) => {
    const isActive = p.status === 'Requested' || p.status === 'Issued';
    if (partsTab === 'active' && !isActive) return false;
    if (partsTab === 'past'   && isActive)  return false;
    if (partsFilter !== 'All' && p.status !== partsFilter) return false;
    return true;
  });

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning,';
    if (h < 17) return 'Good Afternoon,';
    return 'Good Evening,';
  };

  const handleRepairAction = (wo) => {
    if (getRepairActionLabel(wo) === 'View') {
      navigate(`/repair/${wo.repairId}`, { state: { technician } });
      return;
    }
    // Both Begin and Resume: update backend status_indicator, refresh from API, then navigate
    beginRepair(wo.repairId, { technicianId: technician.id })
      .then(() => getStatusIndicator(technician.id))
      .then((res) => {
        const data = res.data;
        if (data?.statusIndicator) {
          setCurrentActivity(data.statusIndicator);
          localStorage.setItem(activityKey, data.statusIndicator);
        }
        setRepairs((prev) =>
          prev.map((r) =>
            r.repairId === wo.repairId ? { ...r, rawStatus: 'In Progress', woStatus: 'A' } : r
          )
        );
      })
      .catch(() => {})
      .finally(() => navigate(`/repair/${wo.repairId}`, { state: { technician } }));
  };

  const buildRepairPages = () => {
    const t = repairsTotalPages;
    if (t <= 5) return Array.from({ length: t }, (_, i) => i + 1);
    const pages = [1];
    if (repairsPage > 3) pages.push('…');
    for (let i = Math.max(2, repairsPage - 1); i <= Math.min(t - 1, repairsPage + 1); i++) pages.push(i);
    if (repairsPage < t - 2) pages.push('…');
    if (t > 1) pages.push(t);
    return pages;
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden" onClick={() => { setPartsFilterOpen(false); setPriorityFilterOpen(false); setRepairsRowsDDOpen(false); setSearchFieldOpen(false); }}>
      <div className="flex flex-1 min-h-0">

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <aside className="w-20 bg-white border-r border-gray-200 flex flex-col items-center py-4 gap-1 shrink-0">
          {[
            { id: 'home',    icon: Home,    label: 'Home'        },
            { id: 'repairs', icon: Wrench,  label: 'Repairs'     },
            { id: 'parts',   icon: Package, label: 'Parts'       },
            { id: 'vin',     icon: QrCode,  label: 'VIN Scanner' },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              title={label}
              className={`w-16 py-2.5 rounded-xl flex flex-col items-center gap-1 transition-colors
                ${activeSection === id ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-tight text-center">{label}</span>
            </button>
          ))}
          <div className="flex-1" />
          <button title="Help" className="w-16 py-2.5 rounded-xl flex flex-col items-center gap-1 text-gray-400 hover:text-gray-500 hover:bg-gray-100 transition-colors">
            <HelpCircle className="w-5 h-5" />
            <span className="text-[10px] font-medium">Help</span>
          </button>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Header */}
          <header className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 flex-1">
              <span className="font-bold text-gray-900 text-sm">Company</span>
              <span className="font-light text-gray-400 text-sm">Logo</span>
              {technician.shop && (
                <span className="ml-1 px-2 py-0.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded border border-gray-200">
                  {technician.shop}
                </span>
              )}
            </div>
            <button
              onClick={() => setIndirectModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Clock className="w-3.5 h-3.5" />
              Indirect Activity
            </button>
            <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-50 rounded-lg transition-colors">
              EN <ChevronDown className="w-3 h-3" />
            </button>
            <button className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Status: {currentActivity}
            </button>
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {technician.name?.split(' ').map((n) => n[0]).join('').slice(0, 2) || 'AA'}
            </div>
            <button
              onClick={() => setLogoutModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </header>

          {/* Blue hero banner */}
          <div className="bg-blue-600 text-white px-5 py-4 flex items-center gap-6 shrink-0">
            <div className="flex-1 min-w-0">
              <p className="text-blue-200 text-sm">{greeting()}</p>
              <p className="font-bold text-xl leading-tight">{technician.name}</p>
              <p className="text-blue-200 text-xs mt-0.5">
                {technician.role} <span className="mx-1">•</span> {technician.shop}
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-6 border-l border-blue-500 pl-6">
              <div>
                <p className="text-blue-300 text-xs">Shift Duration</p>
                <p className="font-mono font-bold text-base">{formatDuration(shiftDuration)}</p>
              </div>
              <div>
                <p className="text-blue-300 text-xs">Started At</p>
                <p className="font-bold text-base">
                  {shiftStartedAt ? new Date(shiftStartedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                </p>
              </div>
            </div>
            <div className="border-l border-blue-500 pl-6 flex flex-col items-end gap-2 shrink-0">
              <p className="text-blue-200 text-xs">Status: <span className="text-white font-medium">{currentActivity}</span></p>
              <button
                onClick={() => {
                  if (shiftActive) {
                    endShift(technician.id)
                      .catch(() => {})
                      .finally(() => {
                        localStorage.removeItem(activityKey);
                        sessionStorage.removeItem('loggedInTechnician');
                        navigate('/');
                      });
                  } else {
                    beginShift(technician.id, technician.shopId)
                      .then((response) => {
                        const data = response.data;
                        setShiftActive(true);
                        const startTime = data.beginTime ?? new Date().toISOString();
                        setShiftStartedAt(startTime);
                        setShiftDuration(Date.now() - new Date(startTime).getTime());
                      })
                      .catch(() => {});
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold transition-colors border border-white/30"
              >
                {shiftActive ? <><Clock className="w-4 h-4" /> End Shift</> : <>▶ Begin Shift</>}
              </button>
            </div>
          </div>

          {/* Section tabs */}
          <div className="bg-white border-b border-gray-200 px-4 flex items-center">
            {[
              { id: 'repairs', label: 'Repairs',         icon: Wrench  },
              { id: 'parts',   label: 'Parts Inventory', icon: Package },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                  ${activeSection === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* ── Content ─────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto">

            {/* ── REPAIRS ── */}
            {activeSection === 'repairs' && (
              <div className="p-4">

                {/* Row 1: Category + Search + Scope + New WO + New Repair */}
                <div className="flex items-center gap-2 mb-3" onClick={(e) => e.stopPropagation()}>
                  {/* Search field selector + input */}
                  <div className="flex items-center flex-1 max-w-md gap-0" onClick={(e) => e.stopPropagation()}>
                    {/* Field dropdown */}
                    <div className="relative shrink-0">
                      <button
                        onClick={() => setSearchFieldOpen((o) => !o)}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm border border-r-0 border-gray-200 rounded-l-lg bg-white text-gray-600 hover:bg-gray-50 whitespace-nowrap"
                      >
                        {searchField}
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      </button>
                      {searchFieldOpen && (
                        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 min-w-[160px]">
                          {['Asset Number', 'License Number', 'Work Order Id', 'Repair Id', 'VIN Code'].map((f) => (
                            <button
                              key={f}
                              onClick={() => { setSearchField(f); setSearchFieldOpen(false); setSearchInput(''); setSearchValue(''); }}
                              className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50"
                            >
                              <span className={searchField === f ? 'font-semibold text-gray-900' : 'text-gray-700'}>{f}</span>
                              {searchField === f && <span className="text-gray-500 text-xs">✓</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Input */}
                    <div className="flex items-center border border-gray-200 rounded-r-lg overflow-hidden bg-white flex-1 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-200 transition-all">
                      <Search className="w-4 h-4 text-gray-400 ml-3 shrink-0" />
                      <input
                        type="text"
                        placeholder={`Search by ${searchField}...`}
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { setSearchValue(searchInput); setRepairsPage(1); } }}
                        className="flex-1 px-2 py-2 text-sm outline-none bg-transparent"
                      />
                      {searchInput && (
                        <button
                          onClick={() => { setSearchInput(''); setSearchValue(''); setRepairsPage(1); }}
                          className="px-2 py-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => { setSearchValue(searchInput); setRepairsPage(1); }}
                        className="px-2 py-2 hover:bg-gray-50 border-l border-gray-200 transition-colors"
                      >
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>

                  {/* Scope */}
                  <select
                    value={scope}
                    onChange={(e) => { setScope(e.target.value); setRepairsPage(1); }}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-300"
                  >
                    <option>My Repairs in My Shop</option>
                    <option>My Repairs in All Shops</option>
                    <option>All Repairs in My Shop</option>
                    <option>All Repairs in All Shops</option>
                  </select>

                  <div className="flex-1" />

                  {/* New Work Order */}
                  <button
                    onClick={() => navigate('/work-orders/new', { state: { technician } })}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    New Work Order
                  </button>

                  {/* New Repair — disabled for now */}
                  {/* <button
                    onClick={() => navigate('/work-orders/new', { state: { technician } })}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    New Repair
                  </button> */}
                </div>

                {/* Row 2: Status tabs + Filter by + View toggle */}
                <div className="flex items-center gap-2 mb-4" onClick={(e) => e.stopPropagation()}>
                  {/* Status tabs */}
                  {[
                    { id: 'all',       label: 'All'       },
                    { id: 'open',      label: 'Open'      },
                    { id: 'completed', label: 'Completed' },
                    { id: 'lastWO',    label: 'Last WO'   },
                  ].map(({ id, label }) => (
                    <button
                      key={id}
                      onClick={() => { setActiveTab(id); setRepairsPage(1); }}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors
                        ${activeTab === id
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'text-gray-600 border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                      {label}
                    </button>
                  ))}

                  <div className="flex-1" />

                  {/* Filter by priority */}
                  <div className="relative">
                    <button
                      onClick={() => setPriorityFilterOpen((o) => !o)}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors"
                    >
                      Filter by: <span className="font-semibold">{priorityFilter}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    {priorityFilterOpen && (
                      <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 min-w-[130px]">
                        {['All', 'URGENT', 'HIGH', 'MEDIUM', 'LOW'].map((f) => (
                          <button
                            key={f}
                            onClick={() => { setPriorityFilter(f); setPriorityFilterOpen(false); setRepairsPage(1); }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 capitalize ${priorityFilter === f ? 'text-blue-600 font-semibold' : 'text-gray-700'}`}
                          >
                            {f.charAt(0) + f.slice(1).toLowerCase()}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Grid / List toggle */}
                  <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
                    <button
                      onClick={() => setRepairsViewMode('grid')}
                      className={`p-2 transition-colors ${repairsViewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:bg-gray-50'}`}
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setRepairsViewMode('list')}
                      className={`p-2 transition-colors ${repairsViewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:bg-gray-50'}`}
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Repairs content */}
                {repairsLoading ? (
                  <EmptyState message="Loading repairs..." />
                ) : repairsError ? (
                  <EmptyState message={repairsError} />
                ) : repairsList.length === 0 ? (
                  <EmptyState message="No work orders currently assigned" />
                ) : repairsViewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pagedRepairs.map((wo) => <WorkOrderCard key={wo.id} wo={wo} onOpen={() => handleRepairAction(wo)} />)}
                  </div>
                ) : (
                  <RepairsTable rows={pagedRepairs} onOpen={(wo) => handleRepairAction(wo)} />
                )}

                {/* Repairs pagination */}
                {repairsTotalItems > 0 && repairsTotalPages > 0 && (
                  <div
                    className="mt-4 flex items-center justify-between text-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-xs">Rows per page</span>
                      <div className="relative">
                        <button
                          onClick={() => setRepairsRowsDDOpen((o) => !o)}
                          className="flex items-center gap-1 px-2.5 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 text-xs"
                        >
                          {repairsRows}
                          <ChevronDown className="w-3 h-3 text-gray-400" />
                        </button>
                        {repairsRowsDDOpen && (
                          <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20">
                            {REPAIR_ROWS_OPTIONS.map((r) => (
                              <button
                                key={r}
                                onClick={() => { setRepairsRows(r); setRepairsPage(1); setRepairsRowsDDOpen(false); }}
                                className={`block w-full text-left px-4 py-2 text-xs hover:bg-gray-50 ${repairsRows === r ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
                              >
                                {r}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-gray-500 text-xs">
                        Showing <span className="font-semibold text-gray-700">{repairsFrom} to {repairsTo}</span> of{' '}
                        <span className="font-semibold text-gray-700">{repairsTotalItems}</span> entries
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setRepairsPage(Math.max(1, repairsPage - 1))}
                        disabled={repairsPage === 1}
                        className="px-3 py-1 text-xs border border-gray-200 rounded-lg text-blue-500 font-semibold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:text-gray-400"
                      >
                        PREV
                      </button>
                      {buildRepairPages().map((p, i) =>
                        p === '…'
                          ? <span key={`e${i}`} className="px-1 text-gray-400 text-xs">...</span>
                          : (
                            <button
                              key={p}
                              onClick={() => setRepairsPage(p)}
                              className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors
                                ${repairsPage === p ? 'bg-blue-500 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                            >
                              {p}
                            </button>
                          )
                      )}
                      <button
                        onClick={() => setRepairsPage(Math.min(repairsTotalPages, repairsPage + 1))}
                        disabled={repairsPage === repairsTotalPages}
                        className="px-3 py-1 text-xs border border-gray-200 rounded-lg text-blue-500 font-semibold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:text-gray-400"
                      >
                        NEXT
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── PARTS INVENTORY ── */}
            {activeSection === 'parts' && (
              <div className="p-4">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: 'Requested Parts', count: partsCounts.requested, icon: '📋' },
                    { label: 'Issued Parts',    count: partsCounts.issued,    icon: '✓'  },
                    { label: 'Delayed Parts',   count: partsCounts.delayed,   icon: '⏱' },
                  ].map(({ label, count, icon }) => (
                    <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between">
                      <div>
                        <p className="text-sm text-gray-500">{label}</p>
                        <p className="text-3xl font-bold text-gray-900 mt-1">{String(count).padStart(2, '0')}</p>
                      </div>
                      <span className="text-xl">{icon}</span>
                    </div>
                  ))}
                </div>
                {partsMessages.length > 0 && (
                  <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-sm font-semibold text-amber-900 mb-1">Parts Messages</p>
                    <div className="space-y-1">
                      {partsMessages.slice(0, 2).map((message) => (
                        <p key={message.messageID} className="text-xs text-amber-800">{message.messageSubject}</p>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-1">
                    {['active', 'past'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setPartsTab(t)}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors capitalize
                          ${partsTab === t ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                      >
                        {t === 'active' ? 'Active Requests' : 'Past Requests'}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1" />
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setPartsFilterOpen(!partsFilterOpen)}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors"
                    >
                      Filter by: <span className="font-medium">{partsFilter}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    {partsFilterOpen && (
                      <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 min-w-[130px]">
                        {['All', 'Requested', 'Issued', 'Cancelled'].map((f) => (
                          <button
                            key={f}
                            onClick={() => { setPartsFilter(f); setPartsFilterOpen(false); }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${partsFilter === f ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-0 border border-gray-200 rounded-lg overflow-hidden bg-white">
                    <button onClick={() => setViewMode('grid')} className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:bg-gray-50'}`}><LayoutGrid className="w-4 h-4" /></button>
                    <button onClick={() => setViewMode('list')}  className={`p-2 transition-colors ${viewMode === 'list'  ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:bg-gray-50'}`}><List className="w-4 h-4" /></button>
                  </div>
                </div>
                {partsLoading ? <EmptyState message="Loading parts..." />
                  : partsError ? <EmptyState message={partsError} />
                  : partsList.length === 0 ? <EmptyState message="No parts requests found" />
                  : viewMode === 'grid'
                    ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{partsList.map((p) => <PartCard key={p.id} part={p} />)}</div>
                    : <div className="space-y-2">{partsList.map((p) => <PartRow key={p.id} part={p} />)}</div>
                }
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Logout modal */}
      {logoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-[360px] p-6">
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">Confirm Logging out</h2>
              <button onClick={() => setLogoutModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-6">Are you sure you want to log out?</p>
            <div className="flex justify-end">
              <button
                onClick={() => { localStorage.removeItem(activityKey); sessionStorage.removeItem('loggedInTechnician'); navigate('/'); }}
                className="px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Indirect Activity Modal */}
      {indirectModal && (
        <IndirectActivityModal
          onClose={() => setIndirectModal(false)}
          onSelect={(activity) => {
            const id = typeof activity === 'object' ? activity?.repairGroupComponentActionID : null;
            setIndirectModal(false);
            const doLogout = () => {
              sessionStorage.removeItem('loggedInTechnician');
              navigate('/');
            };
            if (id != null) {
              submitIndirectActivity(technician.id, id).catch(() => {}).finally(doLogout);
            } else {
              doLogout();
            }
          }}
        />
      )}

    </div>
  );
}

// ── Priority badge ────────────────────────────────────────────────────────────
function PriorityBadge({ priority }) {
  const cfg = PRIORITY_BADGE[priority] || PRIORITY_BADGE.LOW;
  const { bg, border, text, Icon } = cfg;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-bold ${bg} ${border} ${text}`}>
      <Icon className="w-3.5 h-3.5" />
      {priority}
    </span>
  );
}

// ── Priority icon (for list view) ─────────────────────────────────────────────
function PriorityIcon({ priority }) {
  const cfg = PRIORITY_BADGE[priority] || PRIORITY_BADGE.LOW;
  const { text, Icon } = cfg;
  return <Icon className={`w-5 h-5 ${text}`} />;
}

// ── Work Order Card (grid) ────────────────────────────────────────────────────
function WorkOrderCard({ wo, onOpen }) {
  const actionLabel = getRepairActionLabel(wo);
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow flex flex-col">
      {/* Top: priority badge + message */}
      <div className="flex items-center justify-between mb-3">
        {wo.priority ? <PriorityBadge priority={wo.priority} /> : <span />}
        <div className="relative">
          <Mail className="w-4 h-4 text-gray-400" />
          {wo.messageCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {wo.messageCount}
            </span>
          )}
        </div>
      </div>

      {/* WO Number + Status */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">WO Number: <span className="font-semibold text-gray-800">{wo.woNumber}</span></span>
        <span className="text-xs text-gray-500">WO Status: <span className="font-semibold text-gray-800">{wo.woStatus}</span></span>
      </div>

      {/* Title */}
      <p className="font-bold text-gray-900 text-sm leading-snug mb-3">{wo.title}</p>

      {/* Asset box */}
      <div className="border border-gray-200 rounded-lg px-3 py-2 mb-3 bg-gray-50">
        <p className="text-[10px] text-gray-400 mb-0.5">Asset:</p>
        <p className="text-sm">
          <span className="font-bold text-gray-900">{wo.asset}</span>
          <span className="text-gray-500 ml-1.5">{wo.assetId}</span>
        </p>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100 mb-3" />

      {/* Metadata */}
      <div className="space-y-1.5 mb-4 flex-1">
        {[
          ['Repair Code', wo.repairCode],
          ['Shop',        wo.shop],
          ['Time Standard', wo.timeStandard],
          ['Date In',     wo.dateIn],
        ].map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-2 text-xs">
            <span className="text-gray-400 w-24 shrink-0">{label}:</span>
            <span className="font-semibold text-gray-800">{value}</span>
          </div>
        ))}
      </div>

      {/* Action button */}
      <button
        onClick={() => onOpen?.(wo.repairId)}
        className="w-full py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
      >
        {actionLabel}
      </button>
    </div>
  );
}

// ── Repairs list table ─────────────────────────────────────────────────────────
const LIST_COLS = ['Priority', 'Asset', 'WO Number', 'WO Status', 'Repair Code', 'Repair Description', 'Shop', 'Time Standard', 'Date In', 'Message', 'Actions'];

function RepairsTable({ rows, onOpen }) {
  return (
    <div className="w-full overflow-x-auto bg-white border border-gray-200 rounded-xl">
      <table className="w-full text-sm min-w-[900px]">
        <thead>
          <tr className="border-b border-gray-100">
            {LIST_COLS.map((col) => (
              <th key={col} className="text-left px-3 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((wo, i) => {
            const actionLabel = getRepairActionLabel(wo);
            return (
              <tr key={wo.id} className={`hover:bg-gray-50 transition-colors ${i < rows.length - 1 ? 'border-b border-gray-100' : ''}`}>
                <td className="px-3 py-3"><PriorityIcon priority={wo.priority} /></td>
                <td className="px-3 py-3 text-gray-700 font-medium">{wo.asset}<br /><span className="text-xs text-gray-400">{wo.assetId}</span></td>
                <td className="px-3 py-3 text-gray-700">{wo.woNumber}</td>
                <td className="px-3 py-3 text-gray-700">{wo.woStatus}</td>
                <td className="px-3 py-3 text-gray-700">{wo.repairCode}</td>
                <td className="px-3 py-3 text-gray-700 max-w-[180px] truncate">{wo.title}</td>
                <td className="px-3 py-3 text-gray-700">{wo.shop}</td>
                <td className="px-3 py-3 text-gray-700">{wo.timeStandard}</td>
                <td className="px-3 py-3 text-gray-700">{wo.dateIn}</td>
                <td className="px-3 py-3">
                  {wo.messageCount > 0 ? (
                    <div className="relative inline-block">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {wo.messageCount}
                      </span>
                    </div>
                  ) : <span className="text-gray-400">--</span>}
                </td>
                <td className="px-3 py-3">
                  <button
                    onClick={() => onOpen?.(wo)}
                    className="px-4 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap"
                  >
                    {actionLabel}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <p className="text-sm font-medium text-gray-500">{message}</p>
    </div>
  );
}

function PartCard({ part }) {
  const style = STATUS_STYLES[part.status] || 'bg-gray-100 text-gray-500 border-gray-200';
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
      <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded border mb-3 ${style}`}>{part.status}</span>
      <p className="font-semibold text-gray-900 text-sm mb-0.5">{part.name || '--'}</p>
      <p className="text-xs text-gray-400 mb-3">{part.description || '--'}</p>
      <div className="space-y-1">
        {[['Part ID', part.partId], ['Repair Code', part.repairCode], ['WO Number', part.woNumber]].map(([label, val]) => (
          <div key={label} className="flex justify-between text-xs">
            <span className="text-gray-400">{label}</span>
            <span className="font-medium text-gray-700">{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PartRow({ part }) {
  const style = STATUS_STYLES[part.status] || 'bg-gray-100 text-gray-500 border-gray-200';
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-4 hover:shadow-sm transition-shadow">
      <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded border shrink-0 ${style}`}>{part.status}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm">{part.name || '--'}</p>
        <p className="text-xs text-gray-400">{part.description}</p>
      </div>
      <div className="text-xs text-gray-500 text-right shrink-0">
        <p>WO #{part.woNumber}</p>
        <p className="text-gray-400">Code: {part.repairCode}</p>
      </div>
    </div>
  );
}
