import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { Linking, Platform } from "react-native";
import useApiQuery from "./useApiQuery";
import apiCall from "../api";
import {
  REPORT_DEPARTMENT_BREAKDOWN_URL,
  REPORT_DOWNLOAD_URL,
  REPORT_STATS_URL,
} from "../../url";
import { getCachedToken } from "../cache/auth";
import getUserAuth from "../userAuth";
import { queryKeys } from "../queryKeys";

const REPORTS_FOLDER_NAME = "Sahayak";

function logReportDebug(message, meta = {}) {
  console.log(`[reports-download] ${message}`, meta);
}

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
  if (filters.priority) params.append("priority", filters.priority);
  if (filters.startDate) params.append("startDate", filters.startDate);
  if (filters.endDate) params.append("endDate", filters.endDate);
  const query = params.toString();
  return query ? `?${query}` : "";
}

function getTimestampLabel() {
  return new Date().toISOString().replace(/[.:]/g, "-");
}

async function ensureReportsDirectory() {
  const reportsDir = `${FileSystem.documentDirectory}${REPORTS_FOLDER_NAME}/`;
  await FileSystem.makeDirectoryAsync(reportsDir, { intermediates: true });
  return reportsDir;
}

async function validateSavedReportFile(fileUri, ext) {
  const savedInfo = await FileSystem.getInfoAsync(fileUri);
  logReportDebug("validate-saved-file", {
    fileUri,
    ext,
    exists: savedInfo?.exists,
    size: savedInfo?.size,
  });

  if (!savedInfo?.exists || !savedInfo?.size) {
    throw new Error("Report file was saved empty");
  }

  if (ext === "pdf") {
    const pdfHeaderBase64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
      position: 0,
      length: 12,
    });

    logReportDebug("pdf-header-check", {
      fileUri,
      headerBase64Prefix: pdfHeaderBase64.slice(0, 12),
    });

    if (!pdfHeaderBase64.startsWith("JVBERi0")) {
      throw new Error("Downloaded PDF is invalid");
    }

    // Guard against tiny/truncated payloads while avoiding strict EOF checks
    // that can be unreliable across platform file reads.
    if (Number(savedInfo.size) < 1024) {
      throw new Error("Downloaded PDF appears incomplete");
    }
  }
}

async function tryBinaryDownload({ url, fileUri, headers, ext }) {
  logReportDebug("binary-download-start", { url, fileUri, ext });
  const downloadResult = await FileSystem.downloadAsync(url, fileUri, {
    headers: {
      ...headers,
      Accept: "application/octet-stream",
    },
  });

  logReportDebug("binary-download-result", {
    status: downloadResult?.status,
    uri: downloadResult?.uri,
    headers: downloadResult?.headers,
  });

  if (downloadResult?.status !== 200) {
    throw new Error(`Download failed with status ${downloadResult?.status}`);
  }

  await validateSavedReportFile(fileUri, ext);
  return fileUri;
}

async function tryBase64Download({ url, fileUri, headers, ext }) {
  const hasQuery = url.includes("?");
  const transportUrl = `${url}${hasQuery ? "&" : "?"}transport=base64`;

  logReportDebug("base64-download-start", {
    url: transportUrl,
    fileUri,
    ext,
  });

  const response = await apiCall({
    method: "GET",
    url: transportUrl,
    headers: {
      ...headers,
      Accept: "application/json",
      "X-Report-Transport": "base64",
    },
  });

  const payload = response?.data || response?.rawData?.data || {};
  const base64Content = payload?.contentBase64;
  logReportDebug("base64-download-result", {
    hasContent: Boolean(base64Content),
    base64Length: base64Content?.length || 0,
    byteLength: payload?.byteLength,
    filename: payload?.filename,
    contentType: payload?.contentType,
  });

  if (!base64Content) {
    throw new Error(
      response?.message || "Report download returned no file content",
    );
  }

  await FileSystem.writeAsStringAsync(fileUri, base64Content, {
    encoding: FileSystem.EncodingType.Base64,
  });

  await validateSavedReportFile(fileUri, ext);
  return fileUri;
}

