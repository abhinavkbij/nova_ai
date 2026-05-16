import api from './client';

export function searchRepairs({
  technicianId,
  shopId,
  searchText = 'Repair Id',
  searchValue = '',
  scope = 'My Repairs in My Shop',
  page = 1,
  pageSize = 9,
  statusFilter = 'Open',
} = {}) {
  return api.post('/WorkOrderRepairs/search', {
    technicianId,
    shopId,
    searchText,
    searchValue,
    scope,
    page,
    pageSize,
    statusFilter,
  });
}

export function getTechnicianRepairs({
  technicianId,
  page = 1,
  pageSize = 6,
  sortBy = 'InDate',
  sortOrder = 'desc',
  statusFilter = 'All',
  shopId,
} = {}) {
  return api.get('/WorkOrderRepairs/technician', {
    params: {
      technicianId,
      page,
      pageSize,
      sortBy,
      sortOrder,
      statusFilter,
      ...(shopId ? { shopId } : {}),
    },
  });
}

export function getWorkOrderRepair(repairId) {
  return api.get(`/WorkOrderRepairs/${repairId}`);
}

export function getRepairNotes({ repairId, searchString = '' } = {}) {
  const params = { repairId };
  if (searchString) params.searchString = searchString;
  return api.get('/workordernotes', { params });
}

export function addRepairNote({ id, subject, note, isDocument = false, createdTechnicianID, createdUserID = 0 } = {}) {
  return api.post('/workordernotes', {
    id,
    subject,
    note,
    isDocument,
    isPending: false,
    createdUserID,
    createdTechnicianID,
  });
}

export function getRepairTasks(repairId) {
  return api.get(`/tasks/${repairId}`);
}

export function getRepairTimer(repairId, technicianId) {
  return api.get(`/WorkOrderRepairs/${repairId}/timer`, { params: { technicianId } });
}

export function startRepairTimer(repairId, technicianId) {
  return api.post(`/WorkOrderRepairs/${repairId}/timer/start`, null, { params: { technicianId } });
}

export function completeRepair({ repairId, technicianId, maintShopId }) {
  return api.post('/WorkOrderRepairs/repair/end', { repairId, technicianId, maintShopId });
}

export function createWorkOrder(data) {
  return api.post('/work-orders', data);
}

export function createWorkOrderRepair(data) {
  return api.post('/WorkOrderRepairs', data);
}

export function getWorkOrderDetails(woId) {
  return api.get(`/work-orders/${woId}`);
}

export function getPendingRepairsForWO(woId) {
  return api.get(`/work-orders/${woId}/pending-repairs`);
}

export function getDepartments() {
  return api.get('/LookUps/Departments');
}

export function getBillCodes() {
  return api.get('/LookUps/BillCodes');
}

export function getRepairSchedules() {
  return api.get('/LookUps/RepairSchedules');
}

export function getRepairActions() {
  return api.get('/LookUps/RepairActions');
}

export function getRepairGroups(actionId) {
  return api.get('/LookUps/RepairGroups', { params: actionId ? { actionId } : {} });
}

export function getRepairComponents(groupId) {
  return api.get('/LookUps/RepairComponents', { params: groupId ? { groupId } : {} });
}

export function getRepairReasons() {
  return api.get('/WorkOrderRepairs/getRepairReasons');
}

export function setRepairReason(repairId, reasonId) {
  return api.patch(`/WorkOrderRepairs/${repairId}/Reason/${reasonId}`);
}

export function getWorkOrderStatuses() {
  return api.get('/work-orders/status');
}

export function changeWorkOrderStatus(workOrderId, statusCode) {
  return api.patch(`/workorders/${workOrderId}/status/${statusCode}`);
}
