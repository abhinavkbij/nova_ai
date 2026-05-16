import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check, ChevronDown, Search, LayoutGrid, List, Plus, Info,
  Calendar, AlertCircle, Car,
} from 'lucide-react';
import api from '../api/client';
import { verifyAsset } from '../api/assets';
import { getShops } from '../api/technicians';
import {
  createWorkOrder, createWorkOrderRepair, getWorkOrderDetails,
  getPendingRepairsForWO, getDepartments, getBillCodes,
  getRepairSchedules, getRepairActions, getRepairGroups,
  getRepairComponents,
} from '../api/workOrders';

const STEPS = [
  { id: 1, label: 'Asset & Organization\nSelection' },
  { id: 2, label: 'Asset Details\nView' },
  { id: 3, label: 'Work Order\nForm' },
  { id: 4, label: 'Repair\nSelection' },
  { id: 5, label: 'Repair\nCreation' },
];

const REPAIR_TYPE_BADGE = {
  'Pending repair':    'border-yellow-400 text-yellow-700 bg-yellow-50',
  'Scheduled action':  'border-blue-400   text-blue-700   bg-blue-50',
  'Overdue PM':        'border-red-400    text-red-700    bg-red-50',
  'New repair':        'border-green-400  text-green-700  bg-green-50',
};