async function downloadReportFile({ url, fileName, headers, ext }) {
  const reportsDir = await ensureReportsDirectory();
  const fileUri = `${reportsDir}${fileName}`;

  if (ext === "pdf") {
    logReportDebug("pdf-base64-forced", { url, fileUri });
    return tryBase64Download({ url, fileUri, headers, ext });
  }

  try {
    return await tryBinaryDownload({ url, fileUri, headers, ext });
  } catch (error) {
    logReportDebug("binary-download-failed-falling-back", {
      reason: error?.message || String(error),
      fileUri,
      ext,
    });
    // Some app/network stacks alter binary payload handling; base64 transport is a safe fallback.
    return tryBase64Download({ url, fileUri, headers, ext });
  }
}

async function openDownloadedFile(uri, mimeType) {
  try {
    if (Platform.OS === "android") {
      const contentUri = await FileSystem.getContentUriAsync(uri);
      logReportDebug("open-android-intent", { uri, contentUri, mimeType });
      await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
        data: contentUri,
        type: mimeType,
        flags: 1,
      });
      return true;
    }

    logReportDebug("open-non-android", { uri, mimeType });
    await Linking.openURL(uri);
    return true;
  } catch (error) {
    logReportDebug("open-failed", {
      uri,
      mimeType,
      reason: error?.message || String(error),
    });
    // Opening is best-effort only. Download should still be treated as successful.
    return false;
  }
}

export function useReportStats(filters, options = {}) {
  const querySuffix = buildReportQueryString(filters);
  return useApiQuery({
    queryKey: queryKeys.reportStats(filters),
    url: `${REPORT_STATS_URL}${querySuffix}`,
    enabled: options.enabled ?? true,
    staleTime: options.staleTime ?? 60 * 1000,
    retry: options.retry ?? 1,
  });
}

export function useDepartmentBreakdown(filters, options = {}) {
  const querySuffix = buildReportQueryString(filters);
  return useApiQuery({
    queryKey: queryKeys.reportDepartmentBreakdown(filters),
    url: `${REPORT_DEPARTMENT_BREAKDOWN_URL}${querySuffix}`,
    enabled: options.enabled ?? true,
    staleTime: options.staleTime ?? 60 * 1000,
    retry: options.retry ?? 1,
    select: (payload) => {
      if (!payload) return {};
      const { success, message, ...breakdown } = payload;
      return breakdown;
    },
  });
}

export function useDownloadReport() {
  const download = async ({ format, filters }) => {
    const token = await getAuthToken();
    if (!token) {
      throw new Error("Authentication required. Please log in again.");
    }

    const suffix = buildReportQueryString(filters);
    const url = `${REPORT_DOWNLOAD_URL(format)}${suffix}`;

    const ext = format === "excel" ? "xlsx" : format;
    const mimeTypes = {
      pdf: "application/pdf",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      csv: "text/csv",
    };
    const mimeType = mimeTypes[ext] || "application/octet-stream";
    const timestamp = getTimestampLabel();
    const fileName = `sahayak_report_${timestamp}.${ext}`;

    const headers = { Authorization: `Bearer ${token}` };
    logReportDebug("download-start", { format, ext, url });
    const savedFileUri = await downloadReportFile({
      url,
      fileName,
      headers,
      ext,
    });

    const opened = await openDownloadedFile(savedFileUri, mimeType);

    logReportDebug("download-complete", {
      format,
      ext,
      fileName,
      uri: savedFileUri,
      opened,
    });

    return { uri: savedFileUri, fileName, opened };
  };

  return { download };
}

export async function prepareReportsStorage() {
  await ensureReportsDirectory();
}

export { buildReportQueryString };
