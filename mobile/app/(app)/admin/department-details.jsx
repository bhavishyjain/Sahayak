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
  Plus,
  ChevronDown,
  ChevronRight,
  Shield,
  Trash2,
  Users,
} from "lucide-react-native";
import Toast from "react-native-toast-message";
import { useEffect, useMemo, useState } from "react";
import BackButtonHeader from "../../../components/BackButtonHeader";
import DialogBox from "../../../components/DialogBox";
import PressableBlock from "../../../components/PressableBlock";
import { darkColors, lightColors } from "../../../colors";
import apiCall from "../../../utils/api";
import {
  COMPLAINT_STATUS_META,
} from "../../../data/complaintStatus";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import {
  DEPARTMENT_INVITATIONS_URL,
  DEPARTMENT_INVITATION_DETAIL_URL,
  REPORT_DEPARTMENT_BREAKDOWN_URL,
  DEACTIVATE_DEPARTMENT_URL,
  REACTIVATE_DEPARTMENT_URL,
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
  const { t } = useTranslation();
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
            {member?.email || t("adminScreens.departmentDetails.noEmail")} •{" "}
            {member?.phone || t("adminScreens.departmentDetails.noPhone")}
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
            {active
              ? t("adminScreens.departmentDetails.active")
              : t("adminScreens.departmentDetails.inactive")}
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
          {active
            ? t("adminScreens.departmentDetails.deactivate")
            : t("adminScreens.departmentDetails.reactivate")}
        </Text>
      </PressableBlock>
    </PressableBlock>
  );
}

function InvitationRow({ invitation, roleLabel, colors, onRevoke }) {
  const { t } = useTranslation();
  return (
    <View
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
            {invitation?.email}
          </Text>
          <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
            {t("adminScreens.departmentDetails.invitedRole", { role: roleLabel })}
          </Text>
          <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
            {t("adminScreens.departmentDetails.pendingInvitation")}
          </Text>
        </View>
        <View
          className="px-2.5 py-1 rounded-full"
          style={{ backgroundColor: colors.warning + "18" }}
        >
          <Text className="text-[11px] font-semibold" style={{ color: colors.warning }}>
            {t("common.status.pending")}
          </Text>
        </View>
      </View>

      <PressableBlock
        onPress={onRevoke}
        className="rounded-xl py-3 items-center mt-4"
        style={{ backgroundColor: colors.danger + "18" }}
      >
        <View className="flex-row items-center">
          <Trash2 size={15} color={colors.danger} />
          <Text className="text-sm font-semibold ml-2" style={{ color: colors.danger }}>
            {t("adminScreens.departmentDetails.revoke")}
          </Text>
        </View>
      </PressableBlock>
    </View>
  );
}

function DropdownSection({
  title,
  count,
  pendingCount = 0,
  icon: Icon,
  tone,
  open,
  onToggle,
  actionLabel,
  onAction,
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
      <View className="flex-row items-center justify-between">
        <PressableBlock onPress={onToggle} className="flex-1">
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
                {pendingCount > 0
                  ? ` • ${pendingCount} pending`
                  : ""}
              </Text>
            </View>
          </View>
        </PressableBlock>
        <View className="flex-row items-center ml-3">
          {actionLabel && onAction ? (
            <PressableBlock
              onPress={onAction}
              className="px-3 py-2 rounded-xl mr-3"
              style={{ backgroundColor: tone + "16" }}
            >
              <View className="flex-row items-center">
                <Plus size={14} color={tone} />
                <Text
                  className="text-xs font-semibold ml-1"
                  style={{ color: tone }}
                >
                  {actionLabel}
                </Text>
              </View>
            </PressableBlock>
          ) : null}
          <PressableBlock onPress={onToggle}>
            {open ? (
              <ChevronDown size={18} color={colors.textSecondary} />
            ) : (
              <ChevronRight size={18} color={colors.textSecondary} />
            )}
          </PressableBlock>
        </View>
      </View>

      {open ? <View className="mt-4">{children}</View> : null}
    </View>
  );
}

