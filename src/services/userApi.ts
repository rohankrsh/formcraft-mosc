/**
 * Client API for fetching staff and user details from Oracle HISUSER/EMPLOYEE tables.
 */

import { parseAndValidateUserId } from '../utils/staffFieldHelper';
export { parseAndValidateUserId };

export interface StaffDetailsResponse {
  success: boolean;
  user_id: number;
  staff_name: string;
  employee_id?: number | null;
  emp_no?: string | null;
  login?: string | null;
  username?: string | null;
  email?: string | null;
  designation?: string | null;
  global_department?: number | null;
  global_service_center?: number | null;
  error?: string;
  code?: string;
}

// In-memory cache to prevent duplicate network requests across component re-renders
const staffDetailsCache = new Map<number, Promise<StaffDetailsResponse | null>>();

/**
 * Fetches staff details for a given HISUSER.ID from the backend.
 * Caches in-flight and completed promises to guarantee fast response without network thrashing.
 * Safely parses and normalizes user IDs with trailing HIS delimiters (e.g. '950:', '1212:').
 */
export async function fetchStaffDetails(userId: string | number | null | undefined): Promise<StaffDetailsResponse | null> {
  const numId = parseAndValidateUserId(userId);
  if (!numId) return null;

  if (staffDetailsCache.has(numId)) {
    return staffDetailsCache.get(numId)!;
  }

  const promise = (async () => {
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(numId)}/staff-details`);
      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        console.warn(`[userApi] Failed to fetch staff details for user ${numId} (HTTP ${res.status}):`, errorJson.error || res.statusText);
        return null;
      }
      const data: StaffDetailsResponse = await res.json();
      return data;
    } catch (err: any) {
      console.warn(`[userApi] Network error fetching staff details for user ${numId}:`, err.message);
      return null;
    }
  })();

  staffDetailsCache.set(numId, promise);
  return promise;
}

/**
 * Invalidates the staff details cache (useful for testing or logout)
 */
export function invalidateStaffDetailsCache(userId?: number) {
  if (userId) {
    staffDetailsCache.delete(userId);
  } else {
    staffDetailsCache.clear();
  }
}
