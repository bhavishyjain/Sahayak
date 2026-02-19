import { Dimensions, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function CurvedTabBar({ colors, height = 74 }) {
  const WIDTH = SCREEN_WIDTH * 0.94;
  const HEIGHT = height;
  const CORNER_RADIUS = 18;

  const FAB_RADIUS = 30;
  const CUTOUT_RADIUS = FAB_RADIUS + 8;

  const CUTOUT_CENTER_X = WIDTH / 2;
  const CUTOUT_LEFT_X = CUTOUT_CENTER_X - CUTOUT_RADIUS;
  const CUTOUT_RIGHT_X = CUTOUT_CENTER_X + CUTOUT_RADIUS;

  const d = `
  M${CORNER_RADIUS},${HEIGHT}
  Q0,${HEIGHT} 0,${HEIGHT - CORNER_RADIUS}

  L0,${CORNER_RADIUS}
  Q0,0 ${CORNER_RADIUS},0

  L${CUTOUT_LEFT_X},0
  A${CUTOUT_RADIUS},${CUTOUT_RADIUS} 0 0 0 ${CUTOUT_RIGHT_X},0

  L${WIDTH - CORNER_RADIUS},0
  Q${WIDTH},0 ${WIDTH},${CORNER_RADIUS}

  L${WIDTH},${HEIGHT - CORNER_RADIUS}
  Q${WIDTH},${HEIGHT} ${WIDTH - CORNER_RADIUS},${HEIGHT}

  Z
`;

  return (
    <View style={[styles.container, { width: WIDTH, height: HEIGHT }]}>
      <Svg width={WIDTH} height={HEIGHT} style={StyleSheet.absoluteFill}>
        <Path d={d} fill={colors.backgroundSecondary} fillOpacity={0.93} />
        <Path d={d} fill="none" stroke={colors.border} strokeOpacity={0.55} strokeWidth={1.2} />
      </Svg>
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: CORNER_RADIUS,
            backgroundColor: "rgba(255,255,255,0.04)",
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    alignSelf: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
  },
});
