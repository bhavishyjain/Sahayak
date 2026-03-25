import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
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

async function downloadReportFile({ url, fileName, headers }) {
  const reportsDir = await ensureReportsDirectory();
  const fileUri = `${reportsDir}${fileName}`;
  const response = await apiCall({
    method: "GET",
    url,
    headers: {
      ...headers,
      Accept: "application/json",
      "X-Report-Transport": "base64",
    },
  });
  const base64Content =
    response?.data?.contentBase64 ?? response?.rawData?.contentBase64;

  if (!base64Content) {
    throw new Error(
      response?.message || "Report download returned no file content",
    );
  }

  await FileSystem.writeAsStringAsync(
    fileUri,
    base64Content,
    {
      encoding: FileSystem.EncodingType.Base64,
    },
  );
  return fileUri;
}

async function openDownloadedFile(uri, mimeType) {
  try {
    if (Platform.OS === "android") {
      const contentUri = await FileSystem.getContentUriAsync(uri);
      await Linking.openURL(contentUri);
      return;
    }

    await Linking.openURL(uri);
    return;
  } catch {
    if (Platform.OS === "android") {
      try {
        const contentUri = await FileSystem.getContentUriAsync(uri);
        await Linking.openURL(contentUri);
      } catch {
        try {
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, {
              mimeType,
              dialogTitle: "Open Report",
              UTI:
                mimeType === "application/pdf"
                  ? "com.adobe.pdf"
                  : "public.data",
            });
          }
        } catch {
          // Download succeeded; opening is best-effort on Android.
        }
      }
    } else {
      try {
        await Linking.openURL(uri);
      } catch {
        try {
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, {
              mimeType,
              dialogTitle: "Open Report",
              UTI:
                mimeType === "application/pdf"
                  ? "com.adobe.pdf"
                  : "public.data",
            });
          }
        } catch {
          // Download succeeded; opening is best-effort on iOS.
        }
      }
    }
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

    const token = await getAuthToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const savedFileUri = await downloadReportFile({
      url,
      fileName,
      headers,
    });

    await openDownloadedFile(savedFileUri, mimeType);
  };

  return { download };
}

export async function prepareReportsStorage() {
  await ensureReportsDirectory();
}

export { buildReportQueryString };
