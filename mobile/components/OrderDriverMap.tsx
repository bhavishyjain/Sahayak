import { X } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Image, Modal, Text, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { darkColors, lightColors } from "../app/(app)/colors";
import {
  GET_OSM_ROUTE_URL,
  GET_OSM_TILE_URL_HYB,
  GET_OSM_TILE_URL_ROAD,
} from "../url";
import { useTheme } from "../utils/context/theme";
import CustomSwitch from "./dkpg/CustomSwitch";
import PressableBlock from "./dkpg/PressableBlock";

type LatLng = { latitude: number; longitude: number };

const storeIconUri = Image.resolveAssetSource(
  require("../assets/images/customer-location.png"),
).uri;

const driverIconUri = Image.resolveAssetSource(
  require("../assets/images/driver-location.png"),
).uri;

type Props = {
  visible: boolean;
  onClose: () => void;
  restaurantLat: number;
  restaurantLng: number;
  deliveryLat?: number;
  deliveryLng?: number;
};

const REROUTE_DISTANCE_METERS = 10;
const ANIMATION_DURATION_MS = 1000; // 1 second smooth animation

export default function OrderDriverMap({
  visible,
  onClose,
  restaurantLat,
  restaurantLng,
  deliveryLat,
  deliveryLng,
}: Props) {
  const webViewRef = useRef<WebView>(null);
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const insets = useSafeAreaInsets();

  const [satelliteEnabled, setSatelliteEnabled] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [showWebView, setShowWebView] = useState(false);

  const [route, setRoute] = useState<LatLng[]>([]);
  const lastRoutedPoint = useRef<LatLng | null>(null);
  const currentDeliveryPos = useRef<LatLng | null>(null);

  /* ---------------- delay WebView mount ---------------- */

  useEffect(() => {
    if (visible) {
      const t = setTimeout(() => {
        setShowWebView(true);
      }, 80);
      return () => {
        clearTimeout(t);
        setShowWebView(false);
        setMapReady(false);
        lastRoutedPoint.current = null;
        currentDeliveryPos.current = null;
      };
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        onClose();
        return true;
      },
    );

    return () => subscription.remove();
  }, [visible, onClose]);

  /* ---------------- helpers ---------------- */

  const distanceMeters = (a: LatLng, b: LatLng) => {
    const R = 6371000;
    const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
    const lat1 = (a.latitude * Math.PI) / 180;
    const lat2 = (b.latitude * Math.PI) / 180;

    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

    return 2 * R * Math.asin(Math.sqrt(h));
  };

  const decodePolyline = (encoded: string): LatLng[] => {
    let index = 0;
    let lat = 0;
    let lng = 0;
    const coords: LatLng[] = [];

    while (index < encoded.length) {
      let b,
        shift = 0,
        result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      lat += result & 1 ? ~(result >> 1) : result >> 1;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      lng += result & 1 ? ~(result >> 1) : result >> 1;

      coords.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }

    return coords;
  };

  /* ---------------- fetch route ---------------- */

  const fetchRoute = async (from: LatLng, to: LatLng) => {
    try {
      const res = await fetch(GET_OSM_ROUTE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originLat: from.latitude,
          originLong: from.longitude,
          destinationLat: to.latitude,
          destinationLong: to.longitude,
        }),
      });

      const text = await res.text();
      if (text.trim().startsWith("<")) {
        return;
      }

      const data = JSON.parse(text);

      if (data?.[0]?.geometry) {
        const newRoute = decodePolyline(data[0].geometry);
        setRoute(newRoute);
        lastRoutedPoint.current = to;
      } else {
        console.log("⚠️ No geometry in route response");
      }
    } catch (e) {
      console.error("❌ OSM route error", e);
    }
  };

  /* ---------------- reroute ---------------- */

  useEffect(() => {
    if (!deliveryLat || !deliveryLng) {
      return;
    }

    const current = { latitude: deliveryLat, longitude: deliveryLng };
    currentDeliveryPos.current = current;

    // First time or no previous route
    if (!lastRoutedPoint.current) {
      fetchRoute(
        { latitude: restaurantLat, longitude: restaurantLng },
        current,
      );
      return;
    }

    const distance = distanceMeters(lastRoutedPoint.current, current);

    // Check if delivery position moved significantly from last routed point
    if (distance > REROUTE_DISTANCE_METERS) {
      fetchRoute(
        { latitude: restaurantLat, longitude: restaurantLng },
        current,
      );
    }
  }, [deliveryLat, deliveryLng, restaurantLat, restaurantLng]);

  /* ---------------- update into WebView (with animation) ---------------- */

  useEffect(() => {
    if (!mapReady || !deliveryLat || !deliveryLng) return;

    webViewRef.current?.injectJavaScript(`
      window.updateDeliveryLocation(${deliveryLat}, ${deliveryLng}, ${ANIMATION_DURATION_MS});
      true;
    `);
  }, [mapReady, deliveryLat, deliveryLng]);

  useEffect(() => {
    if (!mapReady || !route.length) return;

    const pts = route.map((p) => `[${p.latitude},${p.longitude}]`).join(",");

    webViewRef.current?.injectJavaScript(`
      window.updateRoute([${pts}], ${ANIMATION_DURATION_MS});
      true;
    `);
  }, [mapReady, route]);

  useEffect(() => {
    if (!mapReady) return;

    webViewRef.current?.injectJavaScript(`
      window.switchTiles(${satelliteEnabled});
      true;
    `);
  }, [mapReady, satelliteEnabled]);

  /* ---------------- WebView HTML ---------------- */

  const mapHTML = useMemo(() => {
    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
html,body,#map{height:100%;margin:0;padding:0;}
.driver-marker {
  transition: transform 0.3s ease-out;
}
</style>
</head>

<body>
<div id="map"></div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
console.log("🌐 WebView script starting");

function log(msg) {
  console.log(msg);
  try {
    window.ReactNativeWebView.postMessage(JSON.stringify({type: "log", message: msg}));
  } catch(e) {}
}

function icon(url){
  return L.icon({ 
    iconUrl: url, 
    iconSize: [54, 60], 
    iconAnchor: [22, 50],
    popupAnchor: [0, -50],
    className: 'driver-marker'
  });
}

window.onload = function(){
  log("✅ Window loaded");
  
  try {
    log("🗺️ Creating map");
    const map = L.map("map", {
      zoomControl: true,
      attributionControl: false
    }).setView([${restaurantLat}, ${restaurantLng}], 13);

    log("🗺️ Map created, setting up tiles");

    const roadmap = L.tileLayer(
      "${GET_OSM_TILE_URL_ROAD}",
      {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      }
    );

    const satellite = L.tileLayer(
      "${GET_OSM_TILE_URL_HYB}",
      {
        maxZoom: 19,
        attribution: '© Esri'
      }
    );

    log("🗺️ Tile layers created");

    window.currentLayer = roadmap;
    roadmap.addTo(map);
    // log("✅ Roadmap layer added");

    roadmap.on('loading', function() {
      // log("⏳ Roadmap tiles loading...");
    });

    roadmap.on('load', function() {
      // log("✅ Roadmap tiles loaded");
    });

    roadmap.on('tileerror', function(error) {
      // log("❌ Roadmap tile error: " + JSON.stringify(error));
    });

    const restaurantMarker = L.marker(
      [${restaurantLat}, ${restaurantLng}],
      { icon: icon("${storeIconUri}") }
    ).addTo(map);
    // log("📍 Restaurant marker added");

    let driverMarker = null;
    let routeLine = null;
    let animationFrame = null;
    let routeAnimationFrame = null;
    
    // Store current and target route for smooth transitions
    let currentRoute = [];
    let targetRoute = [];

    window.switchTiles = function(useSat){
      // log("🔄 Switching tiles, useSat: " + useSat);
      const old = window.currentLayer;
      const next = useSat ? satellite : roadmap;
      
      if (old === next) {
        // log("⚠️ Already on " + (useSat ? "satellite" : "roadmap"));
        return;
      }
      
      next.setOpacity(0).addTo(map);

      let opacity = 0;
      const interval = setInterval(() => {
        opacity += 0.1;
        next.setOpacity(opacity);
        old.setOpacity(1 - opacity);
        if (opacity >= 1) {
          clearInterval(interval);
          map.removeLayer(old);
          window.currentLayer = next;
          // log("✅ Switched to " + (useSat ? "satellite" : "roadmap"));
        }
      }, 30);
    };

    // Linear interpolation between two points
    function lerp(start, end, t) {
      return start + (end - start) * t;
    }

    // Interpolate between two route arrays
    function interpolateRoutes(routeA, routeB, progress) {
      const maxLen = Math.max(routeA.length, routeB.length);
      const result = [];

      for (let i = 0; i < maxLen; i++) {
        const pointA = routeA[Math.min(i, routeA.length - 1)];
        const pointB = routeB[Math.min(i, routeB.length - 1)];
        
        result.push([
          lerp(pointA[0], pointB[0], progress),
          lerp(pointA[1], pointB[1], progress)
        ]);
      }

      return result;
    }

    // Smooth route transition
    window.updateRoute = function(newRoute, duration) {
      // log("🛣️ Updating route with " + newRoute.length + " points");
      
      // Cancel any ongoing route animation
      if (routeAnimationFrame) {
        cancelAnimationFrame(routeAnimationFrame);
      }

      // Store the new target route
      targetRoute = newRoute;

      // If no current route, set it directly
      if (!routeLine || currentRoute.length === 0) {
        currentRoute = newRoute;
        if (routeLine) {
          map.removeLayer(routeLine);
        }
        routeLine = L.polyline(newRoute, {
          color: "#000000",
          weight: 5,
          opacity: 0.8
        }).addTo(map);
        // log("✅ Route added (no animation)");
        return;
      }

      const startRoute = currentRoute.slice();
      const startTime = Date.now();

      function animateRoute() {
        const now = Date.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function for smooth movement (ease-out)
        const eased = 1 - Math.pow(1 - progress, 3);

        // Interpolate between routes
        const interpolated = interpolateRoutes(startRoute, targetRoute, eased);
        currentRoute = interpolated;

        // Update the polyline
        if (routeLine) {
          routeLine.setLatLngs(interpolated);
        } else {
          routeLine = L.polyline(interpolated, {
            color: "#000000",
            weight: 5,
            opacity: 0.8
          }).addTo(map);
        }

        if (progress < 1) {
          routeAnimationFrame = requestAnimationFrame(animateRoute);
        } else {
          routeAnimationFrame = null;
          currentRoute = targetRoute;
          // log("✅ Route animation complete");
        }
      }

      animateRoute();
    };

    // Smooth driver location update with map centering
    window.updateDeliveryLocation = function(targetLat, targetLng, duration){
      // log("🚗 Updating driver to: " + targetLat + ", " + targetLng);
      
      if (!driverMarker) {
        // First time - create marker directly at position
        driverMarker = L.marker([targetLat, targetLng], {
          icon: icon("${driverIconUri}")
        }).addTo(map);
        
        // Center map on driver (first time)
        map.setView([targetLat, targetLng], map.getZoom(), {
          animate: true,
          duration: 0.5
        });
        // log("✅ Driver marker created");
        return;
      }

      // Cancel any ongoing animation
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }

      const startLatLng = driverMarker.getLatLng();
      const startLat = startLatLng.lat;
      const startLng = startLatLng.lng;
      const startTime = Date.now();

      function animate() {
        const now = Date.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function for smooth movement (ease-out)
        const eased = 1 - Math.pow(1 - progress, 3);

        const currentLat = startLat + (targetLat - startLat) * eased;
        const currentLng = startLng + (targetLng - startLng) * eased;

        driverMarker.setLatLng([currentLat, currentLng]);
        
        // Smoothly pan map to follow driver
        map.panTo([currentLat, currentLng], {
          animate: true,
          duration: 0.1,
          noMoveStart: true
        });

        if (progress < 1) {
          animationFrame = requestAnimationFrame(animate);
        } else {
          animationFrame = null;
          log("✅ Driver animation complete");
        }
      }

      animate();
    };

    setTimeout(() => {
      map.invalidateSize();
      // log("✅ Map size invalidated");
    }, 100);

    window.ReactNativeWebView.postMessage(
      JSON.stringify({ type: "map_ready" })
    );
    // log("✅ Map ready message sent");
    
  } catch(error) {
    log("❌ ERROR: " + error.toString());
    log("❌ STACK: " + error.stack);
  }
};

window.onerror = function(msg, url, line, col, error) {
  log("❌ Global error: " + msg + " at " + line + ":" + col);
  return false;
};
</script>
</body>
</html>
`;
  }, [restaurantLat, restaurantLng, storeIconUri, driverIconUri]);

  /* ---------------- render ---------------- */

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView
        edges={[]}
        style={{
          flex: 1,
          backgroundColor: colors.backgroundPrimary,
          paddingTop: insets.top,
        }}
      >
        <View className="flex-row justify-between items-center px-4 py-3">
          <Text
            className="text-lg font-bold"
            style={{ color: colors.textPrimary }}
          >
            Live Delivery Map
          </Text>
          <PressableBlock onPress={onClose}>
            <X size={24} color={colors.textPrimary} />
          </PressableBlock>
        </View>

        <View className="flex-row justify-between items-center px-4 py-2">
          <Text style={{ color: colors.textSecondary }}>Satellite view</Text>
          <CustomSwitch
            value={satelliteEnabled}
            onValueChange={setSatelliteEnabled}
          />
        </View>

        {showWebView && (
          <WebView
            ref={webViewRef}
            originWhitelist={["*"]}
            mixedContentMode="always"
            allowFileAccess
            allowUniversalAccessFromFileURLs
            source={{
              html: mapHTML,
            }}
            javaScriptEnabled
            domStorageEnabled
            style={{ flex: 1 }}
            onLoadStart={() => {
              // console.log("📱 WebView load started");
              setMapReady(false);
            }}
            onLoadEnd={() => {
              // console.log("📱 WebView load ended");
            }}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              // console.error("❌ WebView error:", nativeEvent);
            }}
            onHttpError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              // console.error("❌ WebView HTTP error:", nativeEvent);
            }}
            onMessage={(e) => {
              try {
                const msg = JSON.parse(e.nativeEvent.data);

                if (msg.type === "log") {
                  // console.log("🌐 [WebView]", msg.message);
                } else if (msg.type === "map_ready") {
                  // console.log("✅ Map is ready!");
                  setMapReady(true);
                }
              } catch (err) {
                console.log("📱 WebView message (raw):", e.nativeEvent.data);
              }
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
