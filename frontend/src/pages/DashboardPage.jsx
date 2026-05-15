import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Home, Wrench, Package, QrCode, HelpCircle,
  Clock, ChevronDown, ChevronRight, LayoutGrid, List,
  Search, ArrowRight
} from 'lucide-react';
import { WORK_ORDERS, PARTS_REQUESTS, CURRENT_TECHNICIAN } from '../data/mockData';
import IndirectActivityModal from '../components/IndirectActivityModal';
import NovaAssistant from '../components/NovaAssistant';

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}d ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const PRIORITY_STYLES = {
  LOW:    'bg-green-50 text-green-700 border-green-200',
  MEDIUM: 'bg-blue-50 text-blue-700 border-blue-200',
  HIGH:   'bg-orange-50 text-orange-700 border-orange-200',
  URGENT: 'bg-red-50 text-red-700 border-red-200',
};

const PARTS_STYLES = {
  'PARTS UNASSIGNED': 'bg-amber-50 text-amber-700 border-amber-200',
  'PARTS ASSIGNED':   'bg-blue-50 text-blue-700 border-blue-200',
  'PARTS ISSUED':     'bg-green-50 text-green-700 border-green-200',
};

const STATUS_STYLES = {
  Requested: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  Issued:    'bg-green-50 text-green-700 border-green-200',
  Cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

export default function DashboardPage() {
  const location = useLocation();
  const technician = location.state?.technician || CURRENT_TECHNICIAN;

  const [activeSection, setActiveSection] = useState('repairs');
  const [activeTab, setActiveTab] = useState('open');
  const [partsTab, setPartsTab] = useState('active');
  const [partsFilter, setPartsFilter] = useState('All');
  const [partsFilterOpen, setPartsFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [shiftActive, setShiftActive] = useState(true);
  const [shiftDuration, setShiftDuration] = useState(Date.now() - CURRENT_TECHNICIAN.shiftStartedAt.getTime());
  const [indirectModal, setIndirectModal] = useState(false);
  const [currentActivity, setCurrentActivity] = useState('Blood Drive');
  const [category, setCategory] = useState('');
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    if (!shiftActive) return;
    const id = setInterval(() => {
      setShiftDuration(Date.now() - CURRENT_TECHNICIAN.shiftStartedAt.getTime());
    }, 1000);
    return () => clearInterval(id);
  }, [shiftActive]);

  const repairsList = WORK_ORDERS.filter((wo) =>
    activeTab === 'open' ? wo.isOpen : !wo.isOpen
  ).filter((wo) =>
    !searchText || wo.title.toLowerCase().includes(searchText.toLowerCase()) ||
    wo.woNumber.includes(searchText)
  );

  const partsList = PARTS_REQUESTS.filter((p) => {
    const isActive = p.status === 'Requested' || p.status === 'Issued';
    if (partsTab === 'active' && !isActive) return false;
    if (partsTab === 'past' && isActive) return false;
    if (partsFilter !== 'All' && p.status !== partsFilter) return false;
    return true;
  });

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning,';
    if (h < 17) return 'Good Afternoon,';
    return 'Good Evening,';
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden" onClick={() => setPartsFilterOpen(false)}>
      {/* Layout: sidebar + main */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-14 bg-white border-r border-gray-200 flex flex-col items-center py-3 gap-1 shrink-0">
          {[
            { id: 'home',    icon: Home,     label: 'Home'    },
            { id: 'repairs', icon: Wrench,   label: 'Repairs' },
            { id: 'parts',   icon: Package,  label: 'Parts'   },
            { id: 'vin',     icon: QrCode,   label: 'VIN'     },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => id === 'repairs' || id === 'parts' ? setActiveSection(id) : setActiveSection(id)}
              title={label}
              className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors
                ${activeSection === id ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-medium leading-none">{label}</span>
            </button>
          ))}
          <div className="flex-1" />
          <button title="Help" className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors">
            <HelpCircle className="w-5 h-5" />
          </button>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header */}
          <header className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 flex-1">
              <span className="font-bold text-gray-900 text-sm">Company</span>
              <span className="font-light text-gray-400 text-sm">Logo</span>
              <span className="ml-1 px-2 py-0.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded border border-gray-200">
                BADGER RD
              </span>
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
                <p className="font-bold text-base">{CURRENT_TECHNICIAN.startedAtLabel}</p>
              </div>
            </div>
            <div className="border-l border-blue-500 pl-6 flex flex-col items-end gap-2 shrink-0">
              <p className="text-blue-200 text-xs">Status: <span className="text-white font-medium">{currentActivity}</span></p>
              <button
                onClick={() => setShiftActive(!shiftActive)}
                className="flex items-center gap-1.5 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold transition-colors border border-white/30"
              >
                {shiftActive ? (
                  <>
                    <Clock className="w-4 h-4" />
                    End Shift
                  </>
                ) : (
                  <>▶ Begin Shift</>
                )}
              </button>
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto">
            {/* Section tabs: Repairs | Parts Inventory */}
            <div className="bg-white border-b border-gray-200 px-4 flex items-center gap-0">
              {[
                { id: 'repairs', label: 'Repairs', icon: Wrench },
                { id: 'parts',   label: 'Parts Inventory', icon: Package },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                    ${activeSection === id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* ── REPAIRS ── */}
            {activeSection === 'repairs' && (
              <div className="p-4">
                {/* Filter bar */}
                <div className="flex items-center gap-2 mb-3">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-300"
                  >
                    <option value="">Select category</option>
                    <option value="engine">Engine</option>
                    <option value="brakes">Brakes</option>
                    <option value="tires">Tires</option>
                  </select>
                  <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white flex-1 max-w-xs focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-200 transition-all">
                    <Search className="w-4 h-4 text-gray-400 ml-3 shrink-0" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="flex-1 px-2 py-2 text-sm outline-none bg-transparent"
                    />
                    <button className="px-2 py-2 hover:bg-gray-50 border-l border-gray-200">
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                  <select className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-300">
                    <option>My Repairs in My Shop</option>
                    <option>All Shop Repairs</option>
                  </select>
                  <div className="flex-1" />
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                  <button className="flex items-center gap-1 text-sm text-blue-600 font-medium hover:text-blue-700">
                    View all <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Open / Closed sub-tabs */}
                <div className="flex items-center gap-1 mb-4">
                  {['open', 'closed'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setActiveTab(t)}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors capitalize
                        ${activeTab === t ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>

                {repairsList.length === 0 ? (
                  <EmptyState message="No work orders currently assigned" />
                ) : viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {repairsList.map((wo) => <WorkOrderCard key={wo.id} wo={wo} />)}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {repairsList.map((wo) => <WorkOrderRow key={wo.id} wo={wo} />)}
                  </div>
                )}
              </div>
            )}

            {/* ── PARTS INVENTORY ── */}
            {activeSection === 'parts' && (
              <div className="p-4">
                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: 'Requested Parts', count: PARTS_REQUESTS.filter(p => p.status === 'Requested').length, icon: '📋' },
                    { label: 'Issued Parts',    count: PARTS_REQUESTS.filter(p => p.status === 'Issued').length,    icon: '✓'  },
                    { label: 'Delayed Parts',   count: PARTS_REQUESTS.filter(p => p.status === 'Cancelled').length, icon: '⏱' },
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

                {/* Sub-tabs + filter */}
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

                  {/* Filter dropdown */}
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
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>

                {partsList.length === 0 ? (
                  <EmptyState message="No parts requests found" />
                ) : viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {partsList.map((p) => <PartCard key={p.id} part={p} />)}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {partsList.map((p) => <PartRow key={p.id} part={p} />)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Indirect Activity Modal */}
      {indirectModal && (
        <IndirectActivityModal
          onClose={() => setIndirectModal(false)}
          onSelect={(activity) => {
            setCurrentActivity(activity);
            setIndirectModal(false);
          }}
        />
      )}

      {/* Nova AI Assistant */}
      <NovaAssistant
        technician={technician}
        onAction={(action) => {
          if (action.action === 'navigate') setActiveSection(action.section);
          if (action.action === 'begin_shift') setShiftActive(true);
          if (action.action === 'end_shift') setShiftActive(false);
          if (action.action === 'set_indirect_activity') setCurrentActivity(action.activity);
        }}
      />
    </div>
  );
}

function ViewToggle({ viewMode, setViewMode }) {
  return (
    <div className="flex items-center gap-0 border border-gray-200 rounded-lg overflow-hidden bg-white">
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
  );
}

function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <div className="relative w-20 h-20 mb-4 opacity-30">
        <div className="absolute inset-0 border-4 border-gray-300 rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl">🔍</div>
      </div>
      <p className="text-sm font-medium text-gray-500">{message}</p>
    </div>
  );
}

