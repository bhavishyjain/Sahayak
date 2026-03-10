import AsyncStorage from "@react-native-async-storage/async-storage";

const QUEUE_KEY = "@sahayak_complaint_queue";

/**
 * Read all queued items (returns array, never throws)
 */
export async function getQueue() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Add a complaint draft to the offline queue.
 * @param {{ title, description, department, locationName, priority, coordinates, images }} draft
 * @returns {string} localId assigned to the entry
 */
export async function enqueue(draft) {
  const queue = await getQueue();
  const localId = `offline_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const entry = { localId, createdAt: new Date().toISOString(), ...draft };
  queue.push(entry);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return localId;
}

/**
 * Remove a single entry by localId after it has been successfully submitted.
 */
export async function dequeue(localId) {
  const queue = await getQueue();
  const updated = queue.filter((e) => e.localId !== localId);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
}

/**
 * Clear the entire queue (e.g. on logout)
 */
export async function clearQueue() {
  await AsyncStorage.removeItem(QUEUE_KEY);
}
