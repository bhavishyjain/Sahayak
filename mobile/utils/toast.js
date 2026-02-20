import Toast from "react-native-toast-message";

export function showToast({ type = "info", title, message }) {
  const resolvedType = type === "warning" ? "info" : type;
  Toast.show({
    type: resolvedType,
    text1: title,
    text2: message,
  });
}
