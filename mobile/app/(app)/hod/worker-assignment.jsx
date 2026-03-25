import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  Users,
  CheckCircle,
  X,
  Briefcase,
  Plus,
  Trash2,
  RefreshCw,
  Hash,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { TextInput as PaperTextInput } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import Card from "../../../components/Card";
import DialogBox from "../../../components/DialogBox";
import SearchBar from "../../../components/SearchBar";
import { useTheme } from "../../../utils/context/theme";
import { useHodWorkerAssignment } from "../../../utils/hooks/useHodWorkerAssignment";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import useRealtimeRefresh from "../../../utils/realtime/useRealtimeRefresh";
import {
  formatStatusLabel,
  getStatusColor,
} from "../../../data/complaintStatus";

function complaintStatusConfig(status, t, colors) {
  const color = getStatusColor(status, colors) ?? colors.muted;
  return {
    label: formatStatusLabel(t, status),
    color,
  };
}

// ─── Helper components ─────────────────────────────────────────────────────────

function ComplaintStatusBadge({ status, t, colors }) {
  const cfg = complaintStatusConfig(status, t, colors);
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

function WorkerAvatar({ name, colors, t }) {
  const fallbackName = t("hod.workerAssignment.fallbacks.worker");
  const displayName = name ?? fallbackName;
  const initials = displayName.charAt(0).toUpperCase();
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

function getWorkerDisplayName(worker, t) {
  return (
    worker?.fullName ??
    worker?.username ??
    worker?.workerName ??
    worker?.workerId?.fullName ??
    worker?.workerId?.username ??
    t("hod.workerAssignment.fallbacks.worker")
  );
}

// ─── Main screen ────────────────────────────────────────────────────────────────

export default function WorkerAssignment() {
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const insets = useSafeAreaInsets();
  const modalScrollRef = useRef(null);
  const router = useRouter();
  const params = useLocalSearchParams();
  const complaintId = Array.isArray(params?.complaintId)
    ? params.complaintId[0]
    : params?.complaintId;

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
  const [selectedLeaderId, setSelectedLeaderId] = useState("");
  const [taskDescs, setTaskDescs] = useState({}); // { workerId: string }
  const [modalKeyboardHeight, setModalKeyboardHeight] = useState(0);

  // ── Update task description ───────────────────────────────────────────────
  const [updatingWorkerId, setUpdatingWorkerId] = useState(null);
  const [taskEditTarget, setTaskEditTarget] = useState(null);
  const [taskDescriptionDraft, setTaskDescriptionDraft] = useState("");

  // ── Remove confirm ────────────────────────────────────────────────────────
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);
  const {
    refetchAssignment,
    assignWorkers,
    removeWorker,
    updateTask,
    setLeader,
    assigning,
  } = useHodWorkerAssignment(complaintId, t);

  useEffect(() => {
    if (complaintId) return;
    Toast.show({
      type: "error",
      text1: t("hod.workerAssignment.toasts.loadFailedTitle"),
      text2: t("hod.workerAssignment.toasts.loadFailedMessage"),
    });
    router.back();
  }, [complaintId, router, t]);

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const data = await refetchAssignment();
      setComplaint(data?.complaint ?? null);
      setAssignedWorkers(data?.assignedWorkers ?? []);
      setAllWorkers(data?.allWorkers ?? []);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("hod.workerAssignment.toasts.loadFailedTitle"),
        text2:
          e?.response?.data?.message ??
          t("hod.workerAssignment.toasts.loadFailedMessage"),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (!complaintId) return undefined;
      load(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [complaintId, t, refetchAssignment]),
  );

  useRealtimeRefresh("complaint-updated", (payload) => {
    if (String(payload?.complaintId || "") !== String(complaintId || "")) {
      return;
    }
    load(false);
  });

  // ── Derived ───────────────────────────────────────────────────────────────
  const assignedIds = useMemo(
    () => new Set(assignedWorkers.map((w) => w.workerId)),
    [assignedWorkers],
  );

  const filteredWorkers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allWorkers.filter((w) => {
      const id = String(w.id ?? w._id ?? "");
      if (assignedIds.has(id)) return false; // already assigned
      if (!q) return true;
      const matchesFullName = String(w.fullName ?? "")
        .toLowerCase()
        .includes(q);
      const matchesUsername = String(w.username ?? "")
        .toLowerCase()
        .includes(q);
      return matchesFullName ? true : matchesUsername;
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
        setSelectedLeaderId((currentLeaderId) => {
          if (currentLeaderId !== workerId) return currentLeaderId;
          const remainingLeaderId = [...next][0];
          return remainingLeaderId ? String(remainingLeaderId) : "";
        });
      } else {
        next.add(workerId);
        setSelectedLeaderId((currentLeaderId) =>
          currentLeaderId ? currentLeaderId : String(workerId),
        );
      }
      return next;
    });
  };

  const openAddWorkersModal = () => {
    setShowAddPanel(true);
    setSearch("");
    setSelected(new Set());
    setSelectedLeaderId("");
    setTaskDescs({});
  };

  const closeAddWorkersModal = () => {
    if (assigning) return;
    setShowAddPanel(false);
    setSearch("");
    setSelected(new Set());
    setSelectedLeaderId("");
    setTaskDescs({});
    setModalKeyboardHeight(0);
  };

  useEffect(() => {
    if (!showAddPanel) return;

    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (event) => {
      const keyboardHeight = event?.endCoordinates?.height ?? 0;
      if (Platform.OS === "android") {
        setModalKeyboardHeight(Math.max(0, keyboardHeight - insets.bottom));
      }
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setModalKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [showAddPanel, insets.bottom]);

  const handleAssign = async () => {
    const ok = await assignWorkers({
      selectedWorkerIds: selected,
      assignedWorkers,
      taskDescs,
      selectedLeaderId,
    });
    if (ok) {
      setSelected(new Set());
      setSelectedLeaderId("");
      setTaskDescs({});
      setShowAddPanel(false);
      await load(true);
    }
  };

  // ── Remove worker ─────────────────────────────────────────────────────────
  const handleRemove = async () => {
    if (!removeTarget) return;
    try {
      setRemoving(true);
      const ok = await removeWorker({ removeTarget, assignedWorkers });
      if (!ok) return;
      await load(true);
    } finally {
      setRemoving(false);
      setRemoveTarget(null);
    }
  };

  // ── Update task description ───────────────────────────────────────────────
  const openUpdateTaskDialog = (worker) => {
    if (!worker?.workerId || updatingWorkerId) return;
    setTaskEditTarget(worker);
    setTaskDescriptionDraft(worker.taskDescription ?? "");
  };

  const closeUpdateTaskDialog = () => {
    if (updatingWorkerId) return;
    setTaskEditTarget(null);
    setTaskDescriptionDraft("");
  };

  const handleUpdateTask = async (inputValue) => {
    if (!taskEditTarget?.workerId) return;
    const nextTaskDescription = String(
      inputValue ?? taskDescriptionDraft ?? "",
    ).trim();

    try {
      setUpdatingWorkerId(taskEditTarget.workerId);
      const ok = await updateTask({
        workerId: taskEditTarget.workerId,
        workerName: taskEditTarget.workerName,
        taskDescription: nextTaskDescription,
      });
      if (!ok) return;
      closeUpdateTaskDialog();
      await load(true);
    } finally {
      setUpdatingWorkerId(null);
    }
  };

  const handleSetLeader = async (worker) => {
    if (!worker?.workerId || worker?.isLeader || assignedWorkers.length < 2) return;
    const ok = await setLeader({
      workerId: worker.workerId,
      assignedWorkers,
      workerName: worker.workerName,
    });
    if (!ok) return;
    await load(true);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View
        className="flex-1"
        style={{ backgroundColor: colors.backgroundPrimary }}
      >
        <BackButtonHeader
          title={t("hod.workerAssignment.title")}
          onBack={() => router.back()}
        />
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
      <BackButtonHeader
        title={t("hod.workerAssignment.title")}
        onBack={() => router.back()}
      />

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
                <View className="flex-row items-center mb-0.5">
                  <Hash size={12} color={colors.textSecondary} />
                  <Text
                    className="text-xs ml-1"
                    style={{ color: colors.textSecondary }}
                  >
                    {complaint.ticketId ??
                      t("hod.workerAssignment.fallbacks.notAvailable")}
                  </Text>
                </View>
                <Text
                  className="text-sm font-semibold"
                  style={{ color: colors.textPrimary }}
                  numberOfLines={2}
                >
                  {complaint.title ??
                    t("hod.workerAssignment.fallbacks.complaint")}
                </Text>
              </View>
              <ComplaintStatusBadge
                status={complaint.status}
                t={t}
                colors={colors}
              />
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
              {t("hod.workerAssignment.assignedWorkersTitle", {
                count: assignedWorkers.length,
              })}
            </Text>
          </View>

          {/* Add Workers toggle */}
          <TouchableOpacity
            onPress={openAddWorkersModal}
            className="flex-row items-center px-3 py-1.5 rounded-full"
            style={{ backgroundColor: colors.primary + "20" }}
          >
            <Plus size={14} color={colors.primary} />
            <Text
              className="text-xs font-semibold ml-1"
              style={{ color: colors.primary }}
            >
              {t("hod.workerAssignment.actions.addWorkers")}
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
                {t("hod.workerAssignment.empty.noAssignedWorkers")}
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
                <WorkerAvatar name={w.workerName} colors={colors} t={t} />
                <View className="flex-1">
                  <View className="mb-1">
                    <View className="flex-row items-center flex-wrap">
                      <Text
                        className="text-sm font-semibold flex-1 mr-2"
                        style={{ color: colors.textPrimary }}
                        numberOfLines={1}
                      >
                        {w.workerName}
                      </Text>
                      {assignedWorkers.length > 1 && w.isLeader ? (
                        <View
                          className="px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: colors.primary + "18" }}
                        >
                          <Text
                            className="text-[10px] font-bold"
                            style={{ color: colors.primary }}
                          >
                            {t("hod.workerAssignment.labels.leader")}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  {!!w.taskDescription && (
                    <Text
                      className="text-xs mb-1"
                      style={{ color: colors.textSecondary }}
                      numberOfLines={2}
                    >
                      {t("hod.workerAssignment.labels.task", {
                        value: w.taskDescription,
                      })}
                    </Text>
                  )}

                  {!!w.notes && (
                    <Text
                      className="text-xs mb-2"
                      style={{ color: colors.textSecondary }}
                      numberOfLines={2}
                    >
                      {t("hod.workerAssignment.labels.notes", {
                        value: w.notes,
                      })}
                    </Text>
                  )}

                  <View className="flex-row mt-1">
                    {assignedWorkers.length > 1 && !w.isLeader ? (
                      <TouchableOpacity
                        onPress={() => handleSetLeader(w)}
                        disabled={assigning}
                        className="flex-row items-center px-3 py-1.5 rounded-lg mr-2"
                        style={{ backgroundColor: colors.warning + "20" }}
                      >
                        <Text
                          className="text-xs font-semibold"
                          style={{ color: colors.warning }}
                        >
                          {t("hod.workerAssignment.actions.makeLeader")}
                        </Text>
                      </TouchableOpacity>
                    ) : null}

                    <TouchableOpacity
                      onPress={() => openUpdateTaskDialog(w)}
                      disabled={Boolean(updatingWorkerId)}
                      className="flex-row items-center px-3 py-1.5 rounded-lg mr-2"
                      style={{
                        backgroundColor: colors.primary + "20",
                        opacity:
                          updatingWorkerId && updatingWorkerId !== w.workerId
                            ? 0.6
                            : 1,
                      }}
                    >
                      {updatingWorkerId === w.workerId ? (
                        <ActivityIndicator
                          size="small"
                          color={colors.primary}
                        />
                      ) : (
                        <>
                          <Briefcase size={13} color={colors.primary} />
                          <Text
                            className="text-xs font-semibold ml-1"
                            style={{ color: colors.primary }}
                          >
                            {t("hod.workerAssignment.actions.updateTask")}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setRemoveTarget(w)}
                      className="flex-row items-center px-3 py-1.5 rounded-lg"
                      style={{ backgroundColor: colors.danger + "20" }}
                    >
                      <Trash2 size={13} color={colors.danger} />
                      <Text
                        className="text-xs font-semibold ml-1"
                        style={{ color: colors.danger }}
                      >
                        {t("hod.workerAssignment.actions.remove")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* ── Add Workers Modal ─────────────────────────────────────────────── */}
      <Modal
        visible={showAddPanel}
        transparent
        animationType="slide"
        onRequestClose={closeAddWorkersModal}
      >
        <View
          className="flex-1 px-4"
          style={{
            backgroundColor: colors.dark + "80",
            justifyContent: "center",
            paddingTop: Math.max(insets.top, 16),
            paddingBottom:
              Math.max(insets.bottom, 16) +
              (Platform.OS === "android" ? modalKeyboardHeight : 0),
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={0}
            style={{ width: "100%" }}
          >
            <View
              style={{
                backgroundColor: colors.backgroundPrimary,
                borderRadius: 24,
                maxHeight: "90%",
                overflow: "hidden",
              }}
            >
              <View className="px-4 pt-4 pb-3" style={{ flexShrink: 1 }}>
                <View className="flex-row items-center mb-3">
                  <Users size={16} color={colors.primary} />
                  <Text
                    className="text-sm font-semibold ml-2"
                    style={{ color: colors.textPrimary }}
                  >
                    {t("hod.workerAssignment.actions.addWorkers")}
                  </Text>
                  <TouchableOpacity
                    onPress={closeAddWorkersModal}
                    disabled={assigning}
                    className="ml-auto"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <SearchBar
                  value={search}
                  onChangeText={setSearch}
                  placeholder={t("hod.workerAssignment.searchPlaceholder")}
                  style={{ marginBottom: 12 }}
                />

                <View style={{ flexShrink: 1, minHeight: 0 }}>
                  <ScrollView
                    ref={modalScrollRef}
                    style={{ flexGrow: 0 }}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    contentContainerStyle={{
                      paddingBottom: selected.size > 0 ? 40 : 20,
                    }}
                  >
                    {filteredWorkers.length === 0 ? (
                      <Text
                        className="text-sm text-center py-4"
                        style={{ color: colors.textSecondary }}
                      >
                        {allWorkers.length === 0
                          ? t("hod.workerAssignment.empty.noDepartmentWorkers")
                          : t("hod.workerAssignment.empty.allAssigned")}
                      </Text>
                    ) : (
                      filteredWorkers.map((w) => {
                        const id = String(w.id ?? w._id ?? "");
                        const isSelected = selected.has(id);
                        const isLeader = selectedLeaderId === id;
                        const workerName = getWorkerDisplayName(w, t);

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
                                    : undefined,
                                }}
                              >
                                {isSelected && (
                                  <CheckCircle size={14} color={colors.light} />
                                )}
                              </View>
                              <WorkerAvatar
                                name={workerName}
                                colors={colors}
                                t={t}
                              />
                              <View className="flex-1">
                                <Text
                                  className="text-sm font-semibold"
                                  style={{ color: colors.textPrimary }}
                                >
                                  {workerName}
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

                            {isSelected && (
                              <View className="mb-2 ml-11">
                                {selected.size > 1 && assignedWorkers.length === 0 ? (
                                  <TouchableOpacity
                                    onPress={() => setSelectedLeaderId(id)}
                                    className="self-start px-3 py-1.5 rounded-lg mb-2"
                                    style={{
                                      backgroundColor: isLeader
                                        ? colors.primary + "22"
                                        : colors.backgroundSecondary,
                                      borderWidth: 1,
                                      borderColor: isLeader
                                        ? colors.primary
                                        : colors.border,
                                    }}
                                  >
                                    <Text
                                      className="text-xs font-semibold"
                                      style={{
                                        color: isLeader
                                          ? colors.primary
                                          : colors.textSecondary,
                                      }}
                                    >
                                      {isLeader
                                        ? t("hod.workerAssignment.labels.selectedLeader")
                                        : t("hod.workerAssignment.actions.makeLeader")}
                                    </Text>
                                  </TouchableOpacity>
                                ) : null}

                                <PaperTextInput
                                  mode="outlined"
                                  dense
                                  outlineColor={colors.border}
                                  activeOutlineColor={colors.primary}
                                  textColor={colors.textPrimary}
                                  placeholderTextColor={colors.textSecondary}
                                  style={{
                                    backgroundColor: colors.backgroundSecondary,
                                    height: 44,
                                    fontSize: 14,
                                  }}
                                  contentStyle={{
                                    fontSize: 14,
                                    paddingVertical: 4,
                                  }}
                                  theme={{ roundness: 10 }}
                                  placeholder={t(
                                    "hod.workerAssignment.taskDescriptionPlaceholder",
                                    { name: workerName },
                                  )}
                                  value={taskDescs[id] ?? ""}
                                  onFocus={() => {
                                    setTimeout(() => {
                                      modalScrollRef.current?.scrollToEnd({
                                        animated: true,
                                      });
                                    }, 120);
                                  }}
                                  onChangeText={(v) =>
                                    setTaskDescs((prev) => ({
                                      ...prev,
                                      [id]: v,
                                    }))
                                  }
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
                  </ScrollView>
                </View>

                {selected.size > 0 && (
                  <TouchableOpacity
                    onPress={handleAssign}
                    disabled={assigning}
                    className="flex-row items-center justify-center py-3 rounded-xl mt-4"
                    style={{
                      backgroundColor: assigning
                        ? colors.border
                        : colors.primary,
                    }}
                  >
                    {assigning ? (
                      <ActivityIndicator size="small" color={colors.light} />
                    ) : (
                      <>
                        <CheckCircle size={16} color={colors.light} />
                        <Text
                          className="text-sm font-semibold ml-2"
                          style={{ color: colors.light }}
                        >
                          {t("hod.workerAssignment.actions.assignCount", {
                            count: selected.size,
                            plural: selected.size > 1 ? "s" : "",
                          })}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <DialogBox
        visible={!!taskEditTarget}
        title={t("hod.workerAssignment.actions.updateTask")}
        message={taskEditTarget?.workerName || ""}
        showInput
        inputPlaceholder={t("hod.workerAssignment.taskDescriptionPlaceholder", {
          name:
            taskEditTarget?.workerName ??
            t("hod.workerAssignment.fallbacks.worker"),
        })}
        inputValue={taskDescriptionDraft}
        onInputChange={setTaskDescriptionDraft}
        confirmText={t("hod.workerAssignment.actions.saveChanges")}
        cancelText={t("hod.workerAssignment.actions.cancel")}
        onConfirm={handleUpdateTask}
        onCancel={closeUpdateTaskDialog}
        onClose={closeUpdateTaskDialog}
        loading={Boolean(updatingWorkerId)}
      />

      {/* ── Remove Confirm ─────────────────────────────────────────────────────── */}
      <DialogBox
        visible={!!removeTarget}
        title={t("hod.workerAssignment.removeDialog.title")}
        message={t("hod.workerAssignment.removeDialog.message", {
          name:
            removeTarget?.workerName ??
            t("hod.workerAssignment.fallbacks.worker"),
        })}
        confirmText={
          removing
            ? t("hod.workerAssignment.removeDialog.removing")
            : t("hod.workerAssignment.actions.remove")
        }
        cancelText={t("hod.workerAssignment.removeDialog.keep")}
        onConfirm={handleRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </KeyboardAvoidingView>
  );
}
