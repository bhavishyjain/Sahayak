import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking, Platform } from "react-native";
import useApiQuery from "./useApiQuery";
import { REPORT_DOWNLOAD_URL, REPORT_STATS_URL } from "../../url";
import { getCachedToken } from "../cache/auth";
import getUserAuth from "../userAuth";

const REPORTS_FOLDER_NAME = "Sahayak";
const REPORTS_DIRECTORY_URI_KEY = "reportsDirectoryUri";

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

function getTimestampLabel() {
  return new Date().toISOString().replace(/[.:]/g, "-");
}

function stripExtension(fileName) {
  return fileName.replace(/\.[^/.]+$/, "");
}

function getDirectoryNameFromUri(uri) {
  const decoded = decodeURIComponent(uri);
  const slashIdx = decoded.lastIndexOf("/");
  return (slashIdx >= 0 ? decoded.slice(slashIdx + 1) : decoded).toLowerCase();
}

async function getAndroidFilesBaseUri() {
  const cachedUri = await AsyncStorage.getItem(REPORTS_DIRECTORY_URI_KEY);

  if (cachedUri) {
    try {
      await FileSystem.StorageAccessFramework.readDirectoryAsync(cachedUri);
      return cachedUri;
    } catch {
      await AsyncStorage.removeItem(REPORTS_DIRECTORY_URI_KEY);
    }
  }

  const initialUri =
    FileSystem.StorageAccessFramework.getUriForDirectoryInRoot("Download");
  const permission =
    await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(
      initialUri,
    );

  if (!permission.granted || !permission.directoryUri) {
    throw new Error("Storage permission was not granted");
  }

  await AsyncStorage.setItem(
    REPORTS_DIRECTORY_URI_KEY,
    permission.directoryUri,
  );
  return permission.directoryUri;
}

async function ensureAndroidReportsDirectory() {
  const baseUri = await getAndroidFilesBaseUri();
  const existingItems =
    await FileSystem.StorageAccessFramework.readDirectoryAsync(baseUri);

  const existingReportsUri = existingItems.find(
    (itemUri) =>
      getDirectoryNameFromUri(itemUri) === REPORTS_FOLDER_NAME.toLowerCase(),
  );

  if (existingReportsUri) {
    return existingReportsUri;
  }

  try {
    return await FileSystem.StorageAccessFramework.makeDirectoryAsync(
      baseUri,
      REPORTS_FOLDER_NAME,
    );
  } catch {
    const refreshedItems =
      await FileSystem.StorageAccessFramework.readDirectoryAsync(baseUri);
    const recoveredUri = refreshedItems.find(
      (itemUri) =>
        getDirectoryNameFromUri(itemUri) === REPORTS_FOLDER_NAME.toLowerCase(),
    );
    if (recoveredUri) {
      return recoveredUri;
    }
    throw new Error("Could not create Sahayak folder in Files");
  }
}

async function downloadToAndroidFiles({ url, fileName, mimeType, headers }) {
  const reportsDirUri = await ensureAndroidReportsDirectory();
  const tempUri = `${FileSystem.cacheDirectory}${fileName}`;

  const downloadResult = await FileSystem.downloadAsync(url, tempUri, {
    headers,
  });
  if (downloadResult.status !== 200) {
    throw new Error(`Download failed with status ${downloadResult.status}`);
  }

  const safFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
    reportsDirUri,
    stripExtension(fileName),
    mimeType,
  );

  const base64Data = await FileSystem.readAsStringAsync(downloadResult.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await FileSystem.writeAsStringAsync(safFileUri, base64Data, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true });

  return safFileUri;
}

async function openDownloadedFile(uri, mimeType) {
  try {
    if (Platform.OS === "android") {
      if (uri.startsWith("content://")) {
        await Linking.openURL(uri);
        return;
      }

      const contentUri = await FileSystem.getContentUriAsync(uri);
      await Linking.openURL(contentUri);
      return;
    }

    await Linking.openURL(uri);
  } catch {
    await Sharing.shareAsync(uri, {
      mimeType,
      dialogTitle: "Open Report",
      UTI: mimeType === "application/pdf" ? "com.adobe.pdf" : "public.data",
    });
  }
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
    const timestamp = getTimestampLabel();
    const fileName = `sahayak_report_${timestamp}.${ext}`;

    const token = await getAuthToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    let savedFileUri = null;

    if (Platform.OS === "android") {
      savedFileUri = await downloadToAndroidFiles({
        url,
        fileName,
        mimeType,
        headers,
      });
    } else {
      const reportsDir = `${FileSystem.documentDirectory}${REPORTS_FOLDER_NAME}/`;
      const fileUri = `${reportsDir}${fileName}`;
      await FileSystem.makeDirectoryAsync(reportsDir, { intermediates: true });
      const result = await FileSystem.downloadAsync(url, fileUri, { headers });

      if (result.status !== 200) {
        throw new Error(`Download failed with status ${result.status}`);
      }

      savedFileUri = result.uri;
    }

    await openDownloadedFile(savedFileUri, mimeType);
  };

  return { download };
}

export { buildReportQueryString };
