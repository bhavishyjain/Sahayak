import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
  Dimensions,
} from "react-native";
import { WebView } from "react-native-webview";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import CustomPicker from "../../../components/CustomPicker";
import useDepartments from "../../../utils/hooks/useDepartments";
import {
  getSeverityColor,
  getSeverityName,
  normalizeSeverity,
} from "../../../utils/complaintHelpers";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import { useNetworkStatus } from "../../../utils/useNetworkStatus";
import { useHeatmapData } from "../../../utils/hooks/useHeatmapData";

export default function HeatMap() {
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const { isOnline } = useNetworkStatus();
  const { departmentOptions } = useDepartments();

  const [filters, setFilters] = useState({
    department: "all",
    priority: "all",
    timeframe: "30days",
  });

  const {
    webViewRef,
    userLocation,
    requestUserLocation,
    spots,
    stats,
    isLoading,
    refetch,
    isRefetching,
  } = useHeatmapData(filters, colors, t);

  const getUnresolvedCount = useCallback(
    (spot) => Number(spot?.unresolvedComplaints ?? spot?.openComplaints ?? 0),
    [],
  );

  const formatCompactCount = useCallback((value) => {
    const number = Number(value || 0);
    if (number < 1000) return String(number);
    if (number < 1000000) {
      const compact = (number / 1000).toFixed(number >= 10000 ? 0 : 1);
      return `${compact.replace(/\.0$/, "")}K`;
    }
    const compact = (number / 1000000).toFixed(number >= 10000000 ? 0 : 1);
    return `${compact.replace(/\.0$/, "")}M`;
  }, []);

  // Filter options
  const departments = useMemo(() => [
    { label: t("heatmap.allDepartments"), value: "all" },
    ...departmentOptions,
  ], [departmentOptions, t]);

  const priorities = useMemo(() => [
    { label: t("heatmap.allPriorities"), value: "all" },
    { label: t("complaints.priority.high"), value: "High" },
    { label: t("complaints.priority.medium"), value: "Medium" },
    { label: t("complaints.priority.low"), value: "Low" },
  ], [t]);

  const timeframes = useMemo(() => [
    { label: t("heatmap.timePeriods.7days"), value: "7days" },
    {
      label: t("heatmap.timePeriods.30days"),
      value: "30days",
    },
    {
      label: t("heatmap.timePeriods.3months"),
      value: "3months",
    },
    {
      label: t("heatmap.timePeriods.6months"),
      value: "6months",
    },
  ], [t]);

  // Generate Leaflet map HTML
  const generateMapHTML = () => {
    const popupLabels = {
      unresolved: t("heatmap.popup.unresolved"),
      total: t("heatmap.popup.total"),
      resolved: t("heatmap.popup.resolved"),
      department: t("heatmap.popup.department"),
      severity: t("heatmap.popup.severity"),
    };
    const legendLabels = {
      severity: t("heatmap.legend.severity"),
      critical: t("heatmap.severity.critical"),
      high: t("heatmap.severity.high"),
      medium: t("heatmap.severity.medium"),
      low: t("heatmap.severity.low"),
    };
    const severityColorMap = {
      critical: getSeverityColor("critical", colors) ?? colors.textSecondary,
      high: getSeverityColor("high", colors) ?? colors.textSecondary,
      medium: getSeverityColor("medium", colors) ?? colors.textSecondary,
      low: getSeverityColor("low", colors) ?? colors.textSecondary,
    };
    const userLocationLabel = JSON.stringify(t("heatmap.userLocation"));
    const mapCenter = userLocation
      ? [userLocation.lat, userLocation.lng]
      : [22.7196, 75.8577]; // Indore as default

    // Group complaints by department for clustering
    const getDepartmentColor = (dept) => {
      const palette = {
        water: "#3B82F6", // blue
        road: "#6B7280", // gray
        electricity: "#FBBF24", // yellow
        waste: "#10B981", // green
        drainage: "#8B5CF6", // purple
        other: "#9CA3AF", // slate
      };
      return palette[String(dept ?? "").toLowerCase()] ?? palette.other;
    };

    const markers = spots
      .filter((spot) => {
        const lat = Number(spot.coordinates?.lat);
        const lng = Number(spot.coordinates?.lng);
        return Number.isFinite(lat) && Number.isFinite(lng);
      })
      .map((spot) => {
        const totalCount = Number(spot.totalComplaints || 0);
        const unresolvedCount = getUnresolvedCount(spot);
        const resolvedCount = Math.max(totalCount - unresolvedCount, 0);
        const spotSeverity = normalizeSeverity(spot.severity);
        const spotSeverityColor =
          getSeverityColor(spotSeverity, colors) ?? colors.textSecondary;
        const spotSeverityLabel = getSeverityName(t, spotSeverity);
        return `
        L.circleMarker([${spot.coordinates?.lat || 0}, ${spot.coordinates?.lng || 0}], {
          color: '${spotSeverityColor}',
          fillColor: '${spotSeverityColor}',
          fillOpacity: 0.6,
          radius: Math.min(${unresolvedCount} * 2 + 6, 22),
          unresolvedCount: ${unresolvedCount}
        })
        .addTo(markers)
        .bindPopup(\`
          <div style="font-family: system-ui; min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; color: #1f2937; font-size: 14px; font-weight: 600;">${spot.locationName}</h3>
            <div style="font-size: 12px; color: #4b5563; line-height: 1.6;">
              <div><strong>${popupLabels.unresolved}:</strong> ${unresolvedCount}</div>
              <div><strong>${popupLabels.total}:</strong> ${totalCount}</div>
              <div><strong>${popupLabels.resolved}:</strong> ${resolvedCount}</div>
              <div><strong>${popupLabels.department}:</strong> <span style="color: ${getDepartmentColor(spot.topDepartment)}; font-weight: 600;">${spot.topDepartment}</span></div>
              <div><strong>${popupLabels.severity}:</strong> <span style="color: ${spotSeverityColor}; font-weight: 600;">${spotSeverityLabel}</span></div>
            </div>
          </div>
        \`);
      `;
      })
      .join("");

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${t("heatmap.title")}</title>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
        <style>
          body { margin: 0; padding: 0; }
          #map { height: 100vh; width: 100%; }
          
          /* Custom cluster styles */
          .marker-cluster-small {
            background-color: rgba(59, 130, 246, 0.6);
          }
          .marker-cluster-small div {
            background-color: rgba(59, 130, 246, 0.8);
          }
          .marker-cluster-medium {
            background-color: rgba(251, 191, 36, 0.6);
          }
          .marker-cluster-medium div {
            background-color: rgba(251, 191, 36, 0.8);
          }
          .marker-cluster-large {
            background-color: rgba(220, 38, 38, 0.6);
          }
          .marker-cluster-large div {
            background-color: rgba(220, 38, 38, 0.8);
          }
          .marker-cluster {
            border-radius: 50%;
          }
          .marker-cluster div {
            border-radius: 50%;
            color: white;
            font-weight: bold;
            font-size: 11px;
            text-align: center;
            font-family: system-ui;
            line-height: 1;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .legend {
            position: absolute;
            bottom: 12px;
            right: 8px;
            background: white;
            padding: 6px;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            font-family: system-ui;
            font-size: 10px;
            z-index: 1000;
            max-width: 130px;
            max-height: 120px;
            overflow-y: auto;
          }
          .legend-title {
            font-weight: 600;
            margin-bottom: 4px;
            color: #1f2937;
            font-size: 10px;
          }
          .legend-section {
            margin-bottom: 5px;
          }
          .legend-section:last-child {
            margin-bottom: 0;
          }
          .legend-section-title {
            font-weight: 600;
            margin-bottom: 3px;
            color: #1f2937;
            font-size: 9px;
            text-transform: uppercase;
          }
          .legend-item {
            display: flex;
            align-items: center;
            margin-bottom: 2px;
          }
          .legend-color {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 5px;
            border: 1px solid rgba(0,0,0,0.1);
          }
          .current-location-btn {
            position: absolute;
            bottom: 20px;
            left: 10px;
            width: 44px;
            height: 44px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 1000;
            border: none;
          }
          .current-location-btn:active {
            background: #f3f4f6;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <button class="current-location-btn" onclick="goToUserLocation()">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="3" fill="#3B82F6"/>
            <path d="M12 2v4M12 18v4M22 12h-4M6 12H2" stroke="#3B82F6" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
        <div class="legend">
          <div class="legend-section">
            <div class="legend-section-title">${legendLabels.severity}</div>
            <div class="legend-item">
              <div class="legend-color" style="background-color: ${severityColorMap.critical};"></div>
              <span>${legendLabels.critical}</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background-color: ${severityColorMap.high};"></div>
              <span>${legendLabels.high}</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background-color: ${severityColorMap.medium};"></div>
              <span>${legendLabels.medium}</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background-color: ${severityColorMap.low};"></div>
              <span>${legendLabels.low}</span>
            </div>
          </div>
        </div>
        <script>
          function formatCompactCount(value) {
            const number = Number(value || 0);
            if (number < 1000) return String(number);
            if (number < 1000000) {
              const compact = (number / 1000).toFixed(number >= 10000 ? 0 : 1);
              return compact.replace(/\.0$/, '') + 'K';
            }
            const compact = (number / 1000000).toFixed(number >= 10000000 ? 0 : 1);
            return compact.replace(/\.0$/, '') + 'M';
          }

          const map = L.map('map').setView([${mapCenter[0]}, ${mapCenter[1]}], 12);
          
          L.tileLayer('https://maps.dkpg.xyz/get-map-tile.php?x={x}&y={y}&z={z}&lyrs=h', {
            attribution: '',
            maxZoom: 19
          }).addTo(map);

          // Create marker cluster group
          const markers = L.markerClusterGroup({
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            iconCreateFunction: function(cluster) {
              const unresolvedCount = cluster.getAllChildMarkers().reduce(function(sum, marker) {
                return sum + (Number(marker.options.unresolvedCount) || 0);
              }, 0);

              const displayCount = unresolvedCount;
              const displayLabel = formatCompactCount(displayCount);
              let c = ' marker-cluster-';
              if (displayCount < 20) {
                c += 'small';
              } else if (displayCount < 100) {
                c += 'medium';
              } else {
                c += 'large';
              }
              
              return new L.DivIcon({ 
                html: '<div><span>' + displayLabel + '</span></div>', 
                className: 'marker-cluster' + c, 
                iconSize: new L.Point(44, 44) 
              });
            }
          });

          // Store user location as JavaScript variable
          const userLocation = ${userLocation ? `{ lat: ${userLocation.lat}, lng: ${userLocation.lng} }` : "null"};

          ${
            userLocation
              ? `
          L.marker([${userLocation.lat}, ${userLocation.lng}], {
            icon: L.divIcon({
              className: 'user-location-marker',
              html: '<div style="background-color: #3B82F6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>',
              iconSize: [22, 22],
              iconAnchor: [11, 11]
            })
          })
          .addTo(map)
            .bindPopup(${userLocationLabel});
          `
              : ""
          }

          ${markers}

          // Add markers to map
          map.addLayer(markers);

          // Function to center map on user location
          function goToUserLocation() {
            if (userLocation) {
              map.setView([userLocation.lat, userLocation.lng], 15, {
                animate: true,
                duration: 0.5
              });
            } else {
              // Send message to React Native to request location
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ action: 'requestLocation' }));
              }
            }
          }
        </script>
      </body>
      </html>
    `;
  };

  const updateFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Handle messages from WebView
  const handleWebViewMessage = useCallback(
    async (event) => {
      try {
        const message = JSON.parse(event.nativeEvent.data);
        if (message.action === "requestLocation") {
          await requestUserLocation();
        }
      } catch (_error) {
        // Silent error handling
      }
    },
    [requestUserLocation],
  );

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader title={t("heatmap.title")} hasBackButton={false} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Filters */}
        <View className="px-4 mb-4">
          <View
            className="p-4 rounded-xl"
            style={{
              backgroundColor: colors.cardBackground,
            }}
          >
            <Text
              style={{ color: colors.textPrimary }}
              className="text-lg font-bold mb-4"
            >
              {t("heatmap.filters")}
            </Text>

            <View className="flex-row mb-4" style={{ gap: 8 }}>
              <View
                className="px-3 py-2 rounded-lg"
                style={{ backgroundColor: colors.backgroundSecondary, flex: 1 }}
              >
                <Text
                  className="text-xs"
                  style={{ color: colors.textSecondary }}
                >
                  {t("heatmap.totalComplaints")}
                </Text>
                <Text
                  className="text-base font-bold"
                  style={{ color: colors.textPrimary }}
                >
                  {formatCompactCount(stats.total)}
                </Text>
              </View>
              <View
                className="px-3 py-2 rounded-lg"
                style={{
                  backgroundColor: colors.warning + "1A",
                  borderWidth: 1,
                  borderColor: colors.warning + "55",
                  flex: 1,
                }}
              >
                <Text
                  className="text-xs"
                  style={{ color: colors.textSecondary }}
                >
                  {t("heatmap.unresolvedComplaints")}
                </Text>
                <Text
                  className="text-base font-bold"
                  style={{ color: colors.warning }}
                >
                  {formatCompactCount(stats.unresolved)}
                </Text>
              </View>
            </View>

            <View style={{ gap: 10 }}>
              <View>
                <Text
                  className="text-xs font-semibold mb-1.5"
                  style={{ color: colors.textSecondary }}
                >
                  {t("heatmap.department")}
                </Text>
                <CustomPicker
                  placeholder={t("heatmap.department")}
                  value={filters.department}
                  onChange={(item) => updateFilter("department", item.value)}
                  data={departments}
                  searchPlaceholder={null}
                  containerStyle={{
                    borderWidth: 1.5,
                    borderColor: colors.border,
                  }}
                />
              </View>

              <View>
                <Text
                  className="text-xs font-semibold mb-1.5"
                  style={{ color: colors.textSecondary }}
                >
                  {t("heatmap.priority")}
                </Text>
                <CustomPicker
                  placeholder={t("heatmap.priority")}
                  value={filters.priority}
                  onChange={(item) => updateFilter("priority", item.value)}
                  data={priorities}
                  searchPlaceholder={null}
                  containerStyle={{
                    borderWidth: 1.5,
                    borderColor: colors.border,
                  }}
                />
              </View>

              <View>
                <Text
                  className="text-xs font-semibold mb-1.5"
                  style={{ color: colors.textSecondary }}
                >
                  {t("heatmap.timeframe")}
                </Text>
                <CustomPicker
                  placeholder={t("heatmap.timeframe")}
                  value={filters.timeframe}
                  onChange={(item) => updateFilter("timeframe", item.value)}
                  data={timeframes}
                  searchPlaceholder={null}
                  containerStyle={{
                    borderWidth: 1.5,
                    borderColor: colors.border,
                  }}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Leaflet Map */}
        <View className="px-4 mb-4">
          <View
            className="rounded-xl overflow-hidden"
            style={{
              backgroundColor: colors.cardBackground,
              height: Dimensions.get("window").height - 300,
              minHeight: 500,
            }}
          >
            {isLoading ? (
              <View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <ActivityIndicator size="large" color={colors.primary} />
                <Text
                  style={{ color: colors.textSecondary, marginTop: 10 }}
                  className="text-sm"
                >
                  {t("heatmap.loadingMap")}
                </Text>
              </View>
            ) : !isOnline ? (
              <View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                  padding: 24,
                }}
              >
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: 16,
                    fontWeight: "600",
                    marginBottom: 8,
                  }}
                >
                  {t("heatmap.offlineTitle")}
                </Text>
                <Text
                  style={{ color: colors.textSecondary, textAlign: "center" }}
                >
                  {t("heatmap.offlineMessage")}
                </Text>
              </View>
            ) : (
              <WebView
                ref={webViewRef}
                source={{ html: generateMapHTML() }}
                style={{ flex: 1 }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                onMessage={handleWebViewMessage}
                renderLoading={() => (
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      justifyContent: "center",
                      alignItems: "center",
                      backgroundColor: colors.cardBackground,
                    }}
                  >
                    <ActivityIndicator size="large" color={colors.primary} />
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
