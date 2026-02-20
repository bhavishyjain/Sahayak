import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { Image } from "expo-image";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../app/(app)/colors";
import { GET_PRESIGNED_UPLOAD_URL } from "../url";
import apiCall from "../utils/api";
import { useTheme } from "../utils/context/theme";

export default function ImageUploadBox({
  label,
  orderId,
  type, // "order_bill" | "order_item"
  token,
  onUploaded, // (url: string) => void
}) {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [remoteUrl, setRemoteUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  // ✅ unique storage key for each image
  const storageKey = `order_delivery_upload:${orderId}:${type}`;

  // ✅ load from AsyncStorage on mount
  useEffect(() => {
    const loadSavedUrl = async () => {
      try {
        const saved = await AsyncStorage.getItem(storageKey);
        if (saved) {
          setRemoteUrl(saved);
          onUploaded?.(saved);
        }
      } catch (e) {
        console.log("Failed to load saved upload url", e);
      }
    };

    loadSavedUrl();
  }, [storageKey]);

  const saveUrl = async (url) => {
    try {
      await AsyncStorage.setItem(storageKey, url);
    } catch (e) {
      console.log("Failed to save upload url", e);
    }
  };

  const pickAndUpload = async (fromCamera = false) => {
    try {
      setLoading(true);

      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!perm.granted) {
        Toast.show({ type: "error", text1: "Permission denied" });
        return;
      }

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({
            quality: 1,
            exif: false,
            allowsEditing: true,
            aspect: [1, 1],
            presentationStyle:
              ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
            cameraType: "back",
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 1,
            allowsEditing: true,
            aspect: [1, 1],
          });

      if (result.canceled) return;

      const image = result.assets[0];

      // compress
      const processed = await ImageManipulator.manipulateAsync(
        image.uri,
        [{ resize: { width: 1000 } }],
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.WEBP,
        },
      );

      // get presigned url
      const presign = await apiCall({
        method: "POST",
        url: GET_PRESIGNED_UPLOAD_URL,
        data: {
          folder: `order_delivery/${orderId}`,
          extension: "webp",
          type,
          token,
        },
      });

      const uploadUrl = presign.data.upload_url;
      const publicUrl = presign.data.public_url;

      // upload
      const uploadRes = await FileSystem.uploadAsync(uploadUrl, processed.uri, {
        httpMethod: "PUT",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          "Content-Type": "image/webp",
        },
      });

      if (uploadRes.status !== 200) {
        throw new Error("Image Upload failed, try again");
      }

      // success
      setRemoteUrl(publicUrl);
      onUploaded(publicUrl);

      // ✅ save to AsyncStorage so it persists across navigation
      await saveUrl(publicUrl);

      Toast.show({
        type: "success",
        text1: `${label} uploaded`,
      });
    } catch (e) {
      console.error(e);
      Toast.show({
        type: "error",
        text1: "Image upload failed",
      });
    } finally {
      setLoading(false);
    }
  };

  const showOptions = () => {
    if (remoteUrl) {
      Alert.alert("Re-upload Image?", "This will replace the existing image.", [
        { text: "Camera", onPress: () => pickAndUpload(true) },
        { text: "Gallery", onPress: () => pickAndUpload(false) },
        { text: "Cancel", style: "cancel" },
      ]);
      return;
    }

    Alert.alert("Upload Image", "Choose an option", [
      { text: "Camera", onPress: () => pickAndUpload(true) },
      { text: "Gallery", onPress: () => pickAndUpload(false) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ color: colors.textPrimary, marginBottom: 6 }}>
        {label}
      </Text>

      <TouchableOpacity
        onPress={showOptions}
        style={{
          width: 120,
          height: 120,
          borderWidth: 2,
          borderStyle: "dashed",
          borderColor: colors.muted,
          borderRadius: 12,
          justifyContent: "center",
          alignItems: "center",
          overflow: "hidden",
          backgroundColor: colors.backgroundSecondary,
        }}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : remoteUrl ? (
          <Image
            source={remoteUrl}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
        ) : (
          <Text style={{ fontSize: 32, color: colors.textSecondary }}>+</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
