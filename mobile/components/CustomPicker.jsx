import { Check, ChevronDown } from "lucide-react-native";
import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { FlatList, Modal, Text, TouchableOpacity, View } from "react-native";
import { darkColors, lightColors } from "../colors";
import AppTextInput from "./AppTextInput";
import { useTheme } from "../utils/context/theme";

const CustomPicker = forwardRef(
  (
    {
      data,
      value,
      onChange,
      placeholder = "Select an option",
      searchPlaceholder = "Search...",
      containerStyle,
      onItemPress,
      closeOnSelect = true,
    },
    ref,
  ) => {
    const { colorScheme } = useTheme();
    const colors = colorScheme === "dark" ? darkColors : lightColors;

    const [isVisible, setIsVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Track how modal was dismissed
    const userSelectedItemRef = useRef(false);

    // Expose method to open modal from parent
    useImperativeHandle(ref, () => ({
      click: () => setIsVisible(true),
    }));

    const filteredData =
      data?.filter((item) =>
        item?.label?.toLowerCase().includes(searchQuery.toLowerCase()),
      ) || [];

    const selectedItem = data?.find((item) => item.value === value);

    const handleSelect = (item) => {
      userSelectedItemRef.current = true;

      if (onItemPress) {
        onItemPress(item); // 🔊 starts looping sound
      }

      onChange(item);
      setSearchQuery("");

      if (closeOnSelect) {
        setIsVisible(false);
      }
    };

    return (
      <>
        <TouchableOpacity
          className="h-[50px] justify-center rounded-lg border"
          style={[
            {
              backgroundColor: colors.backgroundSecondary,
              borderColor: colors.textSecondary,
            },
            containerStyle,
          ]}
          onPress={() => setIsVisible(true)}
        >
          <View className="flex-row items-center px-2 ml-1">
            {selectedItem?.icon && (
              <View className="mr-2">{selectedItem.icon}</View>
            )}
            <Text
              className="text-sm flex-1"
              style={{
                color: selectedItem ? colors.textPrimary : colors.placeholder,
              }}
            >
              {selectedItem ? selectedItem.label : placeholder}
            </Text>
            <ChevronDown
              size={20}
              color={colors.textSecondary}
              style={{ marginRight: 8 }}
            />
          </View>
        </TouchableOpacity>

        <Modal
          visible={isVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsVisible(false)}
        >
          <TouchableOpacity
            className="flex-1 justify-center items-center p-5"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
            activeOpacity={1}
            onPress={() => setIsVisible(false)}
          >
            <View
              className="rounded-xl w-full overflow-hidden border"
              style={{
                backgroundColor: colors.backgroundPrimary,
                borderColor: colors.backgroundSecondary,
                maxWidth: "90%",
                maxHeight: "60%",
              }}
            >
              {/* Header */}
              <View
                className="flex-row justify-between items-center p-4 border-b"
                style={{ borderBottomColor: colors.backgroundSecondary }}
              >
                <Text
                  className="text-lg font-semibold"
                  style={{ color: colors.textPrimary }}
                >
                  {placeholder}
                </Text>
                <TouchableOpacity onPress={() => setIsVisible(false)}>
                  <Text
                    className="text-2xl font-light"
                    style={{ color: colors.textPrimary }}
                  >
                    ✕
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Search */}
              {searchPlaceholder && (
                <View className="m-3">
                  <AppTextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder={searchPlaceholder}
                    placeholderTextColor={colors.placeholder}
                    inputContainerStyle={{
                      backgroundColor: colors.backgroundSecondary,
                      minHeight: 45,
                    }}
                    inputStyle={{
                      minHeight: 45,
                      fontSize: 14,
                    }}
                  />
                </View>
              )}

              {/* List */}
              <FlatList
                data={filteredData}
                keyExtractor={(item) => item.value}
                stickyHeaderIndices={filteredData
                  .map((item, index) => (item.isHeader ? index : null))
                  .filter((index) => index !== null)}
                renderItem={({ item, index }) => {
                  // Render header items differently
                  if (item.isHeader) {
                    return (
                      <View
                        className="px-4 py-3"
                        style={{
                          backgroundColor: colors.backgroundSecondary,
                        }}
                      >
                        <Text
                          className="text-xs font-bold"
                          style={{
                            color: colors.textSecondary,
                            letterSpacing: 0.5,
                          }}
                        >
                          {item.label}
                        </Text>
                      </View>
                    );
                  }

                  // Render regular items
                  return (
                    <TouchableOpacity
                      className={`p-4 flex-row items-center justify-between ${
                        index < filteredData.length - 1 ? "border-b" : ""
                      }`}
                      style={[
                        index < filteredData.length - 1 && {
                          borderBottomColor: colors.backgroundSecondary,
                        },
                        item.value === value && {
                          backgroundColor: colors.backgroundSecondary,
                        },
                      ]}
                      onPress={() => handleSelect(item)}
                    >
                      <View className="flex-row items-center gap-3 flex-1">
                        {item.icon && <View>{item.icon}</View>}
                        <Text
                          className="text-sm"
                          style={[
                            { color: colors.textPrimary },
                            item.value === value && { fontWeight: "600" },
                          ]}
                        >
                          {item.label}
                        </Text>
                      </View>
                      {item.value === value && (
                        <Check size={18} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <Text
                    className="text-center p-5 text-sm"
                    style={{ color: colors.textSecondary }}
                  >
                    No results found
                  </Text>
                }
              />
            </View>
          </TouchableOpacity>
        </Modal>
      </>
    );
  },
);

CustomPicker.displayName = "CustomPicker";

export default CustomPicker;
