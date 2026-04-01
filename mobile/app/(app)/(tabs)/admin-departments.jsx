import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Plus } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import DialogBox from "../../../components/DialogBox";
import PressableBlock from "../../../components/PressableBlock";
import apiCall from "../../../utils/api";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import useDepartments from "../../../utils/hooks/useDepartments";
import { DEPARTMENTS_URL, REPORT_DEPARTMENT_BREAKDOWN_URL } from "../../../url";

export default function AdminDepartmentsTab() {
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const queryClient = useQueryClient();
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const {
    departments,
    isLoading,
    isRefetching,
    refetch,
    error,
  } = useDepartments({ includeInactive: true });
  const { data: breakdownData } = useQuery({
    queryKey: ["admin-department-breakdown"],
    queryFn: async () => {
      const response = await apiCall({
        method: "GET",
        url: REPORT_DEPARTMENT_BREAKDOWN_URL,
      });
      return response?.data?.breakdown || response?.data?.summary || response?.data || {};
    },
  });

  const createDepartmentMutation = useMutation({
    mutationFn: async () =>
      apiCall({
        method: "POST",
        url: DEPARTMENTS_URL,
        data: { name: newDepartmentName.trim() },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard-home"] });
      setShowAddDialog(false);
      setNewDepartmentName("");
      Toast.show({
        type: "success",
        text1: t("adminScreens.departments.toasts.addedTitle"),
        text2: t("adminScreens.departments.toasts.addedMessage"),
      });
    },
    onError: (mutationError) => {
      Toast.show({
        type: "error",
        text1: t("adminScreens.departments.toasts.addFailedTitle"),
        text2:
          mutationError?.response?.data?.message ||
          t("adminScreens.departments.toasts.addFailedMessage"),
      });
    },
  });

  useEffect(() => {
    if (!error) return;
    Toast.show({
      type: "error",
      text1: t("adminScreens.departments.toasts.loadFailedTitle"),
      text2:
        error?.response?.data?.message ||
        t("adminScreens.departments.toasts.loadFailedMessage"),
    });
  }, [error, t]);

  const handleAddDepartment = () => {
    if (!newDepartmentName.trim()) {
      Toast.show({
        type: "error",
        text1: t("adminScreens.departments.toasts.nameRequiredTitle"),
        text2: t("adminScreens.departments.toasts.nameRequiredMessage"),
      });
      return;
    }
    createDepartmentMutation.mutate();
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.backgroundPrimary }}>
      <BackButtonHeader
        title={t("adminScreens.departments.title")}
        hasBackButton={false}
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <PressableBlock
          onPress={() => setShowAddDialog(true)}
          className="rounded-2xl py-4 px-4 mb-4"
          style={{
            backgroundColor: colors.backgroundSecondary,
            borderColor: colors.border,
            borderWidth: 1,
          }}
        >
          <View className="flex-row items-center justify-center">
            <Plus size={18} color={colors.primary} />
            <Text
              className="text-sm font-semibold ml-2"
              style={{ color: colors.primary }}
            >
              {t("adminScreens.departments.addButton")}
            </Text>
          </View>
        </PressableBlock>

        {isLoading ? (
          <View className="py-8 items-center">
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (
          departments.map((department) => (
            <PressableBlock
              key={department.id}
              onPress={() =>
                router.push(
                  `/(app)/admin/department-details?department=${encodeURIComponent(department.name)}`,
                )
              }
              className="px-4 py-4 mb-3 rounded-2xl"
              style={{
                backgroundColor: colors.backgroundSecondary,
                borderColor: colors.border,
                borderWidth: 1,
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text
                    className="text-base font-semibold"
                    style={{ color: colors.textPrimary }}
                  >
                    {department.name}
                  </Text>
                  <Text
                    className="text-xs mt-1"
                    style={{ color: colors.textSecondary }}
                  >
                    {t("adminScreens.departments.rowSummary", {
                      total: Number(breakdownData?.[department.name]?.total ?? 0),
                      pending: Number(
                        breakdownData?.[department.name]?.pending ?? 0,
                      ),
                    })}
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <View
                    className="w-2.5 h-2.5 rounded-full mr-2"
                    style={{
                      backgroundColor: department.isActive
                        ? colors.success
                        : colors.danger,
                    }}
                  />
                  <Text
                    className="text-xs font-semibold"
                    style={{
                      color: department.isActive
                        ? colors.success
                        : colors.danger,
                    }}
                  >
                    {department.isActive
                      ? t("adminScreens.departments.active")
                      : t("adminScreens.departments.inactive")}
                  </Text>
                </View>
              </View>
            </PressableBlock>
          ))
        )}
      </ScrollView>

      <DialogBox
        visible={showAddDialog}
        onClose={() => {
          setShowAddDialog(false);
          setNewDepartmentName("");
        }}
        title={t("adminScreens.departments.dialog.title")}
        message={t("adminScreens.departments.dialog.message")}
        showInput={true}
        inputPlaceholder={t("adminScreens.departments.dialog.placeholder")}
        inputValue={newDepartmentName}
        onInputChange={setNewDepartmentName}
        confirmText={t("adminScreens.departments.dialog.confirm")}
        onConfirm={handleAddDepartment}
        onCancel={() => {
          setShowAddDialog(false);
          setNewDepartmentName("");
        }}
        loading={createDepartmentMutation.isPending}
      />
    </View>
  );
}
