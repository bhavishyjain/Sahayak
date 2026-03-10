import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY_PREFIX = "@sahayak_complaints_";
const MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

function cacheKey(status = "all") {
  return `${CACHE_KEY_PREFIX}${status}`;
}

/**
 * Persist a complaints list for the given status filter.
 */
export async function cacheComplaints(status, complaints) {
  try {
    const payload = { complaints, cachedAt: Date.now() };
    await AsyncStorage.setItem(cacheKey(status), JSON.stringify(payload));
  } catch {
    // ignore write failures silently
  }
}

/**
 * Retrieve cached complaints if still fresh (within MAX_AGE_MS).
 * Returns null if cache is absent or stale.
 */
export async function getCachedComplaints(status) {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(status));
    if (!raw) return null;
    const { complaints, cachedAt } = JSON.parse(raw);
    if (Date.now() - cachedAt > MAX_AGE_MS) return null;
    return complaints || null;
  } catch {
    return null;
  }
}

/**
 * Persist a single complaint detail object by its MongoDB _id.
 */
export async function cacheComplaintDetail(id, complaint) {
  try {
    await AsyncStorage.setItem(
      `@sahayak_complaint_detail_${id}`,
      JSON.stringify({ complaint, cachedAt: Date.now() }),
    );
  } catch {
    // ignore
  }
}

/**
 * Retrieve a cached complaint detail (no max-age — used only as fallback).
 */
export async function getCachedComplaintDetail(id) {
  try {
    const raw = await AsyncStorage.getItem(`@sahayak_complaint_detail_${id}`);
    if (!raw) return null;
    const { complaint } = JSON.parse(raw);
    return complaint || null;
  } catch {
    return null;
  }
}
