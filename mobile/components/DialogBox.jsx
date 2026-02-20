import { useRef } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import { TextInput as PaperTextInput } from "react-native-paper";
import { darkColors, lightColors } from "../app/(app)/colors";
import { useTheme } from "../utils/context/theme";
import PressableBlock from "./PressableBlock";

export default function DialogBox({
  visible,
  onClose,
  title,
  message,
  showInput = false,
  inputPlaceholder = "",
  inputKeyboardType = "default",
  inputValue = "",
  onInputChange,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  loading = false,
  // Custom styling props
  titleStyle,
  messageStyle,
  containerStyle,
  confirmButtonStyle,
  cancelButtonStyle,
  confirmTextStyle,
  cancelTextStyle,
  titleAlign = "left",
  messageAlign = "left",
  orderCode = null,
  otp = false,
  otpValue = null,
  setOTPValueFunction,
  otpLength = 5,
  showActionButton = true,
}) {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const inputRefs = useRef([]);
  const otpArray = Array.isArray(otpValue)
    ? otpValue
    : Array(otpLength).fill("");

  const handleOtpChange = (value, index) => {
    if (!/^\d*$/.test(value)) return;

    const digit = value.slice(-1);
    const newOtp = [...otpArray];
    newOtp[index] = digit;

    setOTPValueFunction(newOtp);

    if (digit && index < otpLength - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === "Backspace" && !otpArray[index] && index > 0) {
      const newOtp = [...otpArray];
      newOtp[index - 1] = "";
      setOTPValueFunction(newOtp);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleConfirm = () => {
    onConfirm(showInput ? inputValue : null);
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
  };

  const handleClose = () => {
    if (onClose) onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose ? handleClose : handleCancel}
      statusBarTranslucent={false}
    >
      <Pressable
        onPress={onClose ? handleClose : handleCancel}
        style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
        className="flex-1 justify-center px-4"
      >
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View
            style={[
              { backgroundColor: colors.backgroundSecondary },
              containerStyle,
            ]}
            className="rounded-2xl p-6"
          >
            {/* Title */}
            {title !== null && title !== undefined ? (
              typeof title === "string" || typeof title === "number" ? (
                <Text
                  className="text-xl font-fira-bold mb-4"
                  style={[
                    { textAlign: titleAlign, color: colors.textPrimary },
                    titleStyle,
                  ]}
                >
                  {String(title)}
                </Text>
              ) : (
                <View
                  style={{
                    marginBottom: 16,
                    alignItems:
                      titleAlign === "center"
                        ? "center"
                        : titleAlign === "right"
                          ? "flex-end"
                          : "flex-start",
                  }}
                >
                  {title}
                </View>
              )
            ) : null}

            {/* Message */}
            {message !== null && message !== undefined ? (
              typeof message === "string" || typeof message === "number" ? (
                <Text
                  className="text-sm mb-6"
                  style={[
                    { textAlign: messageAlign, color: colors.textSecondary },
                    messageStyle,
                  ]}
                >
                  {String(message)}
                </Text>
              ) : (
                <View
                  style={{
                    marginBottom: 16,
                    alignItems:
                      messageAlign === "center"
                        ? "center"
                        : messageAlign === "right"
                          ? "flex-end"
                          : "flex-start",
                  }}
                >
                  {message}
                </View>
              )
            ) : null}

            {/* OTP Input */}
            {otp && (
              <View
                className="flex-row justify-center mb-8 w-full px-5"
                style={{ gap: 8 }}
              >
                {otpArray.map((digit, i) => (
                  <View
                    key={i}
                    style={{
                      backgroundColor: colors.backgroundPrimary,
                      width: 50,
                      height: 50,
                      justifyContent: "center",
                      alignItems: "center",
                      borderRadius: 8,
                    }}
                  >
                    <PaperTextInput
                      mode="flat"
                      ref={(ref) => (inputRefs.current[i] = ref)}
                      value={digit}
                      onChangeText={(value) => handleOtpChange(value, i)}
                      onKeyPress={(e) => handleKeyPress(e, i)}
                      keyboardType="number-pad"
                      maxLength={1}
                      selectTextOnFocus
                      style={{
                        width: 50,
                        height: 50,
                        backgroundColor: "transparent",
                        textAlign: "center",
                      }}
                      underlineStyle={{ display: "none" }}
                      contentStyle={{
                        textAlign: "center",
                        color: colors.textPrimary,
                        fontSize: 24,
                        fontWeight: "bold",
                        paddingLeft: 0,
                        paddingRight: 0,
                        paddingTop: 0,
                        paddingBottom: 0,
                        marginLeft: -8,
                      }}
                      theme={{
                        colors: {
                          primary: "transparent",
                          text: colors.textPrimary,
                        },
                      }}
                    />
                  </View>
                ))}
              </View>
            )}

            {/* Order Code Display */}
            {orderCode && (
              <View
                style={{
                  backgroundColor: colors.backgroundPrimary,
                  marginBottom: 24,
                  paddingVertical: 20,
                  borderRadius: 12,
                }}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 32,
                    fontWeight: "bold",
                    textAlign: "center",
                    letterSpacing: 2,
                  }}
                >
                  #{orderCode}
                </Text>
              </View>
            )}

            {/* Input Field */}
            {showInput && (
              <PaperTextInput
                value={inputValue}
                onChangeText={onInputChange}
                placeholder={inputPlaceholder}
                keyboardType={inputKeyboardType}
                mode="outlined"
                outlineColor={colors.muted}
                activeOutlineColor={colors.primary}
                textColor={colors.textPrimary}
                placeholderTextColor={colors.textSecondary}
                style={{
                  backgroundColor: colors.backgroundPrimary,
                  marginBottom: 24,
                }}
                theme={{ roundness: 12 }}
              />
            )}

            {/* Action Buttons */}
            {showActionButton && (
              <View className="flex-row gap-3">
                <PressableBlock
                  onPress={handleCancel}
                  disabled={loading}
                  className="flex-1 rounded-xl py-4"
                  style={[
                    {
                      opacity: loading ? 0.7 : 1,
                      backgroundColor:
                        colorScheme === "dark"
                          ? colors.light
                          : colors.backgroundSecondary,
                      borderWidth: 1,
                      borderColor: colors.muted,
                    },
                    cancelButtonStyle,
                  ]}
                >
                  <Text
                    className="text-center text-base font-bold"
                    style={[
                      {
                        color:
                          colorScheme === "dark"
                            ? colors.dark
                            : colors.textPrimary,
                      },
                      cancelTextStyle,
                    ]}
                  >
                    {cancelText}
                  </Text>
                </PressableBlock>

                <PressableBlock
                  onPress={handleConfirm}
                  disabled={loading}
                  className="flex-1 rounded-xl py-4"
                  style={[
                    {
                      opacity: loading ? 0.7 : 1,
                      backgroundColor: colors.primary,
                    },
                    confirmButtonStyle,
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.dark} size="small" />
                  ) : (
                    <Text
                      className="text-center text-base font-bold"
                      style={[{ color: colors.dark }, confirmTextStyle]}
                    >
                      {confirmText}
                    </Text>
                  )}
                </PressableBlock>
              </View>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
