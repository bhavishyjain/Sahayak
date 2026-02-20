import { CheckCircle, Printer, X } from "lucide-react-native";
import { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { InvoiceImage } from "../utils/printer/components/InvoiceImage";
import { KOTImage } from "../utils/printer/components/KOTImage";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function PrintPreviewScreen({
  visible,
  type = "invoice", // 'invoice' or 'kot'
  order,
  paperWidth = "58",
  colors,
  onPrint,
  onClose,
  t = (key) => key, // Translation function
  isPrinting = false,
  printSuccess = false,
}) {
  const paperSlideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const paperOpacityAnim = useRef(new Animated.Value(0)).current;
  const paperCutUpAnim = useRef(new Animated.Value(0)).current; // Slides content up
  const successScaleAnim = useRef(new Animated.Value(0)).current;
  const successOpacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Slide up and fade in the paper
      Animated.parallel([
        Animated.spring(paperSlideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 9,
          delay: 100,
        }),
        Animated.timing(paperOpacityAnim, {
          toValue: 1,
          duration: 300,
          delay: 100,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset animations
      paperSlideAnim.setValue(SCREEN_HEIGHT);
      paperOpacityAnim.setValue(0);
      paperCutUpAnim.setValue(0);
      successScaleAnim.setValue(0);
      successOpacityAnim.setValue(0);
    }
  }, [visible]);

  useEffect(() => {
    if (isPrinting) {
      // Pull the paper upward (cut from bottom)
      Animated.parallel([
        Animated.timing(paperCutUpAnim, {
          toValue: -1000, // Move content up by 1000px
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(paperOpacityAnim, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isPrinting]);

  useEffect(() => {
    if (printSuccess) {
      // Show success animation
      Animated.sequence([
        Animated.delay(300),
        Animated.parallel([
          Animated.spring(successScaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 50,
            friction: 6,
          }),
          Animated.timing(successOpacityAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
  }, [printSuccess]);

  // Safety check: ensure order has required properties
  if (!order || !order.items || !Array.isArray(order.items)) {
    console.error("Invalid order data for print preview:", order);
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView
        className="flex-1"
        edges={Platform.OS === "ios" ? ["top"] : ["bottom"]}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: colors.backgroundPrimary,
          }}
        >
          <StatusBar
            barStyle={
              colors.textPrimary === "#FFFFFF"
                ? "light-content"
                : "dark-content"
            }
            backgroundColor={colors.backgroundPrimary}
          />

          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 20,
              paddingTop: StatusBar.currentHeight
                ? StatusBar.currentHeight + 16
                : 50,
              paddingBottom: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 22,
                fontWeight: "700",
                color: colors.textPrimary,
              }}
            >
              {type === "invoice"
                ? t("order.print.previewInvoice") || "Preview Invoice"
                : t("order.print.previewKOT") || "Preview KOT"}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.backgroundSecondary,
                justifyContent: "center",
                alignItems: "center",
              }}
              activeOpacity={0.7}
              disabled={isPrinting}
            >
              <X size={22} color={colors.textPrimary} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          {/* Scrollable Preview Area */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingVertical: 30,
              paddingHorizontal: 20,
              alignItems: "center",
            }}
            showsVerticalScrollIndicator={true}
          >
            {/* Paper Width Info */}
            <View
              style={{
                backgroundColor: colors.backgroundSecondary,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 10,
                marginBottom: 24,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textSecondary,
                  fontWeight: "600",
                }}
              >
                📄 {paperWidth}mm {t("order.print.paper") || "Paper"}
              </Text>
            </View>

            {/* Animated Receipt Paper - Outer container clips from bottom */}
            <Animated.View
              style={{
                transform: [{ translateY: paperSlideAnim }],
                opacity: paperOpacityAnim,
                overflow: "hidden", // Clips the paper as it moves up
                backgroundColor: "#fff",
                borderRadius: 16,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.2,
                shadowRadius: 20,
                elevation: 12,
                marginBottom: 40,
              }}
            >
              {/* Inner content that slides upward */}
              <Animated.View
                style={{
                  transform: [{ translateY: paperCutUpAnim }],
                }}
              >
                {type === "invoice" ? (
                  <InvoiceImage order={order} paperWidth={paperWidth} />
                ) : (
                  <KOTImage order={order} paperWidth={paperWidth} />
                )}
              </Animated.View>
            </Animated.View>
          </ScrollView>

          {/* Action Buttons - Fixed at Bottom */}
          <View
            style={{
              flexDirection: "row",
              gap: 12,
              paddingHorizontal: 20,
              paddingVertical: 20,
              paddingBottom: 30,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.backgroundPrimary,
            }}
          >
            <TouchableOpacity
              onPress={onClose}
              disabled={isPrinting}
              style={{
                flex: 1,
                paddingVertical: 18,
                borderRadius: 14,
                backgroundColor: colors.backgroundSecondary,
                alignItems: "center",
                justifyContent: "center",
                opacity: isPrinting ? 0.5 : 1,
              }}
              activeOpacity={0.7}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: colors.textPrimary,
                }}
              >
                {t("order.print.cancel") || "Cancel"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onPrint}
              disabled={isPrinting}
              style={{
                flex: 1,
                paddingVertical: 18,
                borderRadius: 14,
                backgroundColor: isPrinting
                  ? colors.textSecondary
                  : colors.primary,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 10,
              }}
              activeOpacity={0.7}
            >
              <Printer size={22} color={colors.dark} strokeWidth={2.5} />
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "700",
                  color: colors.dark,
                }}
              >
                {isPrinting
                  ? t("order.print.printingButton") || "Printing..."
                  : t("order.print.printButton") || "Print"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Success Overlay */}
          {printSuccess && (
            <Animated.View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0, 0, 0, 0.85)",
                justifyContent: "center",
                alignItems: "center",
                opacity: successOpacityAnim,
              }}
            >
              <Animated.View
                style={{
                  alignItems: "center",
                  transform: [{ scale: successScaleAnim }],
                }}
              >
                <View
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 50,
                    backgroundColor: colors.success,
                    justifyContent: "center",
                    alignItems: "center",
                    marginBottom: 24,
                    shadowColor: colors.success,
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.4,
                    shadowRadius: 20,
                    elevation: 12,
                  }}
                >
                  <CheckCircle size={60} color="#FFFFFF" strokeWidth={2.5} />
                </View>

                <Text
                  style={{
                    fontSize: 28,
                    fontWeight: "700",
                    color: "#FFFFFF",
                    marginBottom: 12,
                    textAlign: "center",
                  }}
                >
                  {t("order.print.success") || "Success"}
                </Text>

                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "500",
                    color: "rgba(255, 255, 255, 0.8)",
                    textAlign: "center",
                    paddingHorizontal: 40,
                  }}
                >
                  {type === "invoice"
                    ? t("order.print.invoicePrinted") ||
                      "Invoice printed successfully!"
                    : t("order.print.kotPrinted") ||
                      "KOT printed successfully!"}
                </Text>

                <TouchableOpacity
                  onPress={onClose}
                  style={{
                    marginTop: 32,
                    paddingHorizontal: 32,
                    paddingVertical: 14,
                    borderRadius: 12,
                    backgroundColor: "rgba(255, 255, 255, 0.2)",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.3)",
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#FFFFFF",
                    }}
                  >
                    {t("order.print.done") || "Done"}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
