import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  Users,
  User,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Search,
  X,
  ChevronRight,
  Briefcase,
  Plus,
  Trash2,
  RefreshCw,
} from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import Card from "../../../components/Card";
import DialogBox from "../../../components/DialogBox";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import apiCall from "../../../utils/api";
import {
  HOD_WORKERS_URL,
  HOD_ASSIGN_MULTIPLE_WORKERS_URL,
  HOD_UPDATE_WORKER_TASK_URL,
  HOD_GET_COMPLAINT_WORKERS_URL,
  GET_COMPLAINT_BY_ID_URL,
} from "../../../url";

// ─── Status configs ────────────────────────────────────────────────────────────

const TASK_STATUSES = [
  { value: "assigned", label: "Assigned", color: "#3B82F6" },
  { value: "in-progress", label: "In Progress", color: "#F59E0B" },
  { value: "completed", label: "Completed", color: "#10B981" },
  { value: "needs-rework", label: "Needs Rework", color: "#EF4444" },
];

function statusConfig(status) {
  return (
    TASK_STATUSES.find((s) => s.value === status) ?? {
      value: status,
      label: status,
      color: "#6B7280",
    }
  );
}

// ─── Helper components ─────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = statusConfig(status);
  return (
    <View
      className="px-2 py-0.5 rounded-full"
      style={{ backgroundColor: cfg.color + "22" }}
    >
      <Text className="text-xs font-semibold" style={{ color: cfg.color }}>
        {cfg.label}
      </Text>
    </View>
  );
}

function WorkerAvatar({ name, colors }) {
  const initials = (name ?? "?").charAt(0).toUpperCase();
  const palette = [
    "#6366F1",
    "#F59E0B",
    "#10B981",
    "#EF4444",
    "#3B82F6",
    "#8B5CF6",
    "#EC4899",
    "#14B8A6",
  ];
  const color = palette[(initials.charCodeAt(0) ?? 0) % palette.length];
  return (
    <View
      className="w-9 h-9 rounded-full items-center justify-center mr-3"
      style={{ backgroundColor: color + "22" }}
    >
      <Text className="text-sm font-bold" style={{ color }}>
        {initials}
      </Text>
    </View>
  );
}

// ─── Main screen ────────────────────────────────────────────────────────────────

