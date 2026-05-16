import api from "./client";

export const getTechnicians = () => api.get("/technicians");
export const getTechniciansPage = ({ page = 1, pageSize = 18, shopId, technicianName, sort } = {}) =>
  api.get('/technicians', { params: { page, pageSize, ...(shopId ? { shopId } : {}), ...(technicianName ? { technicianName } : {}), ...(sort ? { sort } : {}) } });
export const getShops = () => api.get('/shops');
export const getTechnician = (id) => api.get(`/technicians/${id}`);
export const createTechnician = (data) => api.post("/technicians", data);
export const updateTechnician = (id, data) => api.patch(`/technicians/${id}`, data);
export const deleteTechnician = (id) => api.delete(`/technicians/${id}`);
export const getIndirectActivities = () => api.get("/technicians/indirect-activity");
export const submitIndirectActivity = (technicianId, repairGroupComponentActionID) =>
  api.post(`/technicians/${technicianId}/indirect-activity`, { repairGroupComponentActionID });
export const getStatusIndicator = (technicianId) =>
  api.get(`/technicians/${technicianId}/status-indicator`);
export const beginShift = (technicianId, shopId) =>
  api.post(`/TechnicianDetails/${technicianId}/shift/begin?shopId=${shopId}&createdUserId=1`);
export const endShift = (technicianId) =>
  api.get(`/Shifts/${technicianId}/end`);
export const validatePin = (technicianId, pin) =>
  api.post('/technicians/auth/pin', null, { params: { technicianId, pin } });
export const getRepairCategories = () =>
  api.get('/LookUps/RepairCategories');