export default function DepartmentDetailsScreen() {
  const { t } = useTranslation();
  const { department } = useLocalSearchParams();
  const departmentName =
    typeof department === "string" && department.trim()
      ? department.trim()
      : "Unknown";
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const queryClient = useQueryClient();
  const [confirmState, setConfirmState] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
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
    enabled: Boolean(departmentName && departmentRecord?.id),
    queryFn: async () => {
      const [usersRes, breakdownRes, invitationsRes] = await Promise.all([
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
        apiCall({
          method: "GET",
          url: DEPARTMENT_INVITATIONS_URL(departmentRecord?.id),
        }),
      ]);

      const users = usersRes?.data ?? [];
      const breakdownPayload = breakdownRes?.data ?? {};
      const invitations = invitationsRes?.data ?? [];
      const analytics =
        breakdownPayload?.[departmentName] ||
        breakdownPayload?.breakdown?.[departmentName] ||
        breakdownPayload?.summary?.[departmentName] ||
        {};

      return {
        analytics,
        heads: users.filter((item) => item.role === "head"),
        workers: users.filter((item) => item.role === "worker"),
        invitations: invitations.filter(Boolean),
      };
    },
  });

  useEffect(() => {
    if (!error) return;
    Toast.show({
      type: "error",
      text1: t("adminScreens.departmentDetails.toasts.loadFailedTitle"),
      text2:
        error?.response?.data?.message ||
        t("adminScreens.departmentDetails.toasts.loadFailedMessage"),
    });
  }, [error, t]);

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
        text1: t("adminScreens.departmentDetails.toasts.memberUpdatedTitle"),
        text2: t("adminScreens.departmentDetails.toasts.memberUpdatedMessage"),
      });
    },
    onError: (mutationError) => {
      Toast.show({
        type: "error",
        text1: t("adminScreens.departmentDetails.toasts.memberUpdateFailedTitle"),
        text2:
          mutationError?.response?.data?.message ||
          t("adminScreens.departmentDetails.toasts.memberUpdateFailedMessage"),
      });
    },
  });

  const inviteDepartmentMemberMutation = useMutation({
    mutationFn: async ({ role, email }) => {
      if (!departmentRecord?.id) {
        throw new Error(t("adminScreens.departmentDetails.departmentNotFound"));
      }
      return apiCall({
        method: "POST",
        url: DEPARTMENT_INVITATIONS_URL(departmentRecord.id),
        data: {
          role,
          email: email.trim().toLowerCase(),
        },
      });
    },
    onSuccess: (_response, variables) => {
      invalidateAdminQueries();
      setConfirmState(null);
      setInviteEmail("");
      Toast.show({
        type: "success",
        text1: t("adminScreens.departmentDetails.toasts.invitedTitle", {
          role:
            variables.role === "head"
              ? t("adminScreens.departmentDetails.hodShort")
              : t("adminScreens.departmentDetails.worker"),
        }),
        text2: t("adminScreens.departmentDetails.toasts.invitedMessage", {
          email: variables.email.trim().toLowerCase(),
        }),
      });
    },
    onError: (mutationError, variables) => {
      Toast.show({
        type: "error",
        text1: t("adminScreens.departmentDetails.toasts.inviteFailedTitle", {
          role:
            variables?.role === "head"
              ? t("adminScreens.departmentDetails.hodShort")
              : t("adminScreens.departmentDetails.worker").toLowerCase(),
        }),
        text2:
          mutationError?.response?.data?.message ||
          t("adminScreens.departmentDetails.toasts.inviteFailedMessage"),
      });
    },
  });

  const revokeInvitationMutation = useMutation({
    mutationFn: async (invitation) => {
      if (!departmentRecord?.id) {
        throw new Error(t("adminScreens.departmentDetails.departmentNotFound"));
      }
      return apiCall({
        method: "DELETE",
        url: DEPARTMENT_INVITATION_DETAIL_URL(departmentRecord.id, invitation.id),
      });
    },
    onSuccess: () => {
      invalidateAdminQueries();
      setConfirmState(null);
      Toast.show({
        type: "success",
        text1: t("adminScreens.departmentDetails.toasts.revokedTitle"),
        text2: t("adminScreens.departmentDetails.toasts.revokedMessage"),
      });
    },
    onError: (mutationError) => {
      Toast.show({
        type: "error",
        text1: t("adminScreens.departmentDetails.toasts.revokeFailedTitle"),
        text2:
          mutationError?.response?.data?.message ||
          t("adminScreens.departmentDetails.toasts.revokeFailedMessage"),
      });
    },
  });

  const deactivateDepartmentMutation = useMutation({
    mutationFn: async (nextActiveState) => {
      if (!departmentRecord?.id) {
        throw new Error(t("adminScreens.departmentDetails.departmentNotFound"));
      }
      return apiCall({
        method: "POST",
        url: nextActiveState
          ? REACTIVATE_DEPARTMENT_URL(departmentRecord.id)
          : DEACTIVATE_DEPARTMENT_URL(departmentRecord.id),
      });
    },
    onSuccess: (_response, nextActiveState) => {
      invalidateAdminQueries();
      setConfirmState(null);
      Toast.show({
        type: "success",
        text1: nextActiveState
          ? t("adminScreens.departmentDetails.toasts.departmentReactivatedTitle")
          : t("adminScreens.departmentDetails.toasts.departmentDeactivatedTitle"),
        text2: nextActiveState
          ? t("adminScreens.departmentDetails.toasts.departmentReactivatedMessage")
          : t("adminScreens.departmentDetails.toasts.departmentDeactivatedMessage"),
      });
    },
    onError: (mutationError) => {
      Toast.show({
        type: "error",
        text1: t("adminScreens.departmentDetails.toasts.departmentStatusFailedTitle"),
        text2:
          mutationError?.response?.data?.message ||
          t("adminScreens.departmentDetails.toasts.departmentStatusFailedMessage"),
      });
    },
  });

  const renameDepartmentMutation = useMutation({
    mutationFn: async () => {
      if (!departmentRecord?.id) {
        throw new Error(t("adminScreens.departmentDetails.departmentNotFound"));
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
        text1: t("adminScreens.departmentDetails.toasts.departmentUpdatedTitle"),
        text2: t("adminScreens.departmentDetails.toasts.departmentUpdatedMessage"),
      });
      router.replace(
        `/(app)/admin/department-details?department=${encodeURIComponent(nextDepartmentName)}`,
      );
    },
    onError: (mutationError) => {
      Toast.show({
        type: "error",
        text1: t("adminScreens.departmentDetails.toasts.departmentUpdateFailedTitle"),
        text2:
          mutationError?.response?.data?.message ||
          t("adminScreens.departmentDetails.toasts.departmentUpdateFailedMessage"),
      });
    },
  });

  const deleteDepartmentMutation = useMutation({
    mutationFn: async () => {
      if (!departmentRecord?.id) {
        throw new Error(t("adminScreens.departmentDetails.departmentNotFound"));
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
        text1: t("adminScreens.departmentDetails.toasts.departmentDeletedTitle"),
        text2: t("adminScreens.departmentDetails.toasts.departmentDeletedMessage"),
      });
      router.replace("/(app)/(tabs)/admin-departments");
    },
    onError: (mutationError) => {
      Toast.show({
        type: "error",
        text1: t("adminScreens.departmentDetails.toasts.departmentDeleteFailedTitle"),
        text2:
          mutationError?.response?.data?.message ||
          t("adminScreens.departmentDetails.toasts.departmentDeleteFailedMessage"),
      });
    },
  });

  const heads = useMemo(() => data?.heads ?? [], [data?.heads]);
  const workers = useMemo(() => data?.workers ?? [], [data?.workers]);
  const invitations = useMemo(() => data?.invitations ?? [], [data?.invitations]);
  const analytics = useMemo(() => data?.analytics ?? {}, [data?.analytics]);
  const headInvitations = useMemo(
    () => invitations.filter((item) => item.role === "head"),
    [invitations],
  );
  const workerInvitations = useMemo(
    () => invitations.filter((item) => item.role !== "head"),
    [invitations],
  );
  const statusCards = useMemo(
    () => [
      { key: "pending", value: Number(analytics.pending ?? 0) },
      { key: "assigned", value: Number(analytics.assigned ?? 0) },
      { key: "in-progress", value: Number(analytics.inProgress ?? 0) },
      {
        key: "pending-approval",
        value: Number(analytics.pendingApproval ?? 0),
      },
      { key: "needs-rework", value: Number(analytics.needsRework ?? 0) },
      { key: "resolved", value: Number(analytics.resolved ?? 0) },
      { key: "cancelled", value: Number(analytics.cancelled ?? 0) },
    ],
    [analytics],
  );

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
        title={t("adminScreens.departmentDetails.title", { department: departmentName })}
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
              {t("adminScreens.departmentDetails.editDepartmentName")}
            </Text>
          </PressableBlock>

          <PressableBlock
            onPress={() =>
              setConfirmState({
                type: "department",
                isActive: departmentRecord?.isActive === false,
              })
            }
            className="rounded-2xl py-4 items-center"
            style={{
              backgroundColor:
                departmentRecord?.isActive === false
                  ? colors.success
                  : colors.warning,
            }}
          >
            <Text className="text-sm font-semibold" style={{ color: colors.dark }}>
              {departmentRecord?.isActive === false
                ? t("adminScreens.departmentDetails.reactivateDepartment")
                : t("adminScreens.departmentDetails.deactivateDepartment")}
            </Text>
          </PressableBlock>

          <PressableBlock
            onPress={() => setConfirmState({ type: "delete" })}
            className="rounded-2xl py-4 items-center"
            style={{ backgroundColor: colors.danger }}
          >
            <Text className="text-sm font-semibold" style={{ color: colors.light }}>
              {t("adminScreens.departmentDetails.deleteDepartment")}
            </Text>
          </PressableBlock>
        </View>

        <View className="flex-row mb-3" style={{ gap: 12 }}>
          <MetricCard
            label={t("adminScreens.departmentDetails.totalComplaints")}
            value={Number(analytics.total ?? 0)}
            tone={colors.textPrimary}
            colors={colors}
          />
          <MetricCard
            label={t("adminScreens.departmentDetails.totalMembers")}
            value={heads.length + workers.length}
            tone={colors.primary}
            colors={colors}
          />
        </View>

        <View className="flex-row flex-wrap mb-2" style={{ gap: 12 }}>
          {statusCards.map((item) => {
            const meta = COMPLAINT_STATUS_META[item.key];
            const tone = colors[meta?.colorRole] || colors.textPrimary;
            return (
              <View key={item.key} style={{ width: "47%" }}>
                <MetricCard
                  label={meta?.fallbackLabel || item.key}
                  value={item.value}
                  tone={tone}
                  colors={colors}
                />
              </View>
            );
          })}
        </View>

        <DropdownSection
          title={t("adminScreens.departmentDetails.hods")}
          count={heads.length}
          pendingCount={headInvitations.length}
          icon={Shield}
          tone={colors.warning}
          open={hodOpen}
          onToggle={() => setHodOpen((value) => !value)}
          actionLabel={t("adminScreens.departmentDetails.addHod")}
          onAction={() => setConfirmState({ type: "invite", role: "head" })}
          colors={colors}
        >
          {heads.length === 0 ? (
            headInvitations.length === 0 ? (
              <Text className="text-sm" style={{ color: colors.textSecondary }}>
                {t("adminScreens.departmentDetails.noHod")}
              </Text>
            ) : null
          ) : (
            heads.map((head) => (
              <MemberRow
                key={head._id}
                member={head}
                roleLabel={t("adminScreens.departmentDetails.departmentHead")}
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
          {headInvitations.map((invitation) => (
            <InvitationRow
              key={invitation.id}
              invitation={invitation}
              roleLabel={t("adminScreens.departmentDetails.departmentHeadLower")}
              colors={colors}
              onRevoke={() =>
                setConfirmState({
                  type: "revoke-invite",
                  invitation,
                })
              }
            />
          ))}
        </DropdownSection>

        <DropdownSection
          title={t("adminScreens.departmentDetails.workers")}
          count={workers.length}
          pendingCount={workerInvitations.length}
          icon={Users}
          tone={colors.primary}
          open={workersOpen}
          onToggle={() => setWorkersOpen((value) => !value)}
          actionLabel={t("adminScreens.departmentDetails.addWorker")}
          onAction={() => setConfirmState({ type: "invite", role: "worker" })}
          colors={colors}
        >
          {workers.length === 0 ? (
            workerInvitations.length === 0 ? (
              <Text className="text-sm" style={{ color: colors.textSecondary }}>
                {t("adminScreens.departmentDetails.noWorkers")}
              </Text>
            ) : null
          ) : (
            workers.map((worker) => (
              <MemberRow
                key={worker._id}
                member={worker}
                roleLabel={t("adminScreens.departmentDetails.worker")}
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
          {workerInvitations.map((invitation) => (
            <InvitationRow
              key={invitation.id}
              invitation={invitation}
              roleLabel={t("adminScreens.departmentDetails.workerLower")}
              colors={colors}
              onRevoke={() =>
                setConfirmState({
                  type: "revoke-invite",
                  invitation,
                })
              }
            />
          ))}
        </DropdownSection>
      </ScrollView>

      <DialogBox
        visible={Boolean(confirmState)}
        onClose={() => setConfirmState(null)}
        title={
          confirmState?.type === "rename"
            ? t("adminScreens.departmentDetails.dialog.renameTitle")
            : confirmState?.type === "invite"
              ? t("adminScreens.departmentDetails.dialog.inviteTitle", {
                  role:
                    confirmState?.role === "head"
                      ? t("adminScreens.departmentDetails.hodShort")
                      : t("adminScreens.departmentDetails.workerLower"),
                })
            : confirmState?.type === "revoke-invite"
              ? t("adminScreens.departmentDetails.dialog.revokeInviteTitle")
            : confirmState?.type === "delete"
              ? t("adminScreens.departmentDetails.dialog.deleteDepartmentTitle")
            : confirmState?.type === "department"
            ? confirmState?.isActive
              ? t("adminScreens.departmentDetails.dialog.reactivateDepartmentTitle")
              : t("adminScreens.departmentDetails.dialog.deactivateDepartmentTitle")
            : confirmState?.isActive
              ? t("adminScreens.departmentDetails.dialog.reactivateMemberTitle")
              : t("adminScreens.departmentDetails.dialog.deactivateMemberTitle")
        }
        message={
          confirmState?.type === "rename"
            ? t("adminScreens.departmentDetails.dialog.renameMessage")
            : confirmState?.type === "invite"
              ? t("adminScreens.departmentDetails.dialog.inviteMessage", {
                  department: departmentName,
                  role:
                    confirmState?.role === "head"
                      ? t("adminScreens.departmentDetails.departmentHeadLower")
                      : t("adminScreens.departmentDetails.workerLower"),
                })
            : confirmState?.type === "revoke-invite"
              ? t("adminScreens.departmentDetails.dialog.revokeInviteMessage", {
                  email: confirmState?.invitation?.email,
                })
            : confirmState?.type === "delete"
              ? t("adminScreens.departmentDetails.dialog.deleteDepartmentMessage")
            : confirmState?.type === "department"
            ? confirmState?.isActive
              ? t("adminScreens.departmentDetails.dialog.reactivateDepartmentMessage")
              : t("adminScreens.departmentDetails.dialog.deactivateDepartmentMessage")
            : confirmState?.isActive
              ? t("adminScreens.departmentDetails.dialog.reactivateMemberMessage", {
                  name:
                    confirmState?.member?.fullName ||
                    confirmState?.member?.username,
                })
              : t("adminScreens.departmentDetails.dialog.deactivateMemberMessage", {
                  name:
                    confirmState?.member?.fullName ||
                    confirmState?.member?.username,
                })
        }
        showInput={
          confirmState?.type === "rename" || confirmState?.type === "invite"
        }
        inputPlaceholder={
          confirmState?.type === "invite"
            ? t("adminScreens.departmentDetails.dialog.emailPlaceholder")
            : t("adminScreens.departmentDetails.dialog.departmentNamePlaceholder")
        }
        inputKeyboardType={
          confirmState?.type === "invite" ? "email-address" : "default"
        }
        inputValue={confirmState?.type === "invite" ? inviteEmail : renameValue}
        onInputChange={
          confirmState?.type === "invite" ? setInviteEmail : setRenameValue
        }
        confirmText={
          confirmState?.type === "rename"
            ? t("common.save")
            : confirmState?.type === "invite"
              ? t("adminScreens.departmentDetails.dialog.sendInvite")
            : confirmState?.type === "revoke-invite"
              ? t("adminScreens.departmentDetails.revoke")
            : confirmState?.type === "delete"
              ? t("common.delete")
            : confirmState?.type === "department"
            ? confirmState?.isActive
              ? t("adminScreens.departmentDetails.reactivate")
              : t("adminScreens.departmentDetails.deactivate")
            : confirmState?.isActive
              ? t("adminScreens.departmentDetails.reactivate")
              : t("adminScreens.departmentDetails.deactivate")
        }
        onConfirm={() => {
          if (confirmState?.type === "rename") {
            if (!renameValue.trim()) {
              Toast.show({
                type: "error",
                text1: t("adminScreens.departmentDetails.toasts.nameRequiredTitle"),
                text2: t("adminScreens.departmentDetails.toasts.nameRequiredMessage"),
              });
              return;
            }
            renameDepartmentMutation.mutate();
            return;
          }
          if (confirmState?.type === "invite") {
            if (!inviteEmail.trim()) {
              Toast.show({
                type: "error",
                text1: t("adminScreens.departmentDetails.toasts.emailRequiredTitle"),
                text2: t("adminScreens.departmentDetails.toasts.emailRequiredMessage"),
              });
              return;
            }
            inviteDepartmentMemberMutation.mutate({
              role: confirmState.role,
              email: inviteEmail,
            });
            return;
          }
          if (confirmState?.type === "delete") {
            deleteDepartmentMutation.mutate();
            return;
          }
          if (confirmState?.type === "revoke-invite") {
            revokeInvitationMutation.mutate(confirmState.invitation);
            return;
          }
          if (confirmState?.type === "department") {
            deactivateDepartmentMutation.mutate(Boolean(confirmState.isActive));
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
          inviteDepartmentMemberMutation.isPending ||
          revokeInvitationMutation.isPending ||
          deleteDepartmentMutation.isPending
        }
      />
    </View>
  );
}
