import api from './client';

export function verifyAsset(assetNumber, orgId) {
  return api.get('/assets/verify', { params: { assetNumber, orgId } });
}
