import { useLocalSearchParams, useRouter } from "expo-router";
import {
  User,
  CheckCircle,
  Clock,
  Star,
  MapPin,
  Calendar,
  Mail,
  Phone,
  AtSign,
  Hash,
  ChevronDown,
  ChevronUp,
  UserMinus,
  AlertTriangle,
  BarChart2,
} from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Pressable,
} from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import Card from "../../../components/Card";
import PressableBlock from "../../../components/PressableBlock";
import StatusPill from "../../../components/StatusPill";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import apiCall from "../../../utils/api";
import { HOD_REMOVE_WORKER_URL } from "../../../url";
import {
  formatPriorityLabel,
  getPriorityColor,
} from "../../../data/complaintStatus";
import { useWorkerDetails } from "../../../utils/hooks/useWorkerDetails";

export default function WorkerDetails() {
  const { t, locale } = useTranslation();
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [showActiveComplaints, setShowActiveComplaints] = useState(true);
  const [showPastWork, setShowPastWork] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removing, setRemoving] = useState(false);
  const {
    data,
    isLoading: loading,
    isRefetching: refreshing,
    refetch,
  } = useWorkerDetails(id);
  const worker = data?.worker ?? null;
  const activeComplaints = data?.activeComplaints ?? [];
  const completedComplaints = data?.completedComplaints ?? [];

  const getWorkerName = (workerData) =>
    workerData?.fullName ??
    workerData?.username ??
    t("hod.workers.details.workerFallback");

  const formatCompletedDate = (dateValue) => {
    if (dateValue == null) {
      return t("hod.workers.details.dateUnavailable");
    }

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return t("hod.workers.details.dateUnavailable");
    }

    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
    }).format(date);
  };

  const handleRemoveWorker = async () => {
    if (activeComplaints.length > 0) {
      Toast.show({
        type: "error",
        text1: t("hod.workers.details.failed"),
        text2: t("hod.workers.details.removeWarning", {
          count: activeComplaints.length,
          plural: activeComplaints.length === 1 ? "" : "s",
        }),
      });
      return;
    }

    try {
      setRemoving(true);
      await apiCall({
        method: "DELETE",
        url: HOD_REMOVE_WORKER_URL(id),
      });

      Toast.show({
        type: "success",
        text1: t("hod.workers.details.workerRemoved"),
        text2: t("hod.workers.details.workerRemovedMessage", {
          name: getWorkerName(worker),
        }),
      });

      setShowRemoveModal(false);
      router.back();
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("hod.workers.details.failed"),
        text2:
          e?.response?.data?.message ?? t("hod.workers.details.couldNotRemove"),
      });
    } finally {
      setRemoving(false);
    }
  };

  if (loading) {
    return (
      <View
        className="flex-1"
        style={{ backgroundColor: colors.backgroundPrimary }}
      >
        <BackButtonHeader title={t("hod.workers.details.title")} />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            className="text-sm mt-3"
            style={{ color: colors.textSecondary }}
          >
            {t("hod.workers.details.loading")}
          </Text>
        </View>
      </View>
    );
  }

  if (!worker) {
    return (
      <View
        className="flex-1"
        style={{ backgroundColor: colors.backgroundPrimary }}
      >
        <BackButtonHeader title={t("hod.workers.details.title")} />
        <View className="flex-1 justify-center items-center p-6">
          <User size={48} color={colors.textSecondary} />
          <Text
            className="text-lg font-bold mt-4"
            style={{ color: colors.textPrimary }}
          >
            {t("hod.workers.details.notFound")}
          </Text>
        </View>
      </View>
    );
  }

  const workerName = getWorkerName(worker);
  const workerUsername =
    worker.username ?? t("hod.workers.details.notAvailable");
  const activeCount =
    data?.summary?.activeCount ??
    worker.activeComplaints ??
    worker.metrics?.activeComplaints ??
    activeComplaints.length;
  const completedCount =
    data?.summary?.completedCount ??
    worker.completedCount ??
    worker.metrics?.completedCount ??
    worker.performanceMetrics?.totalCompleted ??
    0;
  const ratingValue =
    typeof worker.rating === "number"
      ? worker.rating.toFixed(1)
      : t("hod.workers.details.notAvailable");

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader title={t("hod.workers.details.title")} />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => refetch()}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Worker Profile Card */}
        <Card style={{ margin: 0, marginBottom: 16, flex: 0 }}>
          <View className="items-center mb-4">
            <View
              className="w-20 h-20 rounded-full items-center justify-center mb-3"
              style={{ backgroundColor: colors.primary + "20" }}
            >
              <User size={40} color={colors.primary} />
            </View>
            <Text
              className="text-xl font-bold"
              style={{ color: colors.textPrimary }}
            >
              {workerName}
            </Text>
            <View className="flex-row items-center mt-1">
              <AtSign size={14} color={colors.textSecondary} />
              <Text
                className="text-sm ml-1"
                style={{ color: colors.textSecondary }}
              >
                {workerUsername}
              </Text>
            </View>
          </View>

          <View
            className="h-[1px] mb-4"
            style={{ backgroundColor: colors.border }}
          />

          {/* Contact Info */}
          <View className="space-y-2">
            <View className="flex-row items-center mb-2">
              <Mail size={16} color={colors.textSecondary} />
              <Text
                className="text-sm ml-2"
                style={{ color: colors.textPrimary }}
              >
                {worker.email ?? t("hod.workers.details.notAvailable")}
              </Text>
            </View>
            <View className="flex-row items-center mb-2">
              <Phone size={16} color={colors.textSecondary} />
              <Text
                className="text-sm ml-2"
                style={{ color: colors.textPrimary }}
              >
                {worker.phone ?? t("hod.workers.details.notAvailable")}
              </Text>
            </View>
            <View className="flex-row items-center">
              <User size={16} color={colors.textSecondary} />
              <Text
                className="text-sm ml-2 capitalize"
                style={{ color: colors.textPrimary }}
              >
                {worker.department != null
                  ? t("hod.workers.details.departmentValue", {
                      department: worker.department,
                    })
                  : t("hod.workers.details.notAvailable")}
              </Text>
            </View>
          </View>
        </Card>

        {/* Performance Stats */}
        <View className="flex-row mb-4">
          <Card style={{ margin: 0, marginRight: 6, flex: 1 }}>
            <View className="items-center">
              <View className="flex-row items-center mb-1">
                <Clock size={16} color={colors.warning} />
                <Text
                  className="text-2xl font-bold ml-1"
                  style={{ color: colors.textPrimary }}
                >
                  {activeCount}
                </Text>
              </View>
              <Text className="text-xs" style={{ color: colors.textSecondary }}>
                {t("hod.workers.details.stats.active")}
              </Text>
            </View>
          </Card>

          <Card style={{ margin: 0, marginLeft: 6, marginRight: 6, flex: 1 }}>
            <View className="items-center">
              <View className="flex-row items-center mb-1">
                <CheckCircle size={16} color={colors.success} />
                <Text
                  className="text-2xl font-bold ml-1"
                  style={{ color: colors.textPrimary }}
                >
                  {completedCount}
                </Text>
              </View>
              <Text className="text-xs" style={{ color: colors.textSecondary }}>
                {t("hod.workers.details.stats.completed")}
              </Text>
            </View>
          </Card>

          <Card style={{ margin: 0, marginLeft: 6, flex: 1 }}>
            <View className="items-center">
              <View className="flex-row items-center mb-1">
                <Star size={16} color={colors.primary} />
                <Text
                  className="text-2xl font-bold ml-1"
                  style={{ color: colors.textPrimary }}
                >
                  {ratingValue}
                </Text>
              </View>
              <Text className="text-xs" style={{ color: colors.textSecondary }}>
                {t("hod.workers.details.stats.rating")}
              </Text>
            </View>
          </Card>
        </View>

        {/* Analytics Button */}
        <TouchableOpacity
          className="flex-row items-center justify-center rounded-2xl py-3 mb-4"
          style={{
            backgroundColor: colors.primary + "18",
            borderWidth: 1,
            borderColor: colors.primary + "44",
          }}
          activeOpacity={0.7}
          onPress={() =>
            router.push(`/(app)/more/worker-analytics?workerId=${id}`)
          }
        >
          <BarChart2 size={18} color={colors.primary} />
          <Text
            className="text-sm font-semibold ml-2"
            style={{ color: colors.primary }}
          >
            {t("hod.workers.details.analyticsButton")}
          </Text>
        </TouchableOpacity>

        {/* Current Assignments */}
        <PressableBlock
          onPress={() => setShowActiveComplaints(!showActiveComplaints)}
        >
          <View className="flex-row items-center justify-between mb-3">
            <Text
              className="text-lg font-bold"
              style={{ color: colors.textPrimary }}
            >
              {t("hod.workers.details.currentAssignmentsWithCount", {
                count: activeComplaints.length,
              })}
            </Text>
            {showActiveComplaints ? (
              <ChevronUp size={20} color={colors.textPrimary} />
            ) : (
              <ChevronDown size={20} color={colors.textPrimary} />
            )}
          </View>
        </PressableBlock>

        {showActiveComplaints && (
          <>
            {activeComplaints.length === 0 ? (
              <Card style={{ margin: 0, marginBottom: 16 }}>
                <View className="items-center py-6">
                  <Text
                    className="text-base font-semibold"
                    style={{ color: colors.textSecondary }}
                  >
                    {t("hod.workers.details.noActiveAssignments")}
                  </Text>
                </View>
              </Card>
            ) : (
              activeComplaints.map((complaint) =>
                (() => {
                  const complaintId =
                    complaint.id ?? complaint._id ?? complaint.ticketId;
                  return (
                    <PressableBlock
                      key={String(complaintId)}
                      onPress={() =>
                        router.push(
                          `/complaints/complaint-details?id=${complaintId}`,
                        )
                      }
                    >
                      <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
                        <View className="flex-row items-start justify-between mb-2">
                          <View className="flex-row items-center">
                            <Hash size={15} color={colors.primary} />
                            <Text
                              className="text-base font-bold ml-1"
                              style={{ color: colors.primary }}
                            >
                              {complaint.ticketId ??
                                t("hod.workers.details.notAvailable")}
                            </Text>
                          </View>
                          <StatusPill status={complaint.status} />
                        </View>

                        <Text
                          className="text-base font-semibold mb-2"
                          style={{ color: colors.textPrimary }}
                        >
                          {complaint.title ??
                            t("hod.workers.details.complaintFallback")}
                        </Text>

                        <Text
                          className="text-sm mb-3"
                          style={{ color: colors.textSecondary }}
                          numberOfLines={2}
                        >
                          {complaint.description ??
                            t("hod.workers.details.descriptionUnavailable")}
                        </Text>

                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center flex-1">
                            <MapPin size={14} color={colors.textSecondary} />
                            <Text
                              className="text-xs ml-1 flex-1"
                              style={{ color: colors.textSecondary }}
                              numberOfLines={1}
                            >
                              {complaint.locationName ??
                                t("hod.workers.details.locationUnavailable")}
                            </Text>
                          </View>

                          <View
                            className="px-2 py-1 rounded ml-2"
                            style={{
                              backgroundColor:
                                getPriorityColor(complaint.priority, colors) +
                                "20",
                            }}
                          >
                            <Text
                              className="text-xs font-semibold"
                              style={{
                                color: getPriorityColor(
                                  complaint.priority,
                                  colors,
                                ),
                              }}
                            >
                              {formatPriorityLabel(t, complaint.priority)}
                            </Text>
                          </View>
                        </View>
                      </Card>
                    </PressableBlock>
                  );
                })(),
              )
            )}
          </>
        )}

        {/* Past Work */}
        <PressableBlock onPress={() => setShowPastWork(!showPastWork)}>
          <View className="flex-row items-center justify-between mb-3 mt-2">
            <Text
              className="text-lg font-bold"
              style={{ color: colors.textPrimary }}
            >
              {t("hod.workers.details.pastWorkWithCount", {
                count: completedComplaints.length,
              })}
            </Text>
            {showPastWork ? (
              <ChevronUp size={20} color={colors.textPrimary} />
            ) : (
              <ChevronDown size={20} color={colors.textPrimary} />
            )}
          </View>
        </PressableBlock>

        {showPastWork && (
          <>
            {completedComplaints.length === 0 ? (
              <Card style={{ margin: 0, marginBottom: 16 }}>
                <View className="items-center py-6">
                  <Text
                    className="text-base font-semibold"
                    style={{ color: colors.textSecondary }}
                  >
                    {t("hod.workers.details.noCompletedWork")}
                  </Text>
                </View>
              </Card>
            ) : (
              completedComplaints.map((complaint) =>
                (() => {
                  const complaintId =
                    complaint.id ?? complaint._id ?? complaint.ticketId;
                  return (
                    <PressableBlock
                      key={String(complaintId)}
                      onPress={() =>
                        router.push(
                          `/complaints/complaint-details?id=${complaintId}`,
                        )
                      }
                    >
                      <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
                        <View className="flex-row items-start justify-between mb-2">
                          <View className="flex-row items-center">
                            <Hash size={15} color={colors.success} />
                            <Text
                              className="text-base font-bold ml-1"
                              style={{ color: colors.success }}
                            >
                              {complaint.ticketId ??
                                t("hod.workers.details.notAvailable")}
                            </Text>
                          </View>
                          <StatusPill status={complaint.status} />
                        </View>

                        <Text
                          className="text-base font-semibold mb-2"
                          style={{ color: colors.textPrimary }}
                        >
                          {complaint.title ??
                            t("hod.workers.details.complaintFallback")}
                        </Text>

                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center">
                            <Calendar size={14} color={colors.textSecondary} />
                            <Text
                              className="text-xs ml-1"
                              style={{ color: colors.textSecondary }}
                            >
                              {formatCompletedDate(complaint.updatedAt)}
                            </Text>
                          </View>

                          <View
                            className="px-2 py-1 rounded"
                            style={{
                              backgroundColor:
                                getPriorityColor(complaint.priority, colors) +
                                "20",
                            }}
                          >
                            <Text
                              className="text-xs font-semibold"
                              style={{
                                color: getPriorityColor(
                                  complaint.priority,
                                  colors,
                                ),
                              }}
                            >
                              {formatPriorityLabel(t, complaint.priority)}
                            </Text>
                          </View>
                        </View>
                      </Card>
                    </PressableBlock>
                  );
                })(),
              )
            )}
          </>
        )}

        {/* Remove Worker Section */}
        <View className="mt-6 mb-4">
          <Card
            style={{
              margin: 0,
              backgroundColor: colors.danger + "14",
              borderWidth: 1,
              borderColor: colors.danger + "55",
            }}
          >
            <View className="flex-row items-start mb-3">
              <AlertTriangle size={20} color={colors.danger} />
              <View className="flex-1 ml-2">
                <Text
                  className="text-sm font-semibold mb-1"
                  style={{ color: colors.danger }}
                >
                  {t("hod.workers.details.removeWorker")}
                </Text>
                <Text className="text-xs" style={{ color: colors.danger }}>
                  {t("hod.workers.details.removeWorkerDesc")}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              className="rounded-xl py-3 px-4 flex-row items-center justify-center"
              style={{ backgroundColor: colors.danger }}
              onPress={() => setShowRemoveModal(true)}
              activeOpacity={0.7}
            >
              <UserMinus size={18} color={colors.light} />
              <Text
                className="text-sm font-semibold ml-2"
                style={{ color: colors.light }}
              >
                {t("hod.workers.details.removeFromDepartment")}
              </Text>
            </TouchableOpacity>
          </Card>
        </View>
      </ScrollView>

      {/* Remove Worker Confirmation Modal */}
      <Modal
        visible={showRemoveModal}
        transparent
        animationType="fade"
        onRequestClose={() => !removing && setShowRemoveModal(false)}
      >
        <Pressable
          className="flex-1 justify-center items-center px-4"
          style={{ backgroundColor: colors.dark + "80" }}
          onPress={() => !removing && setShowRemoveModal(false)}
        >
          <Pressable
            className="w-full max-w-md rounded-2xl p-6"
            style={{ backgroundColor: colors.backgroundPrimary }}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View className="items-center mb-4">
              <View
                className="w-16 h-16 rounded-full items-center justify-center mb-3"
                style={{ backgroundColor: colors.danger + "18" }}
              >
                <AlertTriangle size={32} color={colors.danger} />
              </View>
              <Text
                className="text-xl font-bold text-center"
                style={{ color: colors.textPrimary }}
              >
                {t("hod.workers.details.removeModalTitle")}
              </Text>
            </View>

            <Text
              className="text-base text-center mb-2"
              style={{ color: colors.textPrimary }}
            >
              {t("hod.workers.details.removeModalMessage", {
                name: workerName,
              })}
            </Text>

            <Text
              className="text-sm text-center mb-6"
              style={{ color: colors.textSecondary }}
            >
              {t("hod.workers.details.removeModalDesc")}
            </Text>

            {activeComplaints.length > 0 && (
              <View
                className="rounded-lg p-3 mb-4"
                style={{ backgroundColor: colors.danger + "14" }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{ color: colors.danger }}
                >
                  {t("hod.workers.details.removeWarning", {
                    count: activeComplaints.length,
                    plural: activeComplaints.length === 1 ? "" : "s",
                  })}
                </Text>
              </View>
            )}

            {/* Buttons */}
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 rounded-xl py-3 border"
                style={{
                  borderColor: colors.border,
                  backgroundColor: colors.backgroundSecondary,
                }}
                onPress={() => setShowRemoveModal(false)}
                disabled={removing}
              >
                <Text
                  className="text-center font-semibold"
                  style={{ color: colors.textPrimary }}
                >
                  {t("hod.workers.details.cancel")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 rounded-xl py-3 flex-row items-center justify-center"
                style={{ backgroundColor: colors.danger }}
                onPress={handleRemoveWorker}
                disabled={removing}
              >
                {removing ? (
                  <ActivityIndicator size="small" color={colors.light} />
                ) : (
                  <Text
                    className="text-center font-semibold"
                    style={{ color: colors.light }}
                  >
                    {t("hod.workers.details.remove")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
