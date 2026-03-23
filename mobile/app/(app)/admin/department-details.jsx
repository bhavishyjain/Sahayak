import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  ChevronDown,
  ChevronRight,
  Shield,
  Users,
} from "lucide-react-native";
import Toast from "react-native-toast-message";
import { useEffect, useMemo, useState } from "react";
import BackButtonHeader from "../../../components/BackButtonHeader";
import DialogBox from "../../../components/DialogBox";
import PressableBlock from "../../../components/PressableBlock";
import { darkColors, lightColors } from "../../../colors";
import apiCall from "../../../utils/api";
import { useTheme } from "../../../utils/context/theme";
import {
  REPORT_DEPARTMENT_BREAKDOWN_URL,
  DEACTIVATE_DEPARTMENT_URL,
  DEPARTMENT_DETAIL_URL,
  USER_DETAIL_URL,
  USERS_URL,
} from "../../../url";
import useDepartments from "../../../utils/hooks/useDepartments";

function MetricCard({ label, value, colors, tone }) {
  return (
    <View
      className="flex-1 rounded-2xl p-4"
      style={{
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text className="text-xs" style={{ color: colors.textSecondary }}>
        {label}
      </Text>
      <Text
        className="text-2xl font-bold mt-2"
        style={{ color: tone || colors.textPrimary }}
      >
        {value}
      </Text>
    </View>
  );
}

function MemberRow({ member, roleLabel, colors, onToggle, onPress }) {
  const active = member?.isActive !== false;

  return (
    <PressableBlock
      onPress={onPress}
      className="rounded-xl p-4 mb-3"
      style={{
        backgroundColor: colors.backgroundPrimary,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
            {member?.fullName || member?.username}
          </Text>
          <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
            {roleLabel}
          </Text>
          <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
            @{member?.username}
          </Text>
          <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
            {member?.email || "No email"} • {member?.phone || "No phone"}
          </Text>
        </View>
        <View
          className="px-2.5 py-1 rounded-full"
          style={{
            backgroundColor: (active ? colors.success : colors.danger) + "18",
          }}
        >
          <Text
            className="text-[11px] font-semibold"
            style={{ color: active ? colors.success : colors.danger }}
          >
            {active ? "Active" : "Inactive"}
          </Text>
        </View>
      </View>

      <PressableBlock
        onPress={onToggle}
        className="rounded-xl py-3 items-center mt-4"
        style={{
          backgroundColor: active ? colors.danger + "18" : colors.success + "18",
        }}
      >
        <Text
          className="text-sm font-semibold"
          style={{ color: active ? colors.danger : colors.success }}
        >
          {active ? "Deactivate" : "Reactivate"}
        </Text>
      </PressableBlock>
    </PressableBlock>
  );
}

function DropdownSection({
  title,
  count,
  icon: Icon,
  tone,
  open,
  onToggle,
  children,
  colors,
}) {
  return (
    <View
      className="rounded-2xl p-4 mb-4"
      style={{
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <PressableBlock onPress={onToggle}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 pr-3">
            <View
              className="w-11 h-11 rounded-2xl items-center justify-center mr-3"
              style={{ backgroundColor: tone + "18" }}
            >
              <Icon size={18} color={tone} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>
                {title}
              </Text>
              <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                {count} {count === 1 ? "member" : "members"}
              </Text>
            </View>
          </View>
          {open ? (
            <ChevronDown size={18} color={colors.textSecondary} />
          ) : (
            <ChevronRight size={18} color={colors.textSecondary} />
          )}
        </View>
      </PressableBlock>

      {open ? <View className="mt-4">{children}</View> : null}
    </View>
  );
}

export default function DepartmentDetailsScreen() {
  const { department } = useLocalSearchParams();
  const departmentName =
    typeof department === "string" && department.trim()
      ? department.trim()
      : "Unknown";
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const queryClient = useQueryClient();
  const [confirmState, setConfirmState] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [hodOpen, setHodOpen] = useState(false);
  const [workersOpen, setWorkersOpen] = useState(false);
  const { departments } = useDepartments({ includeInactive: true });
  const departmentRecord = useMemo(
    () => departments.find((item) => item.name === departmentName) ?? null,
    [departments, departmentName],
  );

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ["admin-department-detail", departmentName, departmentRecord?.id],
    enabled: Boolean(departmentName),
    queryFn: async () => {
      const [usersRes, breakdownRes] = await Promise.all([
        apiCall({
          method: "GET",
          url: `${USERS_URL}?includeStats=true&department=${encodeURIComponent(
            departmentName,
          )}`,
        }),
        apiCall({
          method: "GET",
          url: REPORT_DEPARTMENT_BREAKDOWN_URL,
        }),
      ]);

      const users = usersRes?.data ?? [];
      const breakdownPayload = breakdownRes?.data ?? {};
      const analytics =
        breakdownPayload?.[departmentName] ||
        breakdownPayload?.breakdown?.[departmentName] ||
        breakdownPayload?.summary?.[departmentName] ||
        {};

      return {
        analytics,
        heads: users.filter((item) => item.role === "head"),
        workers: users.filter((item) => item.role === "worker"),
      };
    },
  });

  useEffect(() => {
    if (!error) return;
    Toast.show({
      type: "error",
      text1: "Could not load department",
      text2: error?.response?.data?.message || "Please try again.",
    });
  }, [error]);

  const invalidateAdminQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-dashboard-home"] });
    queryClient.invalidateQueries({ queryKey: ["departments"] });
    queryClient.invalidateQueries({ queryKey: ["admin-departments"] });
    queryClient.invalidateQueries({
      queryKey: ["admin-department-detail", departmentName],
    });
  };

  const updateMemberMutation = useMutation({
    mutationFn: async ({ user, isActive }) =>
      apiCall({
        method: "PUT",
        url: USER_DETAIL_URL(user._id),
        data: {
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          department: user.department,
          isActive,
        },
      }),
    onSuccess: () => {
      invalidateAdminQueries();
      setConfirmState(null);
      Toast.show({
        type: "success",
        text1: "Member updated",
        text2: "Department data has been refreshed.",
      });
    },
    onError: (mutationError) => {
      Toast.show({
        type: "error",
        text1: "Could not update member",
        text2: mutationError?.response?.data?.message || "Please try again.",
      });
    },
  });

  const deactivateDepartmentMutation = useMutation({
    mutationFn: async () => {
      if (!departmentRecord?.id) {
        throw new Error("Department not found");
      }
      return apiCall({
        method: "POST",
        url: DEACTIVATE_DEPARTMENT_URL(departmentRecord.id),
      });
    },
    onSuccess: () => {
      invalidateAdminQueries();
      setConfirmState(null);
      Toast.show({
        type: "success",
        text1: "Department deactivated",
        text2: "HOD and workers in this department are now inactive.",
      });
    },
    onError: (mutationError) => {
      Toast.show({
        type: "error",
        text1: "Could not deactivate department",
        text2: mutationError?.response?.data?.message || "Please try again.",
      });
    },
  });

  const renameDepartmentMutation = useMutation({
    mutationFn: async () => {
      if (!departmentRecord?.id) {
        throw new Error("Department not found");
      }
      return apiCall({
        method: "PUT",
        url: DEPARTMENT_DETAIL_URL(departmentRecord.id),
        data: { name: renameValue.trim() },
      });
    },
    onSuccess: (response) => {
      const nextDepartmentName =
        response?.data?.name || response?.rawData?.department?.name || renameValue.trim();
      invalidateAdminQueries();
      setConfirmState(null);
      setRenameValue("");
      Toast.show({
        type: "success",
        text1: "Department updated",
        text2: "The department name has been changed.",
      });
      router.replace(
        `/(app)/admin/department-details?department=${encodeURIComponent(nextDepartmentName)}`,
      );
    },
    onError: (mutationError) => {
      Toast.show({
        type: "error",
        text1: "Could not update department",
        text2: mutationError?.response?.data?.message || "Please try again.",
      });
    },
  });

  const deleteDepartmentMutation = useMutation({
    mutationFn: async () => {
      if (!departmentRecord?.id) {
        throw new Error("Department not found");
      }
      return apiCall({
        method: "DELETE",
        url: DEPARTMENT_DETAIL_URL(departmentRecord.id),
      });
    },
    onSuccess: () => {
      invalidateAdminQueries();
      setConfirmState(null);
      Toast.show({
        type: "success",
        text1: "Department deleted",
        text2: "Members and complaints were reassigned safely.",
      });
      router.replace("/(app)/(tabs)/admin-departments");
    },
    onError: (mutationError) => {
      Toast.show({
        type: "error",
        text1: "Could not delete department",
        text2: mutationError?.response?.data?.message || "Please try again.",
      });
    },
  });

  const heads = useMemo(() => data?.heads ?? [], [data?.heads]);
  const workers = useMemo(() => data?.workers ?? [], [data?.workers]);
  const analytics = data?.analytics ?? {};

  if (isLoading) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: colors.backgroundPrimary }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.backgroundPrimary }}>
      <BackButtonHeader
        title={`${departmentName} Department`}
        fallbackHref="/(app)/(tabs)/admin-departments"
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
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
        <View className="mb-4" style={{ gap: 10 }}>
          <PressableBlock
            onPress={() => {
              setRenameValue(departmentName);
              setConfirmState({ type: "rename" });
            }}
            className="rounded-2xl py-4 items-center"
            style={{ backgroundColor: colors.primary }}
          >
            <Text className="text-sm font-semibold" style={{ color: colors.dark }}>
              Edit Department Name
            </Text>
          </PressableBlock>

          <PressableBlock
            onPress={() => setConfirmState({ type: "department" })}
            className="rounded-2xl py-4 items-center"
            style={{ backgroundColor: colors.warning }}
          >
            <Text className="text-sm font-semibold" style={{ color: colors.dark }}>
              Deactivate Department
            </Text>
          </PressableBlock>

          <PressableBlock
            onPress={() => setConfirmState({ type: "delete" })}
            className="rounded-2xl py-4 items-center"
            style={{ backgroundColor: colors.danger }}
          >
            <Text className="text-sm font-semibold" style={{ color: colors.light }}>
              Delete Department
            </Text>
          </PressableBlock>
        </View>

        <View className="flex-row mb-3" style={{ gap: 12 }}>
          <MetricCard
            label="Total complaints"
            value={Number(analytics.total ?? 0)}
            tone={colors.textPrimary}
            colors={colors}
          />
          <MetricCard
            label="Pending"
            value={Number(analytics.pending ?? 0)}
            tone={colors.warning}
            colors={colors}
          />
        </View>

        <View className="flex-row mb-4" style={{ gap: 12 }}>
          <MetricCard
            label="In progress"
            value={Number(analytics.inProgress ?? 0)}
            tone={colors.primary}
            colors={colors}
          />
          <MetricCard
            label="Resolved"
            value={Number(analytics.resolved ?? 0)}
            tone={colors.success}
            colors={colors}
          />
        </View>

        <DropdownSection
          title="HOD"
          count={heads.length}
          icon={Shield}
          tone={colors.warning}
          open={hodOpen}
          onToggle={() => setHodOpen((value) => !value)}
          colors={colors}
        >
          {heads.length === 0 ? (
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              No HOD found for this department.
            </Text>
          ) : (
            heads.map((head) => (
              <MemberRow
                key={head._id}
                member={head}
                roleLabel="Department head"
                colors={colors}
                onToggle={() =>
                  setConfirmState({
                    type: "member",
                    member: head,
                    isActive: head.isActive === false,
                  })
                }
              />
            ))
          )}
        </DropdownSection>

        <DropdownSection
          title="Workers"
          count={workers.length}
          icon={Users}
          tone={colors.primary}
          open={workersOpen}
          onToggle={() => setWorkersOpen((value) => !value)}
          colors={colors}
        >
          {workers.length === 0 ? (
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              No workers found for this department.
            </Text>
          ) : (
            workers.map((worker) => (
              <MemberRow
                key={worker._id}
                member={worker}
                roleLabel="Worker"
                colors={colors}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/more/worker-analytics",
                    params: { workerId: worker._id },
                  })
                }
                onToggle={() =>
                  setConfirmState({
                    type: "member",
                    member: worker,
                    isActive: worker.isActive === false,
                  })
                }
              />
            ))
          )}
        </DropdownSection>
      </ScrollView>

      <DialogBox
        visible={Boolean(confirmState)}
        onClose={() => setConfirmState(null)}
        title={
          confirmState?.type === "rename"
            ? "Edit department name"
            : confirmState?.type === "delete"
              ? "Delete department"
            : confirmState?.type === "department"
            ? "Deactivate department"
            : confirmState?.isActive
              ? "Reactivate member"
              : "Deactivate member"
        }
        message={
          confirmState?.type === "rename"
            ? "Update the department name everywhere it is used."
            : confirmState?.type === "delete"
              ? "This will remove the department and move linked users, complaints, and invitations to Other."
            : confirmState?.type === "department"
            ? "This will deactivate the HOD and all workers in this department."
            : confirmState?.isActive
              ? `Reactivate ${confirmState?.member?.fullName || confirmState?.member?.username}?`
              : `Deactivate ${confirmState?.member?.fullName || confirmState?.member?.username}?`
        }
        showInput={confirmState?.type === "rename"}
        inputPlaceholder="Department name"
        inputValue={renameValue}
        onInputChange={setRenameValue}
        confirmText={
          confirmState?.type === "rename"
            ? "Save"
            : confirmState?.type === "delete"
              ? "Delete"
            : confirmState?.type === "department"
            ? "Deactivate"
            : confirmState?.isActive
              ? "Reactivate"
              : "Deactivate"
        }
        onConfirm={() => {
          if (confirmState?.type === "rename") {
            if (!renameValue.trim()) {
              Toast.show({
                type: "error",
                text1: "Department name required",
                text2: "Enter a valid department name.",
              });
              return;
            }
            renameDepartmentMutation.mutate();
            return;
          }
          if (confirmState?.type === "delete") {
            deleteDepartmentMutation.mutate();
            return;
          }
          if (confirmState?.type === "department") {
            deactivateDepartmentMutation.mutate();
            return;
          }
          if (confirmState?.member) {
            updateMemberMutation.mutate({
              user: confirmState.member,
              isActive: confirmState.isActive,
            });
          }
        }}
        onCancel={() => setConfirmState(null)}
        loading={
          updateMemberMutation.isPending ||
          deactivateDepartmentMutation.isPending ||
          renameDepartmentMutation.isPending ||
          deleteDepartmentMutation.isPending
        }
      />
    </View>
  );
}
