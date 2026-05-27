/** Matches backend `MAX_VEHICLE_LIST_LIMIT` / UI page sizes (never exceed 200 per request). */
export const VEHICLE_PAGE_SIZE_DEFAULT = 100;
export const VEHICLE_PAGE_SIZE_OPTIONS = [50, 100, 150, 200] as const;
export type VehiclePageSize = (typeof VEHICLE_PAGE_SIZE_OPTIONS)[number];
