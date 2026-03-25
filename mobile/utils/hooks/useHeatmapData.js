import { useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import apiCall from "../api";
import { GET_HEATMAP_URL } from "../../url";
import { queryKeys } from "../queryKeys";
import {
  getSeverityColor,
  getSeverityName,
  normalizeSeverity,
} from "../complaintHelpers";

export function useHeatmapData(filters, colors, t) {
  const webViewRef = useRef(null);
  const [userLocation, setUserLocation] = useState(null);

  const fetchUserLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (location) {
        setUserLocation({
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        });
      }
    } catch (_error) {
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchUserLocation();
    }, [fetchUserLocation]),
  );

  useEffect(() => {
    if (!userLocation || !webViewRef.current) return;
    webViewRef.current.injectJavaScript(`
      if (typeof map !== 'undefined') {
        userLocation = { lat: ${userLocation.lat}, lng: ${userLocation.lng} };
        true;
      }
    `);
  }, [t, userLocation]);

  const query = useQuery({
    queryKey: queryKeys.heatmap(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.department !== "all") params.append("department", filters.department);
      if (filters.priority !== "all") params.append("priority", filters.priority);
      if (filters.timeframe) params.append("timeframe", filters.timeframe);
      params.append("granularity", "complaint");

      const response = await apiCall({
        method: "GET",
        url: `${GET_HEATMAP_URL}?${params.toString()}`,
      });
      return response?.data ?? { spots: [] };
    },
    retry: 1,
  });

  const spots = query.data?.spots || [];
  const getUnresolvedCount = (spot) =>
    Number(spot?.unresolvedComplaints ?? spot?.openComplaints ?? 0);

  return {
    ...query,
    webViewRef,
    userLocation,
    requestUserLocation: fetchUserLocation,
    spots,
    stats: {
      total: spots.reduce((sum, s) => sum + Number(s.totalComplaints || 0), 0),
      unresolved: spots.reduce((sum, s) => sum + getUnresolvedCount(s), 0),
    },
    getSeverityColor: (severity) => getSeverityColor(severity, colors),
    getSeverityName: (severity) => getSeverityName(normalizeSeverity(severity), t),
  };
}
