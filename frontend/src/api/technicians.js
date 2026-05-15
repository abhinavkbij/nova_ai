import api from "./client";

export const getTechnicians = () => api.get("/technicians");
export const getTechnician = (id) => api.get(`/technicians/${id}`);
export const createTechnician = (data) => api.post("/technicians", data);
export const updateTechnician = (id, data) => api.patch(`/technicians/${id}`, data);
export const deleteTechnician = (id) => api.delete(`/technicians/${id}`);
