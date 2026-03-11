import { Dimensions, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import PressableBlock from "./PressableBlock";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function CurvedTabBar({ colors, height = 72 }) {
  const WIDTH = SCREEN_WIDTH * 0.95;
  const HEIGHT = height;
  const CORNER_RADIUS = 20;

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
      <PressableBlock onPress={() => {
        //do nothing
      }}>
        <Svg width={WIDTH} height={HEIGHT} style={StyleSheet.absoluteFill}>
          <Path d={d} fill={colors.backgroundSecondary} fillOpacity={0.95} />
        </Svg>
      </PressableBlock>
      {/* Blur effect overlay - optional */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: "transparent",
            opacity: 0.0,
            borderRadius: CORNER_RADIUS,
          },
        ]}
      />
    </View>

  );
}

export function useTabBarHeight() {
  const insets = useSafeAreaInsets();

  const TAB_BAR_HEIGHT = 72; // Must match the height in _layout.jsx
  const TAB_BAR_BOTTOM_MARGIN = 16; // Must match the bottom value in tabBarStyle

  // On Android with gesture navigation, we need the bottom inset
  // On iOS, we always need it
  // On Android with button navigation, insets.bottom will be 0
  const needsBottomInset = Platform.OS === 'ios' || insets.bottom > 0;

  const totalHeight = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_MARGIN + (needsBottomInset ? insets.bottom : 0);

  return totalHeight;
}


const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    alignSelf: "center",
  },
});
