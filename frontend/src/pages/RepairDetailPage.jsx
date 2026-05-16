import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Home, Wrench, Package, QrCode, HelpCircle,
  Search, X, Plus, ChevronRight,
  AlertCircle, ArrowUpCircle, MinusCircle, ArrowDownCircle,
  Calendar, Edit3, FileText, ScanLine, Clock, Mail, Info,
} from 'lucide-react';
import { getWorkOrderRepair, getRepairNotes, addRepairNote, getRepairTasks, getRepairTimer, startRepairTimer, completeRepair, getRepairReasons, setRepairReason, getWorkOrderStatuses, changeWorkOrderStatus } from '../api/workOrders';
import { getRepairParts, searchPartsCatalog } from '../api/parts';

const PRIORITY_BADGE = {
  URGENT: { bg: 'bg-red-50',   border: 'border-red-300',   text: 'text-red-600',   Icon: AlertCircle     },
  HIGH:   { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-600', Icon: ArrowUpCircle   },
  MEDIUM: { bg: 'bg-slate-50', border: 'border-slate-300', text: 'text-slate-600', Icon: MinusCircle     },
  LOW:    { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-600', Icon: ArrowDownCircle },
};

function normalizePriority(priority) {
  const v = (priority || '').toUpperCase();
  if (v === 'MED') return 'MEDIUM';
  if (v === 'RED') return 'URGENT';
  return v || 'LOW';
}

function formatHours(hours) {
  if (hours == null) return '--';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} Hrs`;
}

function formatDate(value) {
  if (!value) return '--';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '--';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatTimerMs(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')} Hrs`;
}

function formatDateTime(value) {
  if (!value) return '--';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '--';
  return (
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
}


export default function RepairDetailPage() {
  const { repairId } = useParams();
  const navigate     = useNavigate();

  const technician = (() => {
    try {
      const saved = sessionStorage.getItem('loggedInTechnician');
      return saved ? JSON.parse(saved) : { name: 'Technician' };
    } catch { return { name: 'Technician' }; }
  })();

  // ── Core repair state ──────────────────────────────────────────────────────
  const [repair,         setRepair]         = useState(null);
  const [repairLoading,  setRepairLoading]  = useState(true);

  // ── Notes state ────────────────────────────────────────────────────────────
  const [notes,             setNotes]             = useState([]);
  const [notesSearch,       setNotesSearch]       = useState('');
  const [notesSearchQuery,  setNotesSearchQuery]  = useState('');
  const [notesFilter,       setNotesFilter]       = useState('all');
  const [showAddNoteModal,  setShowAddNoteModal]  = useState(false);

  // ── Parts state ────────────────────────────────────────────────────────────
  const [partsCount,       setPartsCount]       = useState(0);
  const [configuredParts,  setConfiguredParts]  = useState([]);
  const [partSearch,       setPartSearch]       = useState('');
  const [catalogResults,   setCatalogResults]   = useState([]);
  const [issueTarget,      setIssueTarget]      = useState(null);
  const [issueQty,         setIssueQty]         = useState(1);
  const searchRef = useRef(null);

  // ── Timer state ────────────────────────────────────────────────────────────
  const [timerRunning,     setTimerRunning]     = useState(false);
  const [timerStartedAt,   setTimerStartedAt]   = useState(null);
  const [timerElapsed,     setTimerElapsed]     = useState(0);

  // ── Tasks state ────────────────────────────────────────────────────────────
  const [tasks,               setTasks]               = useState([]);
  const [tasksLoading,        setTasksLoading]        = useState(false);
  const [taskResolutions,     setTaskResolutions]     = useState({});
  const [taskComments,        setTaskComments]        = useState({});
  const [expandedInstructions, setExpandedInstructions] = useState(new Set());

  // ── UI state ───────────────────────────────────────────────────────────────
  const [activeTab,      setActiveTab]      = useState('notes');
  const [showStartModal, setShowStartModal] = useState(false);
  const [showDoneModal,  setShowDoneModal]  = useState(false);
  const [completing,     setCompleting]     = useState(false);

  // ── Change Reason modal state ──────────────────────────────────────────────
  const [showReasonModal,  setShowReasonModal]  = useState(false);
  const [reasons,          setReasons]          = useState([]);
  const [selectedReasonId, setSelectedReasonId] = useState(null);
  const [savingReason,     setSavingReason]     = useState(false);
  const [toast,            setToast]            = useState(null);

  // ── Change Status modal state ──────────────────────────────────────────────
  const [showStatusModal,    setShowStatusModal]    = useState(false);
  const [statuses,           setStatuses]           = useState([]);
  const [selectedStatusCode, setSelectedStatusCode] = useState(null);
  const [savingStatus,       setSavingStatus]       = useState(false);

  // ── Fetch repair ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!repairId) return;
    setRepairLoading(true);
    getWorkOrderRepair(repairId)
      .then((r) => setRepair(r.data?.data ?? r.data))
      .catch(() => {})
      .finally(() => setRepairLoading(false));
  }, [repairId]);

  // ── Fetch parts ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!repairId) return;
    getRepairParts({ repairId, pageNumber: 1, pageSize: 20 })
      .then((r) => {
        const d = r.data;
        const items = d?.data || [];
        setPartsCount(d?.total ?? d?.totalCount ?? items.length ?? 0);
        if (items.length > 0) {
          setConfiguredParts(items.map((p) => ({
            partNumber: p.partId ? String(p.partId) : '--',
            partName:   p.partName || '--',
            availableQty: p.issuedQty ?? 0,
            qtyRequired:  p.requestedQty ?? null,
          })));
        }
      })
      .catch(() => {});
  }, [repairId]);

  // ── Debounce notes search input ────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setNotesSearchQuery(notesSearch), 350);
    return () => clearTimeout(t);
  }, [notesSearch]);

  // ── Fetch notes (re-runs on repairId or debounced search query) ────────────
  const fetchNotes = (query = '') => {
    if (!repairId) return;
    getRepairNotes({ repairId, searchString: query })
      .then((r) => {
        const items = r.data?.data || r.data || [];
        setNotes(Array.isArray(items) ? items : []);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchNotes(notesSearchQuery);
  }, [repairId, notesSearchQuery]);

  // ── Fetch tasks ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!repairId) return;
    setTasksLoading(true);
    getRepairTasks(repairId)
      .then((r) => {
        const items = r.data?.data || [];
        if (items.length > 0) {
          setTasks(items);
          const resolutions = {};
          const comments    = {};
          items.forEach((t) => {
            if (t.resultName) {
              resolutions[t.repairTaskID] = t.resultName.toLowerCase().replace('/', '').replace(/\s+/g, '');
            }
            if (t.comment) comments[t.repairTaskID] = t.comment;
          });
          setTaskResolutions(resolutions);
          setTaskComments(comments);
        }
      })
      .catch(() => {})
      .finally(() => setTasksLoading(false));
  }, [repairId]);

  // ── Fetch + start repair timer ─────────────────────────────────────────────
  useEffect(() => {
    if (!repairId || !technician?.id) return;
    const tid = technician.id;
    getRepairTimer(repairId, tid)
      .then((r) => {
        const d = r.data?.data;
        if (d?.isRunning) {
          setTimerRunning(true);
          setTimerStartedAt(d.startTime);
          setTimerElapsed(d.elapsedSeconds * 1000);
        } else {
          startRepairTimer(repairId, tid)
            .then((sr) => {
              const sd = sr.data?.data;
              setTimerRunning(true);
              setTimerStartedAt(sd?.startTime ?? new Date().toISOString());
              setTimerElapsed(0);
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [repairId, technician?.id]);

  useEffect(() => {
    if (!timerRunning || !timerStartedAt) return;
    const id = setInterval(() => {
      setTimerElapsed(Date.now() - new Date(timerStartedAt).getTime());
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning, timerStartedAt]);

  // ── Load repair reasons when modal opens ──────────────────────────────────
  useEffect(() => {
    if (!showReasonModal || reasons.length > 0) return;
    getRepairReasons()
      .then((r) => setReasons(r.data?.data || []))
      .catch(() => {});
  }, [showReasonModal]);

  // ── Load WO statuses when modal opens ─────────────────────────────────────
  useEffect(() => {
    if (!showStatusModal || statuses.length > 0) return;
    getWorkOrderStatuses()
      .then((r) => setStatuses(r.data?.data || []))
      .catch(() => {});
  }, [showStatusModal]);

  // ── Catalog search (debounced) ─────────────────────────────────────────────
  useEffect(() => {
    if (!partSearch.trim()) { setCatalogResults([]); return; }
    const t = setTimeout(() => {
      searchPartsCatalog({ q: partSearch.trim() })
        .then((r) => setCatalogResults(r.data?.data || []))
        .catch(() => setCatalogResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [partSearch]);

  // ── Computed values ────────────────────────────────────────────────────────
  const repairTitle  = repair
    ? ([repair.actionDesc, repair.groupDesc, repair.componentDesc].filter(Boolean).join(' ') || `Repair ${repair.repairId}`)
    : (repairLoading ? 'Loading...' : '--');
  const repairCode   = repair?.repairScheduleID || repairId;
  const woNumber     = repair?.documentNumber   || (repair?.documentId != null ? String(repair.documentId) : '--');
  const woStatusCode = repair?.workOrderStatusCode || '--';
  const woStatusDesc = repair?.workOrderStatusDesc || repair?.workOrderStatusCode || '--';
  const repairReason = repair?.repairReasonDesc    || '--';
  const priority     = normalizePriority(repair?.priority);
  const asset        = repair ? ([repair.yearMake, repair.model].filter(Boolean).join(' ') || repair.assetNumber || '--') : '--';
  const assetLabel   = [asset, repair?.assetNumber].filter((v) => v && v !== '--').join(' ');
  const shop         = repair?.maintShopDesc || repair?.maintShop || '--';
  const licenseNum   = repair?.licenseNumber  || '--';
  const vehicleType  = repair?.vehicleType    || repair?.assetType || '--';
  const yearMakeModel = [repair?.year, repair?.make || repair?.yearMake, repair?.model].filter(Boolean).join(' ') || '--';
  const serialNumber = repair?.serialNumber   || repair?.vinNumber  || '--';
  const timeStd      = formatHours(repair?.timeStandardHours);
  const dateIn       = formatDate(repair?.inDate);
  const promisedTime = formatDateTime(repair?.promisedDate || repair?.endDate);
  const hasParts     = !!repair?.hasParts;

  const filteredNotes = notes.filter((n) => {
    if (notesFilter === 'wo'     && !n.isWorkOrder) return false;
    if (notesFilter === 'repair' &&  n.isWorkOrder) return false;
    return true;
  });

  const woLabel     = woNumber !== '--' ? `WO-${woNumber}` : 'WO';
  const repairLabel = repairCode || repairId;

  const searchResults = catalogResults;

  const completedCount    = Object.values(taskResolutions).filter((r) => r === 'completed').length;
  const allTasksResolved  = tasks.length > 0 && tasks.every((t) => taskResolutions[t.repairTaskID] != null);
  const tasksLabel        = `Tasks (${completedCount}/${tasks.length || 8})`;

  const toggleInstruction = (taskId) =>
    setExpandedInstructions((prev) => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });

  return (
    <div className="h-screen flex bg-gray-50 overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="w-20 bg-white border-r border-gray-200 flex flex-col items-center py-4 gap-1 shrink-0">
        {[
          { id: 'home',    Icon: Home,    label: 'Home',        onClick: () => navigate('/dashboard') },
          { id: 'repairs', Icon: Wrench,  label: 'Repairs',     onClick: () => {} },
          { id: 'parts',   Icon: Package, label: 'Parts',       onClick: () => {} },
          { id: 'vin',     Icon: QrCode,  label: 'VIN Scanner', onClick: () => {} },
        ].map(({ id, Icon, label, onClick }) => (
          <button
            key={id}
            onClick={onClick}
            title={label}
            className={`w-16 py-2.5 rounded-xl flex flex-col items-center gap-1 transition-colors
              ${id === 'repairs' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-tight text-center">{label}</span>
          </button>
        ))}
        <div className="flex-1" />
        <button
          title="Help"
          className="w-16 py-2.5 rounded-xl flex flex-col items-center gap-1 text-gray-400 hover:text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <HelpCircle className="w-5 h-5" />
          <span className="text-[10px] font-medium">Help</span>
        </button>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Breadcrumb bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              Repairs
            </button>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <span className="font-bold text-gray-900 underline underline-offset-2">
              Repair Code: {repairCode}
            </span>
          </div>
          {/* <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Plus className="w-4 h-4" />
            Add New Repair
          </button> */}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex gap-6">

            {/* ── Left column ── */}
            <div className="flex-1 min-w-0 flex flex-col gap-0">

              {/* Hero card */}
              <div className="bg-slate-100 rounded-xl p-5 mb-4">
                <p className="text-gray-700 font-medium mb-5 text-sm">{repairTitle}</p>
                <div className="flex items-end gap-8">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Time Standard</p>
                    <p className="text-2xl font-bold text-gray-900">{timeStd}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Repair Timer</p>
                    <p className="text-2xl font-bold text-gray-900 font-mono">
                      {timerRunning ? formatTimerMs(timerElapsed) : '--:--:-- Hrs'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {timerStartedAt
                        ? `Started at: ${new Date(timerStartedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        : 'Not started'}
                    </p>
                  </div>
                  <div className="flex-1" />
                  <div className="flex items-center gap-3 pb-1">
                    <button
                      disabled={!allTasksResolved || completing}
                      onClick={() => setShowDoneModal(true)}
                      className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-colors
                        ${allTasksResolved && !completing
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'text-gray-400 bg-gray-200 cursor-not-allowed select-none'
                        }`}
                    >
                      <CheckCircleIcon className="w-4 h-4" />
                      Complete Repair
                    </button>
                    {/* <button
                      onClick={() => setShowStartModal(true)}
                      className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Start New Repair
                    </button> */}
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-200 flex items-center mb-5">
                {[
                  { id: 'notes',       label: 'Notes',        badge: null              },
                  { id: 'parts',       label: 'Parts',        badge: partsCount || null },
                  { id: 'tasks',       label: tasksLabel,     badge: null              },
                  { id: 'attachments', label: 'Attachments',  badge: null              },
                ].map(({ id, label, badge }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                      ${activeTab === id
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                  >
                    {label}
                    {badge != null && (
                      <span className="w-5 h-5 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* ── Notes tab ── */}
              {activeTab === 'notes' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-900 text-base">Notes</h3>
                    <button
                      onClick={() => setShowAddNoteModal(true)}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add new note
                    </button>
                  </div>
                  <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white mb-4 focus-within:border-blue-400 transition-colors">
                    <Search className="w-4 h-4 text-gray-400 ml-3 shrink-0" />
                    <input
                      type="text"
                      placeholder="Search notes..."
                      value={notesSearch}
                      onChange={(e) => setNotesSearch(e.target.value)}
                      className="flex-1 px-2 py-2.5 text-sm outline-none bg-transparent"
                    />
                    <button className="px-3 py-2.5 border-l border-gray-200 hover:bg-gray-50 transition-colors">
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mb-4">
                    {[
                      { id: 'all',    label: 'All Notes'               },
                      { id: 'wo',     label: `Work Order (${woLabel})`  },
                      { id: 'repair', label: `Repair (${repairLabel})`  },
                    ].map(({ id, label }) => (
                      <button
                        key={id}
                        onClick={() => setNotesFilter(id)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors
                          ${notesFilter === id
                            ? 'border border-gray-300 bg-white text-gray-800 font-medium'
                            : 'text-gray-500 hover:bg-gray-100'
                          }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-3">
                    {filteredNotes.length === 0
                      ? <div className="py-12 text-center text-gray-400 text-sm">No notes found</div>
                      : filteredNotes.map((note) => <NoteCard key={note.id} note={note} />)
                    }
                  </div>
                </div>
              )}

              {/* ── Parts tab ── */}
              {activeTab === 'parts' && (
                <div>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-900 text-base">Search or Scan Part</h3>
                    <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                      <Plus className="w-4 h-4" />
                      Add your own request
                    </button>
                  </div>

                  {/* Search row */}
                  <div className="relative mb-4" ref={searchRef}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white focus-within:border-blue-400 transition-colors">
                        <Search className="w-4 h-4 text-gray-400 ml-3 shrink-0" />
                        <input
                          type="text"
                          placeholder="Search for parts to request"
                          value={partSearch}
                          onChange={(e) => setPartSearch(e.target.value)}
                          className="flex-1 px-2 py-2.5 text-sm outline-none bg-transparent"
                        />
                        <button className="px-3 py-2.5 border-l border-gray-200 hover:bg-gray-50 transition-colors">
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                      <button className="p-2.5 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors shrink-0">
                        <ScanLine className="w-5 h-5 text-gray-500" />
                      </button>
                    </div>

                    {/* Search results dropdown */}
                    {partSearch.trim() && searchResults.length > 0 && (
                      <div className="absolute left-0 right-12 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                        {searchResults.map((part, i) => (
                          <div
                            key={part.partId + i}
                            className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 text-xs font-medium border border-gray-300 rounded text-gray-700 shrink-0">
                                  {part.partId}
                                </span>
                                <span className="flex items-center gap-1 text-xs text-green-600">
                                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full shrink-0" />
                                  In Stock ({part.availableQty} available)
                                </span>
                              </div>
                              <p className="font-semibold text-sm text-gray-900">{part.name}</p>
                              <p className="text-xs text-gray-400">{part.description}</p>
                            </div>
                            <button
                              onClick={() => { setIssueTarget(part); setIssueQty(1); }}
                              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shrink-0"
                            >
                              Issue Part
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Parts History + Messages (only when no active search) */}
                  {!partSearch.trim() && (
                    <div className="flex items-center gap-3 mb-5">
                      <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                        <Clock className="w-4 h-4" />
                        Parts History
                      </button>
                      <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                        <Mail className="w-4 h-4" />
                        Messages
                        {partsCount > 0 && (
                          <span className="w-5 h-5 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {partsCount}
                          </span>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Configured Part List */}
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-4 pt-4 pb-3 border-b border-gray-100">
                      <p className="font-bold text-gray-900 text-sm">Configured Part List</p>
                      <p className="text-xs text-gray-400 mt-0.5">Select parts and specify quantities to submit a request</p>
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="w-10 px-4 py-3" />
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Part Number</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Part Name</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Available Qty</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Qty Required</th>
                        </tr>
                      </thead>
                      <tbody>
                        {configuredParts.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">No parts configured</td>
                          </tr>
                        ) : (
                          configuredParts.map((part, i) => (
                            <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 accent-blue-600 cursor-pointer" />
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">{part.partNumber}</td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">{part.partName}</td>
                              <td className="px-4 py-3 text-sm text-gray-700 text-right tabular-nums">
                                {String(Number(part.availableQty) || 0).padStart(2, '0')}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-400 text-right">
                                {part.qtyRequired != null ? part.qtyRequired : '--'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── Tasks tab ── */}
              {activeTab === 'tasks' && (
                <div className="space-y-4">
                  {tasksLoading ? (
                    <div className="py-12 text-center text-gray-400 text-sm">Loading tasks...</div>
                  ) : tasks.length === 0 ? (
                    <div className="py-12 text-center text-gray-400 text-sm">No tasks assigned</div>
                  ) : (
                    tasks.map((task) => (
                      <TaskCard
                        key={task.repairTaskID}
                        task={task}
                        resolution={taskResolutions[task.repairTaskID] || null}
                        onResolution={(r) => setTaskResolutions((prev) => ({ ...prev, [task.repairTaskID]: r }))}
                        comment={taskComments[task.repairTaskID] || ''}
                        onComment={(c) => setTaskComments((prev) => ({ ...prev, [task.repairTaskID]: c }))}
                        instructionExpanded={expandedInstructions.has(task.repairTaskID)}
                        onToggleInstruction={() => toggleInstruction(task.repairTaskID)}
                        technicianName={technician?.name}
                      />
                    ))
                  )}
                </div>
              )}

              {activeTab === 'attachments' && (
                <div className="py-12 text-center text-gray-400 text-sm">No attachments</div>
              )}
            </div>

            {/* ── Right sidebar ── */}
            <div className="w-72 shrink-0 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-gray-900 text-lg">Repair Details</h2>
                <button className="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  Repair History
                </button>
              </div>

              <div className="border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">Work Order Status</p>
                <p className="font-bold text-gray-900 text-sm mb-3 leading-snug">{woStatusDesc}</p>
                <button
                  onClick={() => { setSelectedStatusCode(repair?.workOrderStatusCode || null); setShowStatusModal(true); }}
                  className="w-full py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Change Status
                </button>
              </div>

              <div className="border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">Repair Reason</p>
                <p className="font-bold text-gray-900 text-sm mb-3 leading-snug">{repairReason}</p>
                <button
                  onClick={() => { setSelectedReasonId(repair?.repairReasonId || null); setShowReasonModal(true); }}
                  className="w-full py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Change Reason
                </button>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-gray-700">
                  Asset: <span className="font-bold text-gray-900">{assetLabel || '--'}</span>
                </p>
                <p className="text-sm text-gray-700">
                  Work Order Number: <span className="font-bold text-gray-900">{woNumber}</span>
                </p>
              </div>

              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Asset Info</p>
                <div className="space-y-1.5">
                  {[
                    ['License Number',    licenseNum   ],
                    ['Type',              vehicleType  ],
                    ['Year Make Model',   yearMakeModel],
                    ['Shop',              shop         ],
                    ['VIN/Serial Number', serialNumber ],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-2">
                      <span className="text-xs text-gray-500 shrink-0">{label}</span>
                      <span className="text-xs font-semibold text-gray-900 text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Work Order</p>
                <div className="space-y-1.5">
                  {[
                    ['WO Number',     woNumber    ],
                    ['WO Status',     woStatusCode],
                    ['Date In',       dateIn      ],
                    ['Promised Time', promisedTime],
                    ['Time Standard', repair?.timeStandardHours != null ? `${repair.timeStandardHours} hours` : '--'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-2">
                      <span className="text-xs text-gray-500 shrink-0">{label}</span>
                      <span className="text-xs font-semibold text-gray-900 text-right">{value}</span>
                    </div>
                  ))}
                  {hasParts && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-500 shrink-0">Parts</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full border bg-green-50 border-green-300 text-green-700">
                        PARTS ASSIGNED
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-500 shrink-0">Priority</span>
                    <PriorityBadge priority={priority} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Start New Repair modal */}
      {showStartModal && (
        <ConfirmModal
          title="Confirm Start New Repair"
          message="Are you sure you want to start a new repair?"
          onClose={() => setShowStartModal(false)}
          onConfirm={() => setShowStartModal(false)}
        />
      )}

      {/* Confirm Complete Repair modal */}
      {showDoneModal && (
        <ConfirmModal
          title="Confirm Complete Repair"
          message="Are you sure you want to mark this repair as complete?"
          onClose={() => setShowDoneModal(false)}
          onConfirm={() => {
            setCompleting(true);
            setShowDoneModal(false);
            completeRepair({
              repairId: Number(repairId),
              technicianId: technician?.id,
              maintShopId: repair?.maintShopId || technician?.shopId || 0,
            })
              .then(() => navigate('/dashboard'))
              .catch(() => setCompleting(false));
          }}
        />
      )}

      {/* Issue Part modal */}
      {issueTarget && (
        <IssuePartModal
          part={issueTarget}
          qty={issueQty}
          onQtyChange={setIssueQty}
          onClose={() => setIssueTarget(null)}
          onConfirm={() => setIssueTarget(null)}
        />
      )}

      {/* Change Repair Reason modal */}
      {showReasonModal && (
        <ChangeReasonModal
          currentReasonDesc={repairReason}
          reasons={reasons}
          selectedId={selectedReasonId}
          onSelect={setSelectedReasonId}
          saving={savingReason}
          onClose={() => setShowReasonModal(false)}
          onConfirm={() => {
            if (selectedReasonId == null) return;
            setSavingReason(true);
            setRepairReason(repairId, selectedReasonId)
              .then(() => {
                setRepair((prev) => prev ? { ...prev, repairReasonId: selectedReasonId, repairReasonDesc: reasons.find((r) => r.repairReasonId === selectedReasonId)?.reason || prev.repairReasonDesc } : prev);
                setShowReasonModal(false);
                setToast('Repair Reason Successfully Updated.');
                setTimeout(() => setToast(null), 4000);
              })
              .catch(() => {})
              .finally(() => setSavingReason(false));
          }}
        />
      )}

      {/* Change Work Order Status modal */}
      {showStatusModal && (
        <ChangeStatusModal
          currentStatusDesc={woStatusDesc}
          statuses={statuses}
          selectedCode={selectedStatusCode}
          onSelect={setSelectedStatusCode}
          saving={savingStatus}
          onClose={() => setShowStatusModal(false)}
          onConfirm={() => {
            if (!selectedStatusCode) return;
            setSavingStatus(true);
            changeWorkOrderStatus(repairId, selectedStatusCode)
              .then(() => {
                const matched = statuses.find((s) => s.status === selectedStatusCode);
                setRepair((prev) => prev ? {
                  ...prev,
                  workOrderStatusCode: selectedStatusCode,
                  workOrderStatusDesc: matched?.statusDesc || selectedStatusCode,
                } : prev);
                setShowStatusModal(false);
                setToast('Work Order Status Successfully Updated.');
                setTimeout(() => setToast(null), 4000);
              })
              .catch(() => {})
              .finally(() => setSavingStatus(false));
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast message={toast} onDismiss={() => setToast(null)} />
      )}

      {/* Add Note modal */}
      {showAddNoteModal && (
        <AddNoteModal
          repairId={Number(repairId)}
          documentId={repair?.documentId ?? Number(repairId)}
          technicianId={technician?.id}
          onClose={() => setShowAddNoteModal(false)}
          onSuccess={() => {
            fetchNotes(notesSearchQuery);
            setToast('Note added successfully.');
            setTimeout(() => setToast(null), 4000);
          }}
        />
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PriorityBadge({ priority }) {
  const cfg = PRIORITY_BADGE[priority] || PRIORITY_BADGE.LOW;
  const { bg, border, text, Icon } = cfg;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${bg} ${border} ${text}`}>
      <Icon className="w-3 h-3" />
      {priority}
    </span>
  );
}

function NoteCard({ note }) {
  const subject   = note.noteSubject || note.subject || note.title || '--';
  const body      = note.noteText    || note.note    || note.body  || '--';
  const author    = note.userName    || note.authorName || note.createdBy || '';
  const initials  = author ? author.replace('.', '').slice(0, 2).toUpperCase() : 'U';
  const date      = note.createdDate || note.date || '';
  const typeLabel = note.isWorkOrder ? 'Work Order' : 'Repair';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-bold text-gray-900 text-sm">{subject}</span>
        <span className="px-2 py-0.5 text-[10px] font-medium text-gray-500 bg-gray-100 rounded border border-gray-200">
          {typeLabel}
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-3 leading-snug line-clamp-3">{body}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
          {initials}
        </div>
        <span className="text-xs text-gray-700 font-medium">{author}</span>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Calendar className="w-3.5 h-3.5" />
          <span>{date ? new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '--'}</span>
        </div>
        <div className="flex-1" />
        <button className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors">
          <Edit3 className="w-3.5 h-3.5" />
          Edit Note
        </button>
        <button className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors">
          <FileText className="w-3.5 h-3.5" />
          View Full Note
        </button>
      </div>
    </div>
  );
}

function AddNoteModal({ repairId, documentId, technicianId, onClose, onSuccess }) {
  const [subject,  setSubject]  = useState('');
  const [noteText, setNoteText] = useState('');
  const [isWO,     setIsWO]     = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = () => {
    if (!subject.trim()) { setError('Subject is required.'); return; }
    if (!noteText.trim()) { setError('Note text is required.'); return; }
    setSaving(true);
    setError('');
    addRepairNote({
      id: isWO ? documentId : repairId,
      subject: subject.trim(),
      note: noteText.trim(),
      isDocument: isWO,
      createdTechnicianID: technicianId,
      createdUserID: technicianId || 0,
    })
      .then(() => { onSuccess(); onClose(); })
      .catch(() => setError('Failed to save note. Please try again.'))
      .finally(() => setSaving(false));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-2xl w-[560px] p-6">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Add New Note</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2 mb-5">
          {[
            { id: false, label: 'Repair Note'      },
            { id: true,  label: 'Work Order Note'  },
          ].map(({ id, label }) => (
            <button
              key={String(id)}
              onClick={() => setIsWO(id)}
              className={`px-4 py-2 text-sm rounded-lg border transition-colors
                ${isWO === id
                  ? 'bg-blue-50 border-blue-400 text-blue-700 font-semibold'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Subject</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Note subject"
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 transition-colors"
          />
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Note</label>
          <textarea
            rows={4}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Enter your note here..."
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 transition-colors resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {saving ? 'Saving...' : 'Save Note'}
          </button>
        </div>
      </div>
    </div>
  );
}

const RESOLUTION_OPTIONS = [
  { id: 'replace',   label: 'Replace'   },
  { id: 'adjusted',  label: 'Adjusted'  },
  { id: 'completed', label: 'Completed' },
  { id: 'na',        label: 'N/A'       },
];

function TaskCard({ task, resolution, onResolution, comment, onComment, instructionExpanded, onToggleInstruction, technicianName }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <span className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0 mt-0.5">
          {task.stepNumber}
        </span>
        <p className="flex-1 font-semibold text-gray-900 text-sm leading-snug pt-0.5">{task.taskName}</p>
        <div className="flex items-center gap-3 shrink-0">
          {task.hasInstruction ? (
            <button
              onClick={onToggleInstruction}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors"
            >
              <Info className="w-3.5 h-3.5" />
              Instructions
            </button>
          ) : (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Info className="w-3.5 h-3.5" />
              No Instructions available
            </span>
          )}
          <button className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors">
            <Package className="w-3.5 h-3.5" />
            View/Add Parts
          </button>
        </div>
      </div>

      {/* Instruction box */}
      {instructionExpanded && task.instruction && (
        <div className="mb-4 border border-blue-200 rounded-lg p-3 bg-blue-50">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">How to complete this task</span>
          </div>
          <p className="text-xs text-gray-700 leading-relaxed">{task.instruction}</p>
        </div>
      )}

      {/* Resolution buttons */}
      <div className="mb-3">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Resolution</p>
        <div className="flex items-center gap-2 flex-wrap">
          {RESOLUTION_OPTIONS.map(({ id, label }) => {
            const isSelected = resolution === id;
            return (
              <button
                key={id}
                onClick={() => onResolution(isSelected ? null : id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors
                  ${isSelected
                    ? 'bg-white border-gray-500 text-gray-900 font-medium shadow-sm'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
              >
                {isSelected && id === 'completed' && <span className="text-gray-700 text-xs">✓</span>}
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Comment */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Comment (Optional)</p>
          {comment && technicianName && (
            <p className="text-[10px] text-gray-400">Added By: {technicianName}</p>
          )}
        </div>
        <textarea
          rows={2}
          value={comment}
          onChange={(e) => onComment(e.target.value)}
          placeholder="Add your comment here"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none outline-none focus:border-blue-400 text-gray-700 placeholder:text-gray-300 bg-white"
        />
      </div>
    </div>
  );
}

function ConfirmModal({ title, message, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-2xl w-[400px] p-6">
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        <div className="flex justify-end">
          <button
            onClick={onConfirm}
            className="px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function IssuePartModal({ part, qty, onQtyChange, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-2xl w-[480px] p-6">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Issue Part</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Part info card */}
        <div className="border border-gray-200 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="px-2 py-0.5 text-xs font-medium border border-gray-300 rounded text-gray-700">{part.partId}</span>
            <span className="flex items-center gap-1.5 text-xs text-green-600">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              In Stock ({part.availableQty} available)
            </span>
          </div>
          <p className="font-bold text-gray-900 text-base">{part.name}</p>
          <p className="text-sm text-gray-400 mt-0.5">{part.description}</p>
        </div>

        {/* Quantity stepper */}
        <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 mb-4">
          <span className="text-sm font-medium text-gray-700">Quantity to Add:</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onQtyChange(Math.max(1, qty - 1))}
              className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 font-bold text-lg leading-none transition-colors"
            >
              −
            </button>
            <span className="text-base font-semibold text-gray-900 w-6 text-center tabular-nums">{qty}</span>
            <button
              onClick={() => onQtyChange(qty + 1)}
              className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 font-bold text-lg leading-none transition-colors"
            >
              +
            </button>
          </div>
        </div>

        {/* Info box */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-6 text-xs text-gray-600 leading-relaxed">
          This part will be added to your parts history and submitted to the inventory team for processing.
        </div>

        <div className="flex justify-end">
          <button
            onClick={onConfirm}
            className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Confirm &amp; Issue Part
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckCircleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function ChangeReasonModal({ currentReasonDesc, reasons, selectedId, onSelect, saving, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-2xl w-[620px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Change Repair Reason</h2>
            {currentReasonDesc && currentReasonDesc !== '--' && (
              <p className="text-sm text-gray-500 mt-1">
                Current Repair Reason: <span className="font-semibold text-gray-800">{currentReasonDesc}</span>
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Reason grid */}
        <div className="px-6 pb-4 overflow-y-auto flex-1">
          {reasons.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">Loading reasons...</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {reasons.map((r) => {
                const isSelected = selectedId === r.repairReasonId;
                return (
                  <button
                    key={r.repairReasonId}
                    onClick={() => onSelect(r.repairReasonId)}
                    className={`px-4 py-3 text-sm rounded-lg border text-center transition-colors
                      ${isSelected
                        ? 'bg-blue-50 border-blue-400 text-blue-700 font-semibold'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    {r.reason}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex justify-end border-t border-gray-100 shrink-0">
          <button
            onClick={onConfirm}
            disabled={selectedId == null || saving}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {saving ? 'Saving...' : 'Select'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChangeStatusModal({ currentStatusDesc, statuses, selectedCode, onSelect, saving, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-2xl w-[620px] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Change Work Order Status</h2>
            {currentStatusDesc && currentStatusDesc !== '--' && (
              <p className="text-sm text-gray-500 mt-1">
                Current Work Order Status: <span className="font-semibold text-gray-800">{currentStatusDesc}</span>
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-4 overflow-y-auto flex-1">
          {statuses.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">Loading statuses...</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {statuses.map((s) => {
                const isSelected = selectedCode === s.status;
                const label = `${s.statusDesc} [${s.status}]`;
                return (
                  <button
                    key={s.workOrderStatusID ?? s.status}
                    onClick={() => onSelect(s.status)}
                    className={`px-4 py-3 text-sm rounded-lg border text-center transition-colors
                      ${isSelected
                        ? 'bg-blue-50 border-blue-400 text-blue-700 font-semibold'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-4 flex justify-end border-t border-gray-100 shrink-0">
          <button
            onClick={onConfirm}
            disabled={!selectedCode || saving}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {saving ? 'Saving...' : 'Select'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Toast({ message, onDismiss }) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 bg-green-600 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-lg">
      <CheckCircleIcon className="w-4 h-4 shrink-0" />
      <span>{message}</span>
      <button onClick={onDismiss} className="text-white/80 hover:text-white transition-colors ml-1">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
