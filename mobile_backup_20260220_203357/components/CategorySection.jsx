import CachedImage from "expo-cached-image";
import { useRouter } from "expo-router";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import AutoSkeleton from "./AutoSkeleton";
import CustomSwitch from "./dkpg/CustomSwitch";

const CategorySection = React.memo(
  function CategorySection({
    category,
    items,
    colors,
    onToggleItemStatus,
    togglingItemId,
    loading,
  }) {
    const router = useRouter();
    const [isCollapsed, setIsCollapsed] = useState(false);

    if (!items || items.length === 0) return null;

    return (
      <View style={{ marginBottom: 16, paddingHorizontal: 20 }}>
        {/* Category Card with Items */}
        <View
          style={{
            backgroundColor: colors.backgroundSecondary,
            borderRadius: 16,
            padding: 20,
          }}
        >
          {/* Category Header */}
          <AutoSkeleton isLoading={loading}>
            <Pressable
              onPress={() => setIsCollapsed(!isCollapsed)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: isCollapsed ? 0 : 16,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "bold",
                  color: colors.textPrimary,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {category.name}
              </Text>
              {isCollapsed ? (
                <ChevronDown
                  size={24}
                  color={colors.textPrimary}
                  strokeWidth={2.5}
                />
              ) : (
                <ChevronUp
                  size={24}
                  color={colors.textPrimary}
                  strokeWidth={2.5}
                />
              )}
            </Pressable>
          </AutoSkeleton>

          {/* Category Items */}
          {!isCollapsed &&
            items.map((item, index) => (
              <View key={item.id}>
                <AutoSkeleton isLoading={loading}>
                  <Pressable
                    onPress={() => router.push(`/menu/items/${item.id}`)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 12,
                    }}
                  >
                    {/* Item Image */}
                    {item.image ? (
                      <CachedImage
                        source={{ uri: encodeURI(item.image.trim()) }}
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: 40,
                          backgroundColor: colors.backgroundPrimary,
                          marginRight: 16,
                        }}
                        resizeMode="cover"
                        cacheKey={`menu-item-${item.id}`}
                      />
                    ) : (
                      <View
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: 40,
                          backgroundColor: colors.backgroundPrimary,
                          marginRight: 16,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{ color: colors.textSecondary, fontSize: 10 }}
                        >
                          No Image
                        </Text>
                      </View>
                    )}

                    {/* Item Details */}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 17,
                          fontWeight: "600",
                          color: colors.textPrimary,
                          marginBottom: 6,
                        }}
                        numberOfLines={2}
                      >
                        {item.name}
                      </Text>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "500",
                          color: colors.textPrimary,
                        }}
                      >
                        ฿{item.price}
                      </Text>
                    </View>

                    {/* Toggle Switch */}
                    <CustomSwitch
                      value={item.is_active}
                      onValueChange={() =>
                        onToggleItemStatus(item.id, item.is_active)
                      }
                      disabled={togglingItemId === item.id}
                      loading={togglingItemId === item.id}
                    />
                  </Pressable>
                </AutoSkeleton>

                {/* Divider between items */}
                {index < items.length - 1 && (
                  <View
                    style={{
                      height: 1,
                      backgroundColor: colors.textSecondary + "20",
                      marginVertical: 12,
                    }}
                  />
                )}
              </View>
            ))}
        </View>
      </View>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function for React.memo
    return (
      prevProps.category.id === nextProps.category.id &&
      prevProps.items === nextProps.items &&
      prevProps.colors === nextProps.colors &&
      prevProps.togglingItemId === nextProps.togglingItemId
    );
  },
);

export default CategorySection;
