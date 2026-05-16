import api from './client';

export function getRequestedParts({
  technicianId,
  isRequestActive,
  requestedPartStatusId,
  pageNumber = 1,
  pageSize = 6,
} = {}) {
  return api.get('/parts/requested', {
    params: {
      technicianId,
      ...(isRequestActive == null ? {} : { isRequestActive }),
      ...(requestedPartStatusId ? { requestedPartStatusId } : {}),
      pageNumber,
      pageSize,
    },
  });
}

export function getRepairParts({ repairId, pageNumber = 1, pageSize = 20 } = {}) {
  return api.get(`/parts/repair/${repairId}`, { params: { pageNumber, pageSize } });
}

export function getPartsMessages({
  technicianID,
  pageNumber = 1,
  pageSize = 20,
} = {}) {
  return api.get('/parts/messages', {
    params: {
      technicianID,
      pageNumber,
      pageSize,
    },
  });
}

export function searchPartsCatalog({ q, pageNumber = 1, pageSize = 20 } = {}) {
  return api.get('/parts/catalog', { params: { q, pageNumber, pageSize } });
}