function WorkOrderCard({ wo }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-3">
        <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${PRIORITY_STYLES[wo.priority]}`}>
          {wo.priority}
        </span>
        <span className={`px-2 py-0.5 text-xs font-medium rounded border ${PARTS_STYLES[wo.partsStatus] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
          {wo.partsStatus}
        </span>
      </div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400">WO Number: <span className="font-medium text-gray-700">{wo.woNumber}</span></span>
        <span className="text-xs text-gray-400">WO Status: <span className="font-medium text-gray-700">{wo.woStatus}</span></span>
      </div>
      <p className="font-semibold text-gray-900 mb-1">{wo.title}</p>
      <div className="text-xs text-gray-500 mb-1">
        <span className="font-medium text-gray-700 text-sm">Asset</span>
        <span className="text-gray-400 ml-1">{wo.asset} {wo.assetId}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-500 mt-2">
        <div><span className="text-gray-400">Repair Code:</span> <span className="font-medium text-gray-700">{wo.repairCode}</span></div>
        <div><span className="text-gray-400">Shop:</span> <span className="font-medium text-gray-700">{wo.shop}</span></div>
        <div><span className="text-gray-400">Time Standard:</span> <span className="font-medium text-gray-700">{wo.timeStandard}</span></div>
        <div><span className="text-gray-400">Date In:</span> <span className="font-medium text-gray-700">{wo.dateIn}</span></div>
      </div>
      <button className="mt-3 w-full py-2 bg-gray-50 hover:bg-blue-50 hover:text-blue-700 border border-gray-200 hover:border-blue-300 rounded-lg text-sm font-medium text-gray-600 transition-colors">
        Resume
      </button>
    </div>
  );
}

function WorkOrderRow({ wo }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-4 hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-2 shrink-0">
        <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${PRIORITY_STYLES[wo.priority]}`}>{wo.priority}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm">{wo.title}</p>
        <p className="text-xs text-gray-400">WO #{wo.woNumber} · {wo.asset} {wo.assetId}</p>
      </div>
      <div className="text-xs text-gray-500 shrink-0">{wo.dateIn}</div>
      <button className="px-4 py-1.5 bg-gray-50 hover:bg-blue-50 hover:text-blue-700 border border-gray-200 hover:border-blue-300 rounded-lg text-xs font-medium text-gray-600 transition-colors shrink-0">
        Resume
      </button>
    </div>
  );
}

function PartCard({ part }) {
  const style = STATUS_STYLES[part.status] || 'bg-gray-100 text-gray-500 border-gray-200';
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
      <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded border mb-3 ${style}`}>
        {part.status}
      </span>
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
      <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded border shrink-0 ${style}`}>
        {part.status}
      </span>
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
