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
  ChevronDown,
  ChevronUp,
  UserMinus,
  AlertTriangle,
  X,
  BarChart2,
} from "lucide-react-native";
import { useEffect, useState } from "react";
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
import {
  HOD_WORKERS_URL,
  HOD_WORKER_COMPLAINTS_URL,
  HOD_REMOVE_WORKER_URL,
} from "../../../url";
import { getPriorityColor } from "../../../utils/colorHelpers";

export default function WorkerDetails() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [worker, setWorker] = useState(null);
  const [activeComplaints, setActiveComplaints] = useState([]);
  const [completedComplaints, setCompletedComplaints] = useState([]);
  const [showActiveComplaints, setShowActiveComplaints] = useState(true);
  const [showPastWork, setShowPastWork] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removing, setRemoving] = useState(false);

  const load = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      // Fetch worker details and their complaints
      const [workerRes, activeComplaintsRes, completedComplaintsRes] =
        await Promise.all([
          apiCall({
            method: "GET",
            url: HOD_WORKERS_URL,
          }),
          apiCall({
            method: "GET",
            url: HOD_WORKER_COMPLAINTS_URL(id),
            params: { status: "active" },
          }),
          apiCall({
            method: "GET",
            url: HOD_WORKER_COMPLAINTS_URL(id),
            params: { status: "completed" },
          }),
        ]);

      // Find specific worker
      const workersPayload = workerRes?.data;
      const activePayload = activeComplaintsRes?.data;
      const completedPayload = completedComplaintsRes?.data;
      const workers = workersPayload?.workers || [];
      const workerData = workers.find((w) => w.id === id || w._id === id);
      setWorker(workerData || null);

      // Set complaints from dedicated endpoints
      setActiveComplaints(activePayload?.complaints || []);
      setCompletedComplaints(completedPayload?.complaints || []);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("hod.workers.details.failed"),
        text2: e?.response?.data?.message || t("hod.workers.details.couldNotLoadDetails"),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (id) {
      load(false);
    }
  }, [id]);

  const handleRemoveWorker = async () => {
    try {
      setRemoving(true);
      await apiCall({
        method: "DELETE",
        url: HOD_REMOVE_WORKER_URL(id),
      });

      Toast.show({
        type: "success",
        text1: t("hod.workers.details.workerRemoved"),
        text2: t("hod.workers.details.workerRemovedMessage", { name: worker.fullName }),
      });

      setShowRemoveModal(false);
      router.back();
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("hod.workers.details.failed"),
        text2: e?.response?.data?.message || t("hod.workers.details.couldNotRemove"),
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
            onRefresh={() => load(true)}
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
              {worker.fullName || worker.username}
            </Text>
            <Text
              className="text-sm mt-1"
              style={{ color: colors.textSecondary }}
            >
              @{worker.username}
            </Text>
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
                {worker.email}
              </Text>
            </View>
            <View className="flex-row items-center mb-2">
              <Phone size={16} color={colors.textSecondary} />
              <Text
                className="text-sm ml-2"
                style={{ color: colors.textPrimary }}
              >
                {worker.phone || t("hod.workers.details.notAvailable")}
              </Text>
            </View>
            <View className="flex-row items-center">
              <User size={16} color={colors.textSecondary} />
              <Text
                className="text-sm ml-2 capitalize"
                style={{ color: colors.textPrimary }}
              >
                {worker.department} {t("hod.workers.details.department")}
              </Text>
            </View>
          </View>
        </Card>

        {/* Performance Stats */}
        <View className="flex-row mb-4">
          <Card style={{ margin: 0, marginRight: 6, flex: 1 }}>
            <View className="items-center">
              <View className="flex-row items-center mb-1">
                <Clock size={16} color={colors.warning || "#F59E0B"} />
                <Text
                  className="text-2xl font-bold ml-1"
                  style={{ color: colors.textPrimary }}
                >
                  {worker.activeComplaints ||
                    worker.metrics?.activeComplaints ||
                    activeComplaints.length}
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
                <CheckCircle size={16} color={colors.success || "#10B981"} />
                <Text
                  className="text-2xl font-bold ml-1"
                  style={{ color: colors.textPrimary }}
                >
                  {worker.completedCount ||
                    worker.metrics?.completedCount ||
                    worker.performanceMetrics?.totalCompleted ||
                    0}
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
                  {worker.rating ? worker.rating.toFixed(1) : t("hod.workers.details.notAvailable")}
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
          style={{ backgroundColor: colors.primary + "18", borderWidth: 1, borderColor: colors.primary + "44" }}
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
            View Performance Analytics
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
              {t("hod.workers.details.currentAssignments")} ({activeComplaints.length})
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
              activeComplaints.map((complaint) => (
                <PressableBlock
                  key={complaint.id}
                  onPress={() =>
                    router.push(
                      `/complaints/complaint-details?id=${complaint.id}`,
                    )
                  }
                >
                  <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
                    <View className="flex-row items-start justify-between mb-2">
                      <Text
                        className="text-base font-bold"
                        style={{ color: colors.primary }}
                      >
                        #{complaint.ticketId}
                      </Text>
                      <StatusPill status={complaint.status} />
                    </View>

                    <Text
                      className="text-base font-semibold mb-2"
                      style={{ color: colors.textPrimary }}
                    >
                      {complaint.title}
                    </Text>

                    <Text
                      className="text-sm mb-3"
                      style={{ color: colors.textSecondary }}
                      numberOfLines={2}
                    >
                      {complaint.description}
                    </Text>

                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center flex-1">
                        <MapPin size={14} color={colors.textSecondary} />
                        <Text
                          className="text-xs ml-1 flex-1"
                          style={{ color: colors.textSecondary }}
                          numberOfLines={1}
                        >
                          {complaint.locationName}
                        </Text>
                      </View>

                      <View
                        className="px-2 py-1 rounded ml-2"
                        style={{
                          backgroundColor:
                            getPriorityColor(complaint.priority, colors) + "20",
                        }}
                      >
                        <Text
                          className="text-xs font-semibold"
                          style={{
                            color: getPriorityColor(complaint.priority, colors),
                          }}
                        >
                          {complaint.priority}
                        </Text>
                      </View>
                    </View>
                  </Card>
                </PressableBlock>
              ))
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
              {t("hod.workers.details.pastWork")} ({completedComplaints.length})
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
              completedComplaints.map((complaint) => (
                <PressableBlock
                  key={complaint.id}
                  onPress={() =>
                    router.push(
                      `/complaints/complaint-details?id=${complaint.id}`,
                    )
                  }
                >
                  <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
                    <View className="flex-row items-start justify-between mb-2">
                      <Text
                        className="text-base font-bold"
                        style={{ color: colors.success || "#10B981" }}
                      >
                        #{complaint.ticketId}
                      </Text>
                      <StatusPill status={complaint.status} />
                    </View>

                    <Text
                      className="text-base font-semibold mb-2"
                      style={{ color: colors.textPrimary }}
                    >
                      {complaint.title}
                    </Text>

                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center">
                        <Calendar size={14} color={colors.textSecondary} />
                        <Text
                          className="text-xs ml-1"
                          style={{ color: colors.textSecondary }}
                        >
                          {new Date(complaint.updatedAt).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                            },
                          )}
                        </Text>
                      </View>

                      <View
                        className="px-2 py-1 rounded"
                        style={{
                          backgroundColor:
                            getPriorityColor(complaint.priority, colors) + "20",
                        }}
                      >
                        <Text
                          className="text-xs font-semibold"
                          style={{
                            color: getPriorityColor(complaint.priority, colors),
                          }}
                        >
                          {complaint.priority}
                        </Text>
                      </View>
                    </View>
                  </Card>
                </PressableBlock>
              ))
            )}
          </>
        )}

        {/* Remove Worker Section */}
        <View className="mt-6 mb-4">
          <Card
            style={{
              margin: 0,
              backgroundColor: "#FEF2F2",
              borderWidth: 1,
              borderColor: "#FCA5A5",
            }}
          >
            <View className="flex-row items-start mb-3">
              <AlertTriangle size={20} color="#EF4444" />
              <View className="flex-1 ml-2">
                <Text
                  className="text-sm font-semibold mb-1"
                  style={{ color: "#991B1B" }}
                >
                  {t("hod.workers.details.removeWorker")}
                </Text>
                <Text className="text-xs" style={{ color: "#991B1B" }}>
                  {t("hod.workers.details.removeWorkerDesc")}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              className="rounded-xl py-3 px-4 flex-row items-center justify-center"
              style={{ backgroundColor: "#EF4444" }}
              onPress={() => setShowRemoveModal(true)}
              activeOpacity={0.7}
            >
              <UserMinus size={18} color="#FFFFFF" />
              <Text
                className="text-sm font-semibold ml-2"
                style={{ color: "#FFFFFF" }}
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
        transparent={true}
        animationType="fade"
        onRequestClose={() => !removing && setShowRemoveModal(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-center items-center px-4"
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
                style={{ backgroundColor: "#FEE2E2" }}
              >
                <AlertTriangle size={32} color="#EF4444" />
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
              {t("hod.workers.details.removeModalMessage", { name: worker?.fullName })}{" "}
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
                style={{ backgroundColor: "#FEF2F2" }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{ color: "#991B1B" }}
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
                style={{
                  backgroundColor:
                    activeComplaints.length > 0 ? "#D1D5DB" : "#EF4444",
                }}
                onPress={handleRemoveWorker}
                disabled={removing || activeComplaints.length > 0}
              >
                {removing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text
                    className="text-center font-semibold"
                    style={{ color: "#FFFFFF" }}
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