export default function WorkerAssignment() {
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const router = useRouter();
  const { complaintId } = useLocalSearchParams();

  // ── Data ──────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [complaint, setComplaint] = useState(null); // brief info
  const [assignedWorkers, setAssignedWorkers] = useState([]); // populated from /workers
  const [allWorkers, setAllWorkers] = useState([]);

  // ── Add-workers panel ─────────────────────────────────────────────────────
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set()); // worker IDs to add
  const [taskDescs, setTaskDescs] = useState({}); // { workerId: string }
  const [assigning, setAssigning] = useState(false);

  // ── Update-task modal ─────────────────────────────────────────────────────
  const [updateTarget, setUpdateTarget] = useState(null); // { workerId, workerName, status, notes }
  const [editStatus, setEditStatus] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  // ── Remove confirm ────────────────────────────────────────────────────────
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [complainRes, workersRes, allWorkersRes] = await Promise.all([
        apiCall({ method: "GET", url: GET_COMPLAINT_BY_ID_URL(complaintId) }),
        apiCall({
          method: "GET",
          url: HOD_GET_COMPLAINT_WORKERS_URL(complaintId),
        }),
        apiCall({ method: "GET", url: HOD_WORKERS_URL }),
      ]);

      setComplaint(complainRes?.data?.complaint ?? null);

      // The /workers endpoint returns populated worker docs
      const populated = (workersRes?.data?.workers ?? []).map((w) => ({
        workerId: String(w.workerId?._id || w.workerId || w._id || ""),
        workerName:
          w.workerId?.fullName ||
          w.workerId?.username ||
          w.workerName ||
          "Unknown",
        taskDescription: w.taskDescription ?? "",
        status: w.status ?? "assigned",
        notes: w.notes ?? "",
        assignedAt: w.assignedAt,
        completedAt: w.completedAt,
      }));
      setAssignedWorkers(populated);
      setAllWorkers(allWorkersRes?.data?.workers ?? []);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Failed to load",
        text2: e?.response?.data?.message ?? "Could not load assignment data",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [complaintId]),
  );

  // ── Derived ───────────────────────────────────────────────────────────────
  const assignedIds = useMemo(
    () => new Set(assignedWorkers.map((w) => w.workerId)),
    [assignedWorkers],
  );

  const filteredWorkers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allWorkers.filter((w) => {
      const id = String(w.id || w._id || "");
      if (assignedIds.has(id)) return false; // already assigned
      if (!q) return true;
      return (
        String(w.fullName || "")
          .toLowerCase()
          .includes(q) ||
        String(w.username || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [allWorkers, search, assignedIds]);

  // ── Add workers ───────────────────────────────────────────────────────────
  const toggleSelect = (workerId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(workerId)) {
        next.delete(workerId);
        setTaskDescs((td) => {
          const n = { ...td };
          delete n[workerId];
          return n;
        });
      } else {
        next.add(workerId);
      }
      return next;
    });
  };

  const handleAssign = async () => {
    if (selected.size === 0) {
      Toast.show({ type: "error", text1: "Select at least one worker" });
      return;
    }
    try {
      setAssigning(true);

      // Build the complete new worker list: currently assigned + newly selected
      const existingWorkers = assignedWorkers.map((w) => ({
        workerId: w.workerId,
        taskDescription: w.taskDescription || "",
      }));
      const newWorkers = [...selected].map((id) => ({
        workerId: id,
        taskDescription: taskDescs[id] || "",
      }));

      await apiCall({
        method: "POST",
        url: HOD_ASSIGN_MULTIPLE_WORKERS_URL(complaintId),
        data: { workers: [...existingWorkers, ...newWorkers] },
      });

      Toast.show({
        type: "success",
        text1: "Workers assigned",
        text2: `${selected.size} worker(s) added to this complaint`,
      });

      setSelected(new Set());
      setTaskDescs({});
      setShowAddPanel(false);
      await load(true);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Assignment failed",
        text2: e?.response?.data?.message ?? "Could not assign workers",
      });
    } finally {
      setAssigning(false);
    }
  };

  // ── Remove worker ─────────────────────────────────────────────────────────
  const handleRemove = async () => {
    if (!removeTarget) return;
    try {
      setRemoving(true);
      const remaining = assignedWorkers
        .filter((w) => w.workerId !== removeTarget.workerId)
        .map((w) => ({
          workerId: w.workerId,
          taskDescription: w.taskDescription || "",
        }));

      await apiCall({
        method: "POST",
        url: HOD_ASSIGN_MULTIPLE_WORKERS_URL(complaintId),
        data: { workers: remaining },
      });

      Toast.show({ type: "success", text1: "Worker removed" });
      await load(true);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Remove failed",
        text2: e?.response?.data?.message ?? "Could not remove worker",
      });
    } finally {
      setRemoving(false);
      setRemoveTarget(null);
    }
  };

  // ── Update task ───────────────────────────────────────────────────────────
  const openUpdateModal = (w) => {
    setUpdateTarget(w);
    setEditStatus(w.status);
    setEditNotes(w.notes || "");
  };

  const handleUpdateTask = async () => {
    if (!updateTarget) return;
    try {
      setUpdating(true);
      await apiCall({
        method: "PUT",
        url: HOD_UPDATE_WORKER_TASK_URL(complaintId, updateTarget.workerId),
        data: { status: editStatus, notes: editNotes },
      });

      Toast.show({
        type: "success",
        text1: "Task updated",
        text2: `${updateTarget.workerName}'s task has been updated`,
      });

      setUpdateTarget(null);
      await load(true);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Update failed",
        text2: e?.response?.data?.message ?? "Could not update task",
      });
    } finally {
      setUpdating(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View
        className="flex-1"
        style={{ backgroundColor: colors.backgroundPrimary }}
      >
        <BackButtonHeader title="Manage Workers" onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader title="Manage Workers" onBack={() => router.back()} />

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 80 }}
      >
        {/* Complaint info banner */}
        {complaint && (
          <Card style={{ margin: 0, marginBottom: 16, flex: 0 }}>
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text
                  className="text-xs mb-0.5"
                  style={{ color: colors.textSecondary }}
                >
                  #{complaint.ticketId}
                </Text>
                <Text
                  className="text-sm font-semibold"
                  style={{ color: colors.textPrimary }}
                  numberOfLines={2}
                >
                  {complaint.title || "Complaint"}
                </Text>
              </View>
              <StatusBadge status={complaint.status} />
            </View>
          </Card>
        )}

        {/* ── Assigned Workers ─────────────────────────────────────────────── */}
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center">
            <Users size={17} color={colors.primary} />
            <Text
              className="text-sm font-semibold ml-2"
              style={{ color: colors.textPrimary }}
            >
              Assigned Workers ({assignedWorkers.length})
            </Text>
          </View>

          {/* Add Workers toggle */}
          <TouchableOpacity
            onPress={() => {
              setShowAddPanel((v) => !v);
              setSearch("");
              setSelected(new Set());
              setTaskDescs({});
            }}
            className="flex-row items-center px-3 py-1.5 rounded-full"
            style={{ backgroundColor: colors.primary + "20" }}
          >
            <Plus size={14} color={colors.primary} />
            <Text
              className="text-xs font-semibold ml-1"
              style={{ color: colors.primary }}
            >
              Add Workers
            </Text>
          </TouchableOpacity>
        </View>

        {assignedWorkers.length === 0 ? (
          <Card style={{ margin: 0, marginBottom: 16, flex: 0 }}>
            <View className="items-center py-6">
              <RefreshCw size={24} color={colors.textSecondary} />
              <Text
                className="text-sm mt-2"
                style={{ color: colors.textSecondary }}
              >
                No workers assigned yet
              </Text>
            </View>
          </Card>
        ) : (
          assignedWorkers.map((w) => (
            <Card
              key={w.workerId}
              style={{ margin: 0, marginBottom: 10, flex: 0 }}
            >
              <View className="flex-row items-start">
                <WorkerAvatar name={w.workerName} colors={colors} />
                <View className="flex-1">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text
                      className="text-sm font-semibold flex-1 mr-2"
                      style={{ color: colors.textPrimary }}
                      numberOfLines={1}
                    >
                      {w.workerName}
                    </Text>
                    <StatusBadge status={w.status} />
                  </View>

                  {!!w.taskDescription && (
                    <Text
                      className="text-xs mb-1"
                      style={{ color: colors.textSecondary }}
                      numberOfLines={2}
                    >
                      Task: {w.taskDescription}
                    </Text>
                  )}

                  {!!w.notes && (
                    <Text
                      className="text-xs mb-2"
                      style={{ color: colors.textSecondary }}
                      numberOfLines={2}
                    >
                      Notes: {w.notes}
                    </Text>
                  )}

                  <View className="flex-row mt-1">
                    <TouchableOpacity
                      onPress={() => openUpdateModal(w)}
                      className="flex-row items-center px-3 py-1.5 rounded-lg mr-2"
                      style={{ backgroundColor: colors.primary + "20" }}
                    >
                      <Briefcase size={13} color={colors.primary} />
                      <Text
                        className="text-xs font-semibold ml-1"
                        style={{ color: colors.primary }}
                      >
                        Update Task
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setRemoveTarget(w)}
                      className="flex-row items-center px-3 py-1.5 rounded-lg"
                      style={{ backgroundColor: "#EF444420" }}
                    >
                      <Trash2 size={13} color="#EF4444" />
                      <Text
                        className="text-xs font-semibold ml-1"
                        style={{ color: "#EF4444" }}
                      >
                        Remove
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Card>
          ))
        )}

        {/* ── Add Workers Panel ─────────────────────────────────────────────── */}
        {showAddPanel && (
          <Card style={{ margin: 0, marginTop: 6, marginBottom: 16, flex: 0 }}>
            <View className="flex-row items-center mb-3">
              <Users size={16} color={colors.primary} />
              <Text
                className="text-sm font-semibold ml-2"
                style={{ color: colors.textPrimary }}
              >
                Add Workers
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAddPanel(false);
                  setSelected(new Set());
                  setTaskDescs({});
                  setSearch("");
                }}
                className="ml-auto"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View
              className="flex-row items-center px-3 py-2 rounded-xl mb-3"
              style={{
                backgroundColor: colors.backgroundSecondary,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Search size={16} color={colors.textSecondary} />
              <TextInput
                className="flex-1 ml-2 text-sm"
                style={{ color: colors.textPrimary }}
                placeholder="Search workers…"
                placeholderTextColor={colors.textSecondary}
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
              />
            </View>

            {/* Worker list */}
            {filteredWorkers.length === 0 ? (
              <Text
                className="text-sm text-center py-4"
                style={{ color: colors.textSecondary }}
              >
                {allWorkers.length === 0
                  ? "No workers in your department"
                  : "All workers already assigned"}
              </Text>
            ) : (
              filteredWorkers.map((w) => {
                const id = String(w.id || w._id || "");
                const isSelected = selected.has(id);
                return (
                  <View key={id}>
                    <TouchableOpacity
                      onPress={() => toggleSelect(id)}
                      className="flex-row items-center py-2"
                      activeOpacity={0.7}
                    >
                      <View
                        className="w-5 h-5 rounded border items-center justify-center mr-3"
                        style={{
                          borderColor: isSelected
                            ? colors.primary
                            : colors.border,
                          backgroundColor: isSelected
                            ? colors.primary
                            : "transparent",
                        }}
                      >
                        {isSelected && <CheckCircle size={14} color="#fff" />}
                      </View>
                      <WorkerAvatar name={w.fullName} colors={colors} />
                      <View className="flex-1">
                        <Text
                          className="text-sm font-semibold"
                          style={{ color: colors.textPrimary }}
                        >
                          {w.fullName || w.username}
                        </Text>
                        {w.email && (
                          <Text
                            className="text-xs"
                            style={{ color: colors.textSecondary }}
                          >
                            {w.email}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>

                    {/* Task description input for selected workers */}
                    {isSelected && (
                      <View className="mb-2 ml-11">
                        <TextInput
                          className="px-3 py-2 rounded-lg text-sm"
                          style={{
                            color: colors.textPrimary,
                            backgroundColor: colors.backgroundSecondary,
                            borderWidth: 1,
                            borderColor: colors.border,
                          }}
                          placeholder={`Task description for ${w.fullName || "worker"} (optional)`}
                          placeholderTextColor={colors.textSecondary}
                          value={taskDescs[id] || ""}
                          onChangeText={(v) =>
                            setTaskDescs((prev) => ({ ...prev, [id]: v }))
                          }
                          multiline
                          numberOfLines={2}
                        />
                      </View>
                    )}

                    <View
                      className="h-[1px]"
                      style={{ backgroundColor: colors.border + "55" }}
                    />
                  </View>
                );
              })
            )}

            {/* Selected count + Assign button */}
            {selected.size > 0 && (
              <TouchableOpacity
                onPress={handleAssign}
                disabled={assigning}
                className="flex-row items-center justify-center py-3 rounded-xl mt-4"
                style={{
                  backgroundColor: assigning ? colors.border : colors.primary,
                }}
              >
                {assigning ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <CheckCircle size={16} color="#fff" />
                    <Text className="text-sm font-semibold text-white ml-2">
                      Assign {selected.size} Worker
                      {selected.size > 1 ? "s" : ""}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </Card>
        )}
      </ScrollView>

      {/* ── Update Task Modal ──────────────────────────────────────────────────── */}
      {updateTarget && (
        <Modal
          visible={true}
          transparent
          animationType="slide"
          onRequestClose={() => !updating && setUpdateTarget(null)}
        >
          <View
            className="flex-1 justify-end"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <View
              className="rounded-t-3xl p-6"
              style={{ backgroundColor: colors.backgroundPrimary }}
            >
              {/* Header */}
              <View className="flex-row items-center mb-4">
                <WorkerAvatar name={updateTarget.workerName} colors={colors} />
                <View className="flex-1">
                  <Text
                    className="text-base font-bold"
                    style={{ color: colors.textPrimary }}
                  >
                    {updateTarget.workerName}
                  </Text>
                  <Text
                    className="text-xs"
                    style={{ color: colors.textSecondary }}
                  >
                    Update task status & notes
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => !updating && setUpdateTarget(null)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Status picker */}
              <Text
                className="text-sm font-semibold mb-2"
                style={{ color: colors.textSecondary }}
              >
                Task Status
              </Text>
              <View className="flex-row flex-wrap mb-4">
                {TASK_STATUSES.map((s) => (
                  <TouchableOpacity
                    key={s.value}
                    onPress={() => setEditStatus(s.value)}
                    className="mr-2 mb-2 px-3 py-1.5 rounded-full"
                    style={{
                      backgroundColor:
                        editStatus === s.value ? s.color : s.color + "22",
                      borderWidth: 1,
                      borderColor: s.color,
                    }}
                  >
                    <Text
                      className="text-xs font-semibold"
                      style={{
                        color: editStatus === s.value ? "#fff" : s.color,
                      }}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Notes */}
              <Text
                className="text-sm font-semibold mb-2"
                style={{ color: colors.textSecondary }}
              >
                Notes (optional)
              </Text>
              <TextInput
                className="rounded-xl px-4 py-3 mb-5 text-sm"
                style={{
                  backgroundColor: colors.backgroundSecondary,
                  color: colors.textPrimary,
                  borderWidth: 1,
                  borderColor: colors.border,
                  textAlignVertical: "top",
                }}
                placeholder="Add notes about this worker's task…"
                placeholderTextColor={colors.textSecondary}
                value={editNotes}
                onChangeText={setEditNotes}
                multiline
                numberOfLines={3}
              />

              {/* Actions */}
              <View className="flex-row">
                <Pressable
                  onPress={() => setUpdateTarget(null)}
                  disabled={updating}
                  className="flex-1 mr-2 py-3 rounded-xl items-center"
                  style={{ backgroundColor: colors.backgroundSecondary }}
                >
                  <Text
                    className="text-base font-semibold"
                    style={{ color: colors.textPrimary }}
                  >
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleUpdateTask}
                  disabled={updating}
                  className="flex-1 ml-2 py-3 rounded-xl items-center"
                  style={{
                    backgroundColor: updating ? colors.border : colors.primary,
                  }}
                >
                  {updating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-base font-semibold text-white">
                      Save Changes
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ── Remove Confirm ─────────────────────────────────────────────────────── */}
      <DialogBox
        visible={!!removeTarget}
        title="Remove Worker"
        message={`Remove ${removeTarget?.workerName} from this complaint? Their task progress will be lost.`}
        confirmText={removing ? "Removing…" : "Remove"}
        cancelText="Keep"
        onConfirm={handleRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </KeyboardAvoidingView>
  );
}
