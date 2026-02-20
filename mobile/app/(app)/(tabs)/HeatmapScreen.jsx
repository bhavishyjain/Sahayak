import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { api } from "../../../api/client";
import { useAuth } from "../../../contexts/AuthContext";
import { usePreferences } from "../../../contexts/PreferencesContext";
import { darkColors, lightColors } from "../../../theme/colors";

let WebView = null;
try {
  const RNWebView = require("react-native-webview");
  WebView = RNWebView.WebView;
} catch (_error) {
  WebView = null;
}

function normalizeSpots(spots = []) {
  return spots
    .filter(
      (item) =>
        Number.isFinite(item?.coordinates?.lat) &&
        Number.isFinite(item?.coordinates?.lng)
    )
    .map((item) => ({
      locationName: item.locationName || "Unknown location",
      lat: item.coordinates.lat,
      lng: item.coordinates.lng,
      intensity: Number(item.intensity || 1),
      totalComplaints: Number(item.totalComplaints || 0),
      openComplaints: Number(item.openComplaints || 0),
      severity: item.severity || "low",
    }));
}

function buildLeafletHtml(spots, isDark) {
  const spotsJson = JSON.stringify(spots);

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <style>
      html, body, #root { height: 100%; margin: 0; padding: 0; background: ${isDark ? "#191918" : "#f8f8f8"}; }
      #mapCanvas {
        width: 100%;
        height: 100%;
        display: block;
        background: ${isDark ? "#1f1f1f" : "#f3f4f6"};
      }
      #empty {
        position: absolute;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        text-align: center;
        color: ${isDark ? "#d4d4d4" : "#333333"};
        background: transparent;
        font-family: Arial, sans-serif;
        padding: 18px;
        z-index: 1100;
      }
      .legend {
        position: absolute;
        right: 10px;
        bottom: 12px;
        z-index: 999;
        background: rgba(24, 24, 24, 0.88);
        color: #fff;
        border-radius: 10px;
        padding: 8px 10px;
        font-size: 11px;
        line-height: 1.45;
        min-width: 112px;
        border: 1px solid rgba(255, 255, 255, 0.18);
      }
      .legend-row {
        display: flex;
        align-items: center;
        gap: 7px;
        margin-top: 4px;
      }
      .legend-dot {
        width: 9px;
        height: 9px;
        border-radius: 999px;
        display: inline-block;
      }
    </style>
  </head>
  <body>
    <div id="root">
      <canvas id="mapCanvas"></canvas>
      <div id="empty">No heatmap points with coordinates yet.</div>
    </div>
    <div class="legend">
      <div><b>Intensity</b></div>
      <div class="legend-row"><span class="legend-dot" style="background:#5BCB58;"></span>Low</div>
      <div class="legend-row"><span class="legend-dot" style="background:#FFCC00;"></span>Medium</div>
      <div class="legend-row"><span class="legend-dot" style="background:#ffc107;"></span>High</div>
      <div class="legend-row"><span class="legend-dot" style="background:#F94E4E;"></span>Very high</div>
    </div>
    <script>
      const spots = ${spotsJson};
      const canvas = document.getElementById("mapCanvas");
      const empty = document.getElementById("empty");
      const ctx = canvas.getContext("2d");

      function colorBySeverity(sev) {
        if (sev === "very-high") return "#F94E4E";
        if (sev === "high") return "#ffc107";
        if (sev === "medium") return "#FFCC00";
        return "#5BCB58";
      }

      function clamp(n, min, max) {
        return Math.max(min, Math.min(max, n));
      }

      function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }

      function drawGrid() {
        const w = canvas.width;
        const h = canvas.height;
        ctx.fillStyle = "${isDark ? "#1f1f1f" : "#f3f4f6"}";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"}";
        ctx.lineWidth = 1;
        for (let x = 0; x <= w; x += 36) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
        for (let y = 0; y <= h; y += 36) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
      }

      function project(lat, lng, minLat, maxLat, minLng, maxLng) {
        const w = canvas.width;
        const h = canvas.height;
        const pad = 42;
        const safeW = w - pad * 2;
        const safeH = h - pad * 2;
        const xNorm = maxLng === minLng ? 0.5 : (lng - minLng) / (maxLng - minLng);
        const yNorm = maxLat === minLat ? 0.5 : (lat - minLat) / (maxLat - minLat);
        return {
          x: pad + clamp(xNorm, 0, 1) * safeW,
          y: h - (pad + clamp(yNorm, 0, 1) * safeH),
        };
      }

      function drawSpot(spot, point) {
        const color = colorBySeverity(spot.severity);
        const radius = Math.max(28, Math.min(110, (spot.intensity || 1) * 8));

        const grad = ctx.createRadialGradient(point.x, point.y, 4, point.x, point.y, radius);
        grad.addColorStop(0, color + "cc");
        grad.addColorStop(0.55, color + "55");
        grad.addColorStop(1, color + "00");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      function draw() {
        resizeCanvas();
        drawGrid();

        if (!spots.length) {
          empty.style.display = "flex";
          return;
        }
        empty.style.display = "none";

        let minLat = spots[0].lat;
        let maxLat = spots[0].lat;
        let minLng = spots[0].lng;
        let maxLng = spots[0].lng;

        spots.forEach((spot) => {
          minLat = Math.min(minLat, spot.lat);
          maxLat = Math.max(maxLat, spot.lat);
          minLng = Math.min(minLng, spot.lng);
          maxLng = Math.max(maxLng, spot.lng);
        });

        spots.forEach((spot) => {
          const point = project(spot.lat, spot.lng, minLat, maxLat, minLng, maxLng);
          drawSpot(spot, point);
        });
      }

      draw();
      window.addEventListener("resize", draw);
    </script>
  </body>
</html>`;
}

export default function HeatmapScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { theme } = usePreferences();
  const colors = useMemo(() => (theme === "dark" ? darkColors : lightColors), [theme]);
  const [spots, setSpots] = useState([]);
  const coordSpots = useMemo(() => normalizeSpots(spots), [spots]);
  const mapHtml = useMemo(
    () => buildLeafletHtml(coordSpots, theme === "dark"),
    [coordSpots, theme]
  );

  const load = useCallback(async () => {
    const data = await api.dashboardHeatmap(token);
    setSpots(data.spots || []);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => {});
    }, [load])
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.backgroundPrimary, paddingHorizontal: 16 }}>
      <Text className="mt-3 mb-1 text-3xl font-extrabold" style={{ color: colors.textPrimary }}>
        {t("heatmap")}
      </Text>
      <Text className="mb-4 text-sm" style={{ color: colors.textSecondary }}>
        {t("heatmapSubtitle")}
      </Text>

      <View
        className="mb-1 overflow-hidden rounded-2xl"
        style={{ flex: 1, minHeight: 420, borderWidth: 1, borderColor: colors.border }}
      >
        {WebView ? (
          <WebView
            originWhitelist={["*"]}
            source={{ html: mapHtml }}
            javaScriptEnabled
            domStorageEnabled
            setSupportMultipleWindows={false}
            style={{ flex: 1, backgroundColor: colors.backgroundCard }}
          />
        ) : (
          <View className="h-full items-center justify-center px-4">
            <Text style={{ color: colors.textSecondary, textAlign: "center" }}>
              WebView is missing. Install react-native-webview.
            </Text>
          </View>
        )}
      </View>
      {coordSpots.length === 0 && (
        <Text style={{ color: colors.textSecondary }}>{t("noHeatmapData")}</Text>
      )}
    </SafeAreaView>
  );
}