function StepBadge({ step, current, done }) {
  if (done) {
    return (
      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
        <Check className="w-4 h-4 text-white" />
      </div>
    );
  }
  const active = step === current;
  return (
    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 text-sm font-bold
      ${active ? 'border-blue-600 text-blue-600 bg-white' : 'border-gray-300 text-gray-400 bg-white'}`}>
      {step}
    </div>
  );
}

function StepperBar({ current }) {
  return (
    <div className="flex items-start gap-0 mb-6">
      {STEPS.map((s, idx) => {
        const done = s.id < current;
        const active = s.id === current;
        return (
          <div key={s.id} className="flex items-start flex-1 min-w-0">
            <div className="flex flex-col items-center">
              <StepBadge step={s.id} current={current} done={done} />
              <p className={`text-xs mt-1 text-center leading-tight whitespace-pre-line
                ${active ? 'text-blue-600 font-semibold' : done ? 'text-gray-500' : 'text-gray-400'}`}
                style={{ maxWidth: '80px' }}>
                {s.label}
              </p>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mt-4 mx-1 ${done ? 'bg-blue-600' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Select({ value, onChange, options, placeholder, disabled }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50 pr-8"
      >
        <option value="">{placeholder || 'Select...'}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

function FormField({ label, required, children, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function CreateWorkOrderPage() {
  const navigate = useNavigate();
  const technician = JSON.parse(sessionStorage.getItem('loggedInTechnician') || '{}');

  const [step, setStep] = useState(1);

  // Step 1
  const [assetNumber, setAssetNumber] = useState('');
  const [orgId, setOrgId] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  // Step 2
  const [assetData, setAssetData] = useState(null);

  // Step 3 WO form
  const [woForm, setWoForm] = useState({
    shopId: '', statusCode: 'A', disableDowntime: false,
    meterActualReading: '', meterAccepted: false,
    department: '', dateIn: new Date().toISOString().slice(0, 16),
    datePromised: '', billCode: '', contact: '', priority: '', symptom: '',
  });
  const [creatingWO, setCreatingWO] = useState(false);
  const [woError, setWoError] = useState('');

  // Step 4
  const [workOrderId, setWorkOrderId] = useState(null);
  const [workOrderNumber, setWorkOrderNumber] = useState('');
  const [pendingRepairs, setPendingRepairs] = useState([]);
  const [selectedRepairIds, setSelectedRepairIds] = useState(new Set());
  const [repairFilter, setRepairFilter] = useState('All');
  const [repairViewMode, setRepairViewMode] = useState('grid');
  const [pendingLoading, setPendingLoading] = useState(false);

  // Step 5
  const [repairForm, setRepairForm] = useState({
    repairSchedule: '', repairReasonId: '', overduePM: '', scheduledAction: '',
    action: '', group: '', component: '', maintShopId: '', technicianId: '',
  });
  const [createdRepairs, setCreatedRepairs] = useState([]);
  const [creatingRepair, setCreatingRepair] = useState(false);
  const [repairError, setRepairError] = useState('');

  // Success
  const [successWO, setSuccessWO] = useState(null);

  // Lookups
  const [shops, setShops] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [billCodes, setBillCodes] = useState([]);
  const [repairReasons, setRepairReasons] = useState([]);
  const [repairSchedules, setRepairSchedules] = useState([]);
  const [repairActions, setRepairActions] = useState([]);
  const [repairGroups, setRepairGroups] = useState([]);
  const [repairComponents, setRepairComponents] = useState([]);

  useEffect(() => {
    if (!technician?.id) { navigate('/'); return; }
    Promise.all([
      getShops().catch(() => ({ data: [] })),
    ]).then(([shopsRes]) => {
      setShops((shopsRes.data?.data || shopsRes.data || []).map((s) => ({ value: String(s.id), label: s.name })));
    });
  }, []);  // eslint-disable-line

  // Load WO form lookups when reaching step 3
  useEffect(() => {
    if (step !== 3) return;
    Promise.all([
      getDepartments().catch(() => ({ data: { data: [] } })),
      getBillCodes().catch(() => ({ data: { data: [] } })),
    ]).then(([deptRes, billRes]) => {
      setDepartments((deptRes.data?.data || []).map((d) => ({ value: d.code, label: d.name })));
      setBillCodes((billRes.data?.data || []).map((b) => ({ value: b.code, label: b.name })));
    });
  }, [step]);

  // Load pending repairs when reaching step 4
  useEffect(() => {
    if (step !== 4 || !workOrderId) return;
    setPendingLoading(true);
    getPendingRepairsForWO(workOrderId)
      .then((res) => setPendingRepairs(res.data?.data || []))
      .catch(() => setPendingRepairs([]))
      .finally(() => setPendingLoading(false));
  }, [step, workOrderId]);

  // Load repair creation lookups when reaching step 5
  useEffect(() => {
    if (step !== 5) return;
    Promise.all([
      getRepairSchedules().catch(() => ({ data: { data: [] } })),
      getRepairActions().catch(() => ({ data: { data: [] } })),
      getRepairGroups().catch(() => ({ data: { data: [] } })),
      getRepairComponents().catch(() => ({ data: { data: [] } })),
    ]).then(([schRes, actRes, grpRes, cmpRes]) => {
      setRepairSchedules((schRes.data?.data || []).map((s) => ({ value: String(s.id), label: s.name })));
      setRepairActions((actRes.data?.data || []).map((a) => ({ value: a.name, label: a.name })));
      setRepairGroups((grpRes.data?.data || []).map((g) => ({ value: g.name, label: g.name })));
      setRepairComponents((cmpRes.data?.data || []).map((c) => ({ value: c.name, label: c.name })));
    });
    // Load repair reasons
    api.get('/LookUps/RepairReasons')
      .then((res) => setRepairReasons((res.data || []).map((r) => ({ value: String(r.id), label: r.description }))))
      .catch(() => {});
  }, [step]);

  // Re-fetch groups & components when action/group changes in step 5
  useEffect(() => {
    if (step !== 5) return;
    getRepairGroups().then((res) => setRepairGroups((res.data?.data || []).map((g) => ({ value: g.name, label: g.name })))).catch(() => {});
  }, [repairForm.action, step]);  // eslint-disable-line

  useEffect(() => {
    if (step !== 5) return;
    getRepairComponents().then((res) => setRepairComponents((res.data?.data || []).map((c) => ({ value: c.name, label: c.name })))).catch(() => {});
  }, [repairForm.group, step]);  // eslint-disable-line

  // ── Helpers ────────────────────────────────────────────────────────────────
  const meterError = (() => {
    const actual = parseFloat(woForm.meterActualReading);
    const recorded = assetData?.meterReading || 0;
    if (!woForm.meterActualReading) return '';
    if (!isNaN(actual) && actual < recorded * 0.5) return 'Actual meter reading entered seems incorrect.';
    return '';
  })();

  const woFormValid = woForm.shopId && woForm.statusCode && woForm.department && woForm.dateIn && woForm.billCode;

  const repairFormValid = repairForm.repairSchedule && repairForm.repairReasonId && repairForm.action && repairForm.group && repairForm.component && repairForm.maintShopId;

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleVerify = async () => {
    if (!assetNumber.trim() || !orgId) return;
    setVerifying(true);
    setVerifyError('');
    try {
      const res = await verifyAsset(assetNumber.trim(), parseInt(orgId));
      setAssetData(res.data?.data);
      setStep(2);
    } catch (err) {
      setVerifyError(err.response?.data?.detail || 'Asset not found. Please check the asset number and try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleCreateWO = async () => {
    if (!woFormValid) return;
    setCreatingWO(true);
    setWoError('');
    try {
      const res = await createWorkOrder({
        assetNumber: assetData.assetNumber,
        assetId: assetData.id,
        orgId: assetData.orgId,
        shopId: parseInt(woForm.shopId),
        statusCode: woForm.statusCode,
        department: woForm.department,
        dateIn: woForm.dateIn,
        datePromised: woForm.datePromised || undefined,
        billCode: woForm.billCode,
        contact: woForm.contact || undefined,
        priority: woForm.priority || 'MEDIUM',
        symptom: woForm.symptom || undefined,
        meterActualReading: woForm.meterActualReading ? parseFloat(woForm.meterActualReading) : undefined,
        disableDowntime: woForm.disableDowntime,
        assetYear: assetData.year,
        assetMake: assetData.make,
        assetModel: assetData.model,
      });
      const { workOrderId: woId, workOrderNumber: woNum } = res.data?.data || {};
      setWorkOrderId(woId);
      setWorkOrderNumber(woNum);
      setStep(4);
    } catch {
      setWoError('Failed to create work order. Please try again.');
    } finally {
      setCreatingWO(false);
    }
  };

  const handleSaveRepair = useCallback(async (andCreateNew = false) => {
    if (!repairFormValid) return;
    setCreatingRepair(true);
    setRepairError('');
    try {
      const res = await createWorkOrderRepair({
        workOrderId,
        repairSchedule: repairForm.repairSchedule,
        repairReasonId: parseInt(repairForm.repairReasonId),
        action: repairForm.action,
        group: repairForm.group,
        component: repairForm.component,
        maintShopId: parseInt(repairForm.maintShopId),
        technicianId: repairForm.technicianId ? parseInt(repairForm.technicianId) : undefined,
      });
      setCreatedRepairs((prev) => [...prev, res.data?.data]);
      if (andCreateNew) {
        setRepairForm({ repairSchedule: '', repairReasonId: '', overduePM: '', scheduledAction: '', action: '', group: '', component: '', maintShopId: '', technicianId: '' });
      } else {
        await loadSuccessData();
      }
    } catch {
      setRepairError('Failed to create repair. Please try again.');
    } finally {
      setCreatingRepair(false);
    }
  }, [repairForm, repairFormValid, workOrderId]);  // eslint-disable-line

  const loadSuccessData = async () => {
    try {
      const res = await getWorkOrderDetails(workOrderId);
      setSuccessWO(res.data?.data);
    } catch {
      setSuccessWO({ workOrderNumber, assetNumber: assetData?.assetNumber, statusCode: woForm.statusCode, symptom: woForm.symptom, repairs: createdRepairs });
    }
    setStep(6);
  };

  const handleSkipRepairs = () => loadSuccessData();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 shrink-0">
        <span className="font-bold text-gray-900 text-sm">Company</span>
        <span className="font-light text-gray-400 text-sm">Logo</span>
        <div className="flex-1" />
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
          {technician.name?.split(' ').map((n) => n[0]).join('').slice(0, 2) || 'AA'}
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-20 bg-white border-r border-gray-200 flex flex-col items-center py-4 shrink-0">
          <button
            onClick={() => navigate('/dashboard', { state: { technician } })}
            className="w-16 py-2.5 rounded-xl flex flex-col items-center gap-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            <span className="text-[10px] font-medium">Home</span>
          </button>
          <button className="w-16 py-2.5 rounded-xl flex flex-col items-center gap-1 bg-blue-50 text-blue-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className="text-[10px] font-medium">Repairs</span>
          </button>
        </aside>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          {step < 6 && (
            <div className="px-6 py-3 border-b border-gray-200 bg-white">
              <p className="text-sm text-gray-500">
                Repairs <span className="text-gray-300 mx-1">›</span>
                <span className="font-semibold text-gray-800">New Work Order</span>
              </p>
            </div>
          )}
          {step === 6 && (
            <div className="px-6 py-3 border-b border-gray-200 bg-white">
              <p className="text-sm text-gray-500">
                Repairs <span className="text-gray-300 mx-1">›</span>
                New Work Order <span className="text-gray-300 mx-1">›</span>
                <span className="font-semibold text-gray-800">Review Work Order creation</span>
              </p>
            </div>
          )}

          <div className="p-6">
            {step < 6 && <StepperBar current={step} />}

            {/* ── Step 1: Asset & Organization Selection ── */}
            {step === 1 && (
              <div>
                <h1 className="text-xl font-bold text-gray-900 mb-1">Create Asset Work Order</h1>
                <p className="text-sm text-gray-500 mb-5">Enter asset number and select organization</p>
                <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-2xl">
                  <FormField label="Asset number" required>
                    <input
                      type="text"
                      placeholder="Enter asset number"
                      value={assetNumber}
                      onChange={(e) => { setAssetNumber(e.target.value); setVerifyError(''); }}
                      onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </FormField>
                  <div className="mt-4">
                    <FormField label="Organization" required>
                      <OrgDropdown shops={shops} value={orgId} onChange={setOrgId} />
                    </FormField>
                  </div>
                  {verifyError && (
                    <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      {verifyError}
                    </div>
                  )}
                  <button
                    onClick={handleVerify}
                    disabled={!assetNumber.trim() || !orgId || verifying}
                    className="mt-5 px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {verifying ? 'Verifying...' : 'Verify asset'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 2: Asset Details View ── */}
            {step === 2 && assetData && (
              <div>
                <h1 className="text-xl font-bold text-gray-900 mb-1">View Asset details</h1>
                <p className="text-sm text-gray-500 mb-5">Review asset information before creating work order</p>
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h2 className="text-base font-semibold text-gray-800 mb-4 pb-3 border-b border-gray-100">Asset Details</h2>
                  <div className="flex gap-6">
                    {/* Snapshot */}
                    <div className="w-48 shrink-0">
                      <p className="text-xs text-gray-400 mb-2">Snapshot Glance</p>
                      <div className="w-full h-32 bg-gray-100 rounded-xl flex items-center justify-center">
                        <Car className="w-12 h-12 text-gray-300" />
                      </div>
                    </div>
                    {/* Details grid */}
                    <div className="flex-1 grid grid-cols-3 gap-x-8 gap-y-4">
                      {[
                        ['Asset Number', assetData.assetNumber],
                        ['Organization', assetData.organization],
                        ['Status', assetData.status],
                        ['Year', assetData.year],
                        ['Make', assetData.make],
                        ['Model', assetData.model],
                        ['License', assetData.license],
                        ['VIN/Serial Number', assetData.vin],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <p className="text-xs text-gray-400">{label}</p>
                          <p className="text-sm font-semibold text-gray-800 mt-0.5">{value || '--'}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Open Work Orders */}
                  {assetData.openWorkOrders?.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-gray-100">
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="text-sm font-semibold text-gray-800">Open Work Orders</h3>
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded border border-blue-200">
                          {assetData.openWorkOrders.length} Work order{assetData.openWorkOrders.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {assetData.openWorkOrders.map((wo) => (
                          <div key={wo.documentNumber} className="py-3 grid grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-gray-400">Document Number</p>
                              <p className="text-sm font-semibold text-gray-800">{wo.documentNumber}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Date In</p>
                              <p className="text-sm font-semibold text-gray-800">{wo.dateIn ? new Date(wo.dateIn).toLocaleString() : 'NA'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Date Out</p>
                              <p className="text-sm font-semibold text-gray-800">NA</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Status</p>
                              <p className="text-sm font-semibold text-gray-800">{wo.statusDesc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Replacement info */}
                  {assetData.totalPointValue != null && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-800 mb-3">Replacement</h3>
                      <div className="grid grid-cols-3 gap-4">
                        {[
                          ['Total Point Value', assetData.totalPointValue],
                          ['Original Replacement Date', assetData.originalReplacementDate],
                          ['Point Scale Used', assetData.pointScaleUsed],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <p className="text-xs text-gray-400">{label}</p>
                            <p className="text-sm font-semibold text-gray-800 mt-0.5">{value ?? '--'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Step 3: Work Order Form ── */}
            {step === 3 && (
              <div>
                <h1 className="text-xl font-bold text-gray-900 mb-1">Create Asset Work Order Document</h1>
                <p className="text-sm text-gray-500 mb-5">Enter work order details for asset {assetData?.assetNumber}</p>

                <div className="bg-gray-100 rounded-lg px-4 py-3 flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-gray-700">Organization: {assetData?.organization}</span>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-600 hover:bg-gray-50 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    Add notes
                  </button>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
                  {/* Shop + Status row */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Maintenance Shop" required>
                      <Select
                        value={woForm.shopId}
                        onChange={(v) => setWoForm((f) => ({ ...f, shopId: v }))}
                        options={shops}
                        placeholder="Select maintenance shop"
                      />
                    </FormField>
                    <div className="flex items-end gap-3">
                      <FormField label="Status" required className="flex-1">
                        <Select
                          value={woForm.statusCode}
                          onChange={(v) => setWoForm((f) => ({ ...f, statusCode: v }))}
                          options={[
                            { value: 'A', label: 'Active- Repair in progress [A]' },
                            { value: 'H', label: 'On Hold [H]' },
                            { value: 'W', label: 'Waiting Parts [W]' },
                          ]}
                          placeholder="Select status"
                        />
                      </FormField>
                      <label className="flex items-center gap-2 text-sm text-gray-600 pb-2.5 shrink-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={woForm.disableDowntime}
                          onChange={(e) => setWoForm((f) => ({ ...f, disableDowntime: e.target.checked }))}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        Disable Downtime Tracking
                      </label>
                    </div>
                  </div>

                  {/* Meter Information */}
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2">Meter Information:</p>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            {['Meter Type', 'Reading', 'Actual reading *', 'Error', 'Action'].map((h) => (
                              <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-t border-gray-100">
                            <td className="px-4 py-3 text-gray-700 font-medium">M</td>
                            <td className="px-4 py-3 text-gray-700">{assetData?.meterReading?.toLocaleString() || '—'}</td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                placeholder="Enter actual reading"
                                value={woForm.meterActualReading}
                                onChange={(e) => setWoForm((f) => ({ ...f, meterActualReading: e.target.value, meterAccepted: false }))}
                                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-36 focus:outline-none focus:ring-1 focus:ring-blue-300"
                              />
                            </td>
                            <td className="px-4 py-3">
                              {meterError && !woForm.meterAccepted && (
                                <span className="text-red-500 text-xs">{meterError}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {meterError && !woForm.meterAccepted && (
                                <button
                                  onClick={() => setWoForm((f) => ({ ...f, meterAccepted: true }))}
                                  className="px-3 py-1 border border-gray-300 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                  Accept anyway
                                </button>
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Dept + Date In */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Department" required>
                      <Select
                        value={woForm.department}
                        onChange={(v) => setWoForm((f) => ({ ...f, department: v }))}
                        options={departments}
                        placeholder="Select department"
                      />
                    </FormField>
                    <FormField label="Date/Time In" required>
                      <div className="relative">
                        <input
                          type="datetime-local"
                          value={woForm.dateIn}
                          onChange={(e) => setWoForm((f) => ({ ...f, dateIn: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 pr-10"
                        />
                        <Calendar className="absolute right-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </FormField>
                  </div>

                  {/* Bill Code + Date Promised */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Bill Code" required>
                      <Select
                        value={woForm.billCode}
                        onChange={(v) => setWoForm((f) => ({ ...f, billCode: v }))}
                        options={billCodes}
                        placeholder="Select bill code"
                      />
                    </FormField>
                    <FormField label="Date/Time Promised">
                      <div className="relative">
                        <input
                          type="datetime-local"
                          value={woForm.datePromised}
                          onChange={(e) => setWoForm((f) => ({ ...f, datePromised: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 pr-10"
                        />
                        <Calendar className="absolute right-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </FormField>
                  </div>

                  {/* Contact + Priority */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Contact">
                      <input
                        type="text"
                        placeholder="Select contact"
                        value={woForm.contact}
                        onChange={(e) => setWoForm((f) => ({ ...f, contact: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </FormField>
                    <FormField label="Priority">
                      <Select
                        value={woForm.priority}
                        onChange={(v) => setWoForm((f) => ({ ...f, priority: v }))}
                        options={[
                          { value: 'LOW', label: 'Low' },
                          { value: 'MEDIUM', label: 'Medium' },
                          { value: 'HIGH', label: 'High' },
                          { value: 'URGENT', label: 'Urgent' },
                        ]}
                        placeholder="Select priority"
                      />
                    </FormField>
                  </div>

                  {/* Symptom */}
                  <FormField label="Symptom">
                    <textarea
                      rows={3}
                      placeholder="Describe the symptom or issue..."
                      value={woForm.symptom}
                      onChange={(e) => setWoForm((f) => ({ ...f, symptom: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                    />
                  </FormField>

                  {woError && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      {woError}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Step 4: Repair Selection ── */}
            {step === 4 && (
              <div>
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900 mb-1">Select or Create a repair</h1>
                    <p className="text-sm text-gray-500">Choose any existing repairs or create a new one for this work order</p>
                  </div>
                  <button
                    onClick={() => setStep(5)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    New Repair
                  </button>
                </div>

                {/* Filter tabs + view toggle */}
                <div className="flex items-center gap-2 mb-4">
                  {['All', 'Pending repairs', 'Overdue preventive maintanence', 'Overdue scheduled actions'].map((f) => (
                    <button
                      key={f}
                      onClick={() => setRepairFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors
                        ${repairFilter === f ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                    >
                      {f}
                    </button>
                  ))}
                  <div className="flex-1" />
                  <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
                    <button onClick={() => setRepairViewMode('grid')} className={`p-2 ${repairViewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:bg-gray-50'}`}><LayoutGrid className="w-4 h-4" /></button>
                    <button onClick={() => setRepairViewMode('list')} className={`p-2 ${repairViewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:bg-gray-50'}`}><List className="w-4 h-4" /></button>
                  </div>
                </div>

                {pendingLoading ? (
                  <div className="py-12 text-center text-sm text-gray-400">Loading repairs...</div>
                ) : pendingRepairs.length === 0 ? (
                  <div className="py-12 text-center text-sm text-gray-400">No pending repairs found. Create a new repair to continue.</div>
                ) : repairViewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pendingRepairs.map((r) => (
                      <PendingRepairCard
                        key={r.repairId}
                        repair={r}
                        selected={selectedRepairIds.has(r.repairId)}
                        onToggle={() => setSelectedRepairIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(r.repairId)) next.delete(r.repairId); else next.add(r.repairId);
                          return next;
                        })}
                      />
                    ))}
                  </div>
                ) : (
                  <PendingRepairsTable
                    repairs={pendingRepairs}
                    selected={selectedRepairIds}
                    onToggle={(id) => setSelectedRepairIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id); else next.add(id);
                      return next;
                    })}
                  />
                )}
              </div>
            )}

            {/* ── Step 5: Repair Creation ── */}
            {step === 5 && (
              <div>
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900 mb-1">Repair details</h1>
                    <p className="text-sm text-gray-500">Enter details for the new repair</p>
                  </div>
                  <button
                    onClick={() => handleSaveRepair(true)}
                    disabled={!repairFormValid || creatingRepair}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                    Save and create new
                  </button>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
                  <h2 className="text-sm font-semibold text-gray-700 pb-2 border-b border-gray-100">Required Information</h2>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Overdue preventive maintenance">
                      <Select value={repairForm.overduePM} onChange={(v) => setRepairForm((f) => ({ ...f, overduePM: v }))}
                        options={[{ value: 'none', label: 'None' }]} placeholder="Select overdue preventive maintanence" />
                    </FormField>
                    <FormField label="Scheduled action past due">
                      <Select value={repairForm.scheduledAction} onChange={(v) => setRepairForm((f) => ({ ...f, scheduledAction: v }))}
                        options={[{ value: 'none', label: 'None' }]} placeholder="Select scheduled action" />
                    </FormField>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Repair schedule" required>
                      <Select value={repairForm.repairSchedule} onChange={(v) => setRepairForm((f) => ({ ...f, repairSchedule: v }))}
                        options={repairSchedules} placeholder="Select schedule" />
                    </FormField>
                    <FormField label="Repair reason" required>
                      <Select value={repairForm.repairReasonId} onChange={(v) => setRepairForm((f) => ({ ...f, repairReasonId: v }))}
                        options={repairReasons} placeholder="Select reason" />
                    </FormField>
                  </div>

                  {/* Repair Code box */}
                  <div className="border border-blue-100 bg-blue-50 rounded-xl p-4">
                    <div className="flex items-start gap-2 mb-3">
                      <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          Repair Code <span className="text-red-500">*</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          These three fields are interconnected. Selecting any one will automatically filter the available options in the others.
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <FormField label="Action" required>
                        <Select value={repairForm.action} onChange={(v) => setRepairForm((f) => ({ ...f, action: v, group: '', component: '' }))}
                          options={repairActions} placeholder="Select action" />
                      </FormField>
                      <FormField label="Group" required>
                        <Select value={repairForm.group} onChange={(v) => setRepairForm((f) => ({ ...f, group: v, component: '' }))}
                          options={repairGroups} placeholder="Select group" />
                      </FormField>
                      <FormField label="Component" required>
                        <Select value={repairForm.component} onChange={(v) => setRepairForm((f) => ({ ...f, component: v }))}
                          options={repairComponents} placeholder="Select component" />
                      </FormField>
                    </div>
                  </div>

                  <FormField label="Maintenance shop" required>
                    <Select value={repairForm.maintShopId} onChange={(v) => setRepairForm((f) => ({ ...f, maintShopId: v }))}
                      options={shops} placeholder="Select maintenance shop" />
                  </FormField>

                  <h2 className="text-sm font-semibold text-gray-700 pt-2 pb-2 border-b border-gray-100">Optional Information</h2>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Assign technician">
                      <input
                        type="text"
                        placeholder="Enter technician name"
                        value={repairForm.technicianId}
                        onChange={(e) => setRepairForm((f) => ({ ...f, technicianId: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </FormField>
                    <FormField label="Shift">
                      <Select value="" onChange={() => {}} options={[]} placeholder="Select shift" />
                    </FormField>
                  </div>

                  {repairError && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      {repairError}
                    </div>
                  )}

                  {createdRepairs.length > 0 && (
                    <div className="pt-2">
                      <p className="text-xs font-semibold text-gray-500 mb-2">{createdRepairs.length} repair{createdRepairs.length > 1 ? 's' : ''} added to this work order</p>
                      <div className="space-y-1.5">
                        {createdRepairs.map((r, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                            <Check className="w-4 h-4 text-green-600 shrink-0" />
                            {r?.title || 'Repair created'}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Step 6: Success ── */}
            {step === 6 && successWO && (
              <SuccessScreen
                wo={successWO}
                assetData={assetData}
                onDashboard={() => navigate('/dashboard', { state: { technician } })}
              />
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      {step < 6 && (
        <footer className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div>
            {step === 4 && (
              <button
                onClick={handleSkipRepairs}
                className="px-5 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Skip
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (step === 1) navigate('/dashboard', { state: { technician } });
                else if (step === 5) setStep(4);
                else setStep((s) => s - 1);
              }}
              className="px-5 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {step === 1 ? 'Cancel' : 'Back'}
            </button>
            {step === 1 && (
              <button
                disabled
                className="px-5 py-2 bg-gray-200 text-gray-400 text-sm font-semibold rounded-lg cursor-not-allowed"
              >
                Next
              </button>
            )}
            {step === 2 && (
              <button
                onClick={() => setStep(3)}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Next
              </button>
            )}
            {step === 3 && (
              <button
                onClick={handleCreateWO}
                disabled={!woFormValid || creatingWO || (!!meterError && !woForm.meterAccepted)}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {creatingWO ? 'Creating...' : 'Next'}
              </button>
            )}
            {step === 4 && (
              <button
                onClick={() => setStep(5)}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Next
              </button>
            )}
            {step === 5 && (
              <button
                onClick={() => handleSaveRepair(false)}
                disabled={!repairFormValid || creatingRepair}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {creatingRepair ? 'Saving...' : 'Save & Finish'}
              </button>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function OrgDropdown({ shops, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = shops.find((s) => s.value === value);
  const filtered = shops.filter((s) => s.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white text-gray-800 focus:outline-none"
      >
        <span className={selected ? 'text-gray-800' : 'text-gray-400'}>
          {selected ? selected.label : 'Select organization'}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30">
          <div className="flex items-center border-b border-gray-100 px-3 py-2 gap-2">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Search for organization"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-sm outline-none"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => { onChange(s.value); setOpen(false); setSearch(''); }}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0"
              >
                <p className="text-sm font-semibold text-gray-800">{s.label}</p>
                <p className="text-xs text-gray-400">Code: {s.label.slice(0, 3).toUpperCase()}</p>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-4 py-3 text-sm text-gray-400">No results</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PendingRepairCard({ repair, selected, onToggle }) {
  const typeLabel = repair.status === 'Working' ? 'Pending repair' : 'Scheduled action';
  const badgeClass = REPAIR_TYPE_BADGE[typeLabel] || REPAIR_TYPE_BADGE['Pending repair'];
  const titleParts = [repair.actionDesc, repair.groupDesc, repair.componentDesc].filter(Boolean);
  const title = titleParts.join(' ') || repair.componentDesc || `Repair ${repair.repairId}`;
  return (
    <div
      onClick={onToggle}
      className={`bg-white border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md
        ${selected ? 'border-blue-400 ring-1 ring-blue-200' : 'border-gray-200'}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={selected} onChange={onToggle} onClick={(e) => e.stopPropagation()} className="w-4 h-4 rounded" />
          <span className={`px-2 py-0.5 text-xs font-semibold border rounded ${badgeClass}`}>{typeLabel}</span>
        </div>
        <div className="relative">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
        </div>
      </div>
      <p className="font-bold text-gray-900 text-sm leading-snug mb-3">{title}</p>
      <div className="space-y-1 text-xs">
        {[['Shop', repair.maintShop || '--'], ['Time Standard', repair.timeStandardHours ? `${repair.timeStandardHours}h` : '--'], ['Date Created', repair.inDate ? new Date(repair.inDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '--']].map(([l, v]) => (
          <div key={l} className="flex gap-2"><span className="text-gray-400 w-24">{l}:</span><span className="font-semibold text-gray-700">{v}</span></div>
        ))}
      </div>
    </div>
  );
}

function PendingRepairsTable({ repairs, selected, onToggle }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-100">
          <tr>
            {['Action', 'Repair Description', 'Priority', 'Shop', 'Time Standard', 'Date Created', 'Message'].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {repairs.map((r) => {
            const typeLabel = 'Pending repair';
            const badgeClass = REPAIR_TYPE_BADGE[typeLabel];
            const titleParts = [r.actionDesc, r.groupDesc, r.componentDesc].filter(Boolean);
            const title = (titleParts.join(' ') || `Repair ${r.repairId}`).slice(0, 30) + '...';
            return (
              <tr key={r.repairId} onClick={() => onToggle(r.repairId)} className={`cursor-pointer hover:bg-gray-50 transition-colors ${selected.has(r.repairId) ? 'bg-blue-50' : ''}`}>
                <td className="px-4 py-3"><input type="checkbox" checked={selected.has(r.repairId)} onChange={() => onToggle(r.repairId)} onClick={(e) => e.stopPropagation()} className="w-4 h-4 rounded" /></td>
                <td className="px-4 py-3 text-gray-700 max-w-[180px]">{title}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs font-semibold border rounded ${badgeClass}`}>{typeLabel}</span></td>
                <td className="px-4 py-3 text-gray-700">{r.maintShop || '--'}</td>
                <td className="px-4 py-3 text-gray-700">{r.timeStandardHours ? `${r.timeStandardHours}h` : '--'}</td>
                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{r.inDate ? new Date(r.inDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '--'}</td>
                <td className="px-4 py-3 text-gray-400">—</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SuccessScreen({ wo, assetData, onDashboard }) {
  const WO_STATUS = { A: 'Active - Repair in Progress [A]', C: 'Closed', H: 'On Hold', W: 'Waiting Parts' };
  const REPAIR_BADGE = {
    'New repair':     'border-green-300 text-green-700 bg-green-50',
    'Overdue PM':     'border-red-300   text-red-700   bg-red-50',
    'Pending repair': 'border-yellow-300 text-yellow-700 bg-yellow-50',
  };

  return (
    <div>
      {/* Success header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full border-2 border-blue-600 flex items-center justify-center">
          <Check className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Successful creation of work order</h1>
          <p className="text-sm text-gray-500">We have successfully saved new repair with the following entailed work order and repair information:</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
        <h2 className="text-base font-semibold text-gray-800 mb-4 pb-3 border-b border-gray-100">Work Order details</h2>
        <div className="grid grid-cols-4 gap-6">
          {[
            ['Work order number', wo.workOrderNumber],
            ['Asset', wo.assetNumber || (assetData?.assetNumber ?? '--')],
            ['Status', WO_STATUS[wo.statusCode] || wo.statusCode],
            ['Symptoms', wo.symptom || '--'],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-gray-400">{label}</p>
              <p className="text-sm font-semibold text-gray-800 mt-0.5 break-words">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {wo.repairs?.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4 pb-3 border-b border-gray-100">Repair list</h2>
          <div className="space-y-4">
            {wo.repairs.map((repair, idx) => {
              const typeLabel = repair.repairType || 'New repair';
              const badgeClass = REPAIR_BADGE[typeLabel] || REPAIR_BADGE['New repair'];
              return (
                <div key={repair.repairId || idx} className="pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-sm font-bold text-gray-700">Repair {idx + 1}</span>
                    <span className={`px-2 py-0.5 text-xs font-semibold border rounded ${badgeClass}`}>{typeLabel}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      ['Repair description', repair.title],
                      ['Date created', repair.dateCreated ? new Date(repair.dateCreated).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: 'numeric' }) : '--'],
                      ['Technician', repair.technicianName || '--'],
                      ['Cost', `$${(repair.cost ?? 0).toFixed(3)}`],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-xs text-gray-400">{label}</p>
                        <p className="text-sm font-semibold text-gray-800 mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex justify-end mt-6">
        <button
          onClick={onDashboard}
          className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go to dashboard
        </button>
      </div>
    </div>
  );
}
