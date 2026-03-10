import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import useApiQuery from "./useApiQuery";
import { REPORT_DOWNLOAD_URL, REPORT_STATS_URL } from "../../url";
import { getCachedToken } from "../cache/auth";
import getUserAuth from "../userAuth";

async function getAuthToken() {
  // Try fast in-memory cache first
  const cached = getCachedToken();
  if (cached) return cached;
  // Fall back to AsyncStorage (covers hot reload / cold start race)
  const user = await getUserAuth();
  return user?.auth_token ?? null;
}

function buildReportQueryString(filters = {}) {
  const params = new URLSearchParams();
  if (filters.department) params.append("department", filters.department);
  if (filters.status) params.append("status", filters.status);
  if (filters.startDate) params.append("startDate", filters.startDate);
  if (filters.endDate) params.append("endDate", filters.endDate);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function useReportStats(filters, options = {}) {
  const querySuffix = buildReportQueryString(filters);
  return useApiQuery({
    queryKey: ["reports", "stats", filters],
    url: `${REPORT_STATS_URL}${querySuffix}`,
    enabled: options.enabled ?? true,
    staleTime: options.staleTime ?? 60 * 1000,
    retry: options.retry ?? 1,
  });
}

export function useDownloadReport() {
  const download = async ({ format, filters }) => {
    const suffix = buildReportQueryString(filters);
    const url = `${REPORT_DOWNLOAD_URL(format)}${suffix}`;

    const ext = format === "excel" ? "xlsx" : format;
    const mimeTypes = {
      pdf: "application/pdf",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      csv: "text/csv",
    };
    const mimeType = mimeTypes[ext] || "application/octet-stream";
    const fileName = `sahayak_report_${Date.now()}.${ext}`;
    const cacheUri = `${FileSystem.cacheDirectory}${fileName}`;

    // 1. Download to cache
    const token = await getAuthToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const result = await FileSystem.downloadAsync(url, cacheUri, { headers });

    if (result.status !== 200) {
      throw new Error(`Download failed with status ${result.status}`);
    }

    if (Platform.OS === "android") {
      // Android: use StorageAccessFramework to save directly to a user-chosen folder (defaults to Downloads)
      const SAF = FileSystem.StorageAccessFramework;
      const perms = await SAF.requestDirectoryPermissionsAsync();

      if (perms.granted) {
        // Read cache file as base64
        const base64 = await FileSystem.readAsStringAsync(result.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        // Create file in chosen directory and write to it
        const destUri = await SAF.createFileAsync(
          perms.directoryUri,
          fileName,
          mimeType,
        );
        await FileSystem.writeAsStringAsync(destUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        // Clean up cache copy
        await FileSystem.deleteAsync(result.uri, { idempotent: true });
      } else {
        // User denied folder picker — fall back to share sheet
        await Sharing.shareAsync(result.uri, {
          mimeType,
          dialogTitle: `Save ${format.toUpperCase()} Report`,
        });
      }
    } else {
      // iOS: share sheet includes native "Save to Files" option
      await Sharing.shareAsync(result.uri, {
        mimeType,
        dialogTitle: `Save ${format.toUpperCase()} Report`,
        UTI: ext === "pdf" ? "com.adobe.pdf" : "public.data",
      });
    }
  };

  return { download };
}

export { buildReportQueryString };
