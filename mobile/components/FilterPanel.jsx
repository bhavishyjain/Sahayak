import { Calendar, ChevronRight, Filter, X } from "lucide-react-native";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { darkColors, lightColors } from "../colors";
import DateTimePickerModal from "./DateTimePickerModal";
import { useTheme } from "../utils/context/theme";
import { useState } from "react";
import {
  formatStatusLabel,
  ALL_STATUS_OPTIONS,
} from "../utils/complaintFormatters";

function FilterChip({ label, isActive, onPress, colors }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center px-3 py-1.5 rounded-xl border"
      style={{
        borderColor: isActive ? colors.primary : colors.border,
        backgroundColor: isActive ? colors.primary + "22" : "transparent",
      }}
    >
      <Text
        className="text-xs font-semibold"
        style={{ color: isActive ? colors.primary : colors.textPrimary }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function FilterPanel({
  // variant: "icon" (circular button) | "bar" (full-width row)
  variant = "icon",
  summary = "",
  statusOptions = ALL_STATUS_OPTIONS,
  statusFilter,
  setStatusFilter,
  departmentFilter,
  setDepartmentFilter,
  priorityFilter,
  setPriorityFilter,
  sortOrder,
  setSortOrder,
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  hasActiveFilters,
  onClearFilters,
  t,
  formatPriorityLabel,
  style,
}) {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const [visible, setVisible] = useState(false);
  const [applying, setApplying] = useState(false);

  // Draft state — local until Apply is pressed
  const [draftStatus, setDraftStatus] = useState(statusFilter);
  const [draftDepartment, setDraftDepartment] = useState(
    departmentFilter || "all",
  );
  const [draftPriority, setDraftPriority] = useState(priorityFilter);
  const [draftSort, setDraftSort] = useState(sortOrder);
  const [draftStart, setDraftStart] = useState(startDate);
  const [draftEnd, setDraftEnd] = useState(endDate);

  const openPanel = () => {
    setDraftStatus(statusFilter);
    setDraftDepartment(departmentFilter || "all");
    setDraftPriority(priorityFilter);
    setDraftSort(sortOrder);
    setDraftStart(startDate);
    setDraftEnd(endDate);
    setVisible(true);
  };

  const handleReset = () => {
    setDraftStatus("all");
    setDraftDepartment("all");
    setDraftPriority("all");
    setDraftSort("new-to-old");
    setDraftStart("");
    setDraftEnd("");
  };

  const handleApply = () => {
    setApplying(true);
    setTimeout(() => {
      setStatusFilter(draftStatus);
      if (setDepartmentFilter) setDepartmentFilter(draftDepartment);
      if (setPriorityFilter) setPriorityFilter(draftPriority);
      if (setSortOrder) setSortOrder(draftSort);
      setStartDate(draftStart);
      setEndDate(draftEnd);
      setApplying(false);
      setVisible(false);
    }, 300);
  };

  const trigger =
    variant === "bar" ? (
      <TouchableOpacity
        onPress={openPanel}
        className="rounded-2xl p-4 flex-row items-center justify-between"
        style={{
          backgroundColor: hasActiveFilters
            ? colors.primary + "20"
            : colors.backgroundSecondary,
          borderWidth: 1,
          borderColor: hasActiveFilters ? colors.primary : colors.border,
          ...style,
        }}
      >
        <View className="flex-row items-center flex-1">
          <Filter
            size={20}
            color={hasActiveFilters ? colors.primary : colors.textSecondary}
          />
          <View className="ml-3 flex-1">
            <Text
              className="text-sm font-semibold"
              style={{
                color: hasActiveFilters ? colors.primary : colors.textPrimary,
              }}
            >
              {hasActiveFilters ? t("filters.applied") : t("filters.add")}
            </Text>
            {hasActiveFilters && summary ? (
              <Text className="text-xs" style={{ color: colors.textSecondary }}>
                {summary}
              </Text>
            ) : null}
          </View>
        </View>
        <ChevronRight
          size={18}
          color={hasActiveFilters ? colors.primary : colors.textSecondary}
        />
      </TouchableOpacity>
    ) : (
      <TouchableOpacity
        onPress={openPanel}
        className="flex-row items-center justify-center w-10 h-10 rounded-full"
        style={{
          backgroundColor: hasActiveFilters
            ? colors.primary + "20"
            : colors.backgroundSecondary,
          borderWidth: 1.5,
          borderColor: hasActiveFilters ? colors.primary : colors.border,
          ...style,
        }}
      >
        <Filter
          size={18}
          color={hasActiveFilters ? colors.primary : colors.textSecondary}
        />
      </TouchableOpacity>
    );

  return (
    <>
      {trigger}

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable
          className="flex-1 justify-end"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
          onPress={() => setVisible(false)}
        >
          <Pressable
            className="rounded-t-3xl"
            style={{ backgroundColor: colors.backgroundPrimary }}
            onPress={() => {}}
          >
            <SafeAreaView edges={["bottom"]}>
              <View className="p-5">
                {/* Header */}
                <View className="flex-row items-center justify-between mb-3">
                  <Text
                    className="text-base font-bold"
                    style={{ color: colors.textPrimary }}
                  >
                    {t("common.filters")}
                  </Text>
                  <TouchableOpacity onPress={() => setVisible(false)}>
                    <X size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View
                  className="h-[1px] mb-3"
                  style={{ backgroundColor: colors.border }}
                />

                {/* Status */}
                {statusOptions.length > 0 && (
                  <>
                    <Text
                      className="text-xs font-semibold mb-2"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("hod.complaints.filters.status")}
                    </Text>
                    <View
                      className="flex-row flex-wrap mb-3"
                      style={{ gap: 6 }}
                    >
                      {["all", ...statusOptions].map((s) => (
                        <FilterChip
                          key={s}
                          label={
                            s === "all"
                              ? t("common.all")
                              : formatStatusLabel(t, s)
                          }
                          isActive={draftStatus === s}
                          onPress={() => setDraftStatus(s)}
                          colors={colors}
                        />
                      ))}
                    </View>
                  </>
                )}

                {/* Department — only shown when setter provided */}
                {setDepartmentFilter && (
                  <>
                    <Text
                      className="text-xs font-semibold mb-2"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("complaints.details.department")}
                    </Text>
                    <View
                      className="flex-row flex-wrap mb-3"
                      style={{ gap: 6 }}
                    >
                      {[
                        { value: "all", label: t("common.all") },
                        {
                          value: "Road",
                          label: t("complaints.departments.road"),
                        },
                        {
                          value: "Water",
                          label: t("complaints.departments.water"),
                        },
                        {
                          value: "Electricity",
                          label: t("complaints.departments.electricity"),
                        },
                        {
                          value: "Waste",
                          label: t("complaints.departments.waste"),
                        },
                        {
                          value: "Drainage",
                          label: t("complaints.departments.drainage"),
                        },
                        {
                          value: "Other",
                          label: t("complaints.departments.other"),
                        },
                      ].map((department) => (
                        <FilterChip
                          key={department.value}
                          label={department.label}
                          isActive={draftDepartment === department.value}
                          onPress={() => setDraftDepartment(department.value)}
                          colors={colors}
                        />
                      ))}
                    </View>
                  </>
                )}

                {/* Priority — only shown when setter provided */}
                {setPriorityFilter && (
                  <>
                    <Text
                      className="text-xs font-semibold mb-2"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("hod.complaints.filters.priority")}
                    </Text>
                    <View
                      className="flex-row flex-wrap mb-3"
                      style={{ gap: 6 }}
                    >
                      {["all", "high", "medium", "low"].map((priority) => (
                        <FilterChip
                          key={priority}
                          label={
                            priority === "all"
                              ? t("common.all")
                              : formatPriorityLabel(t, priority)
                          }
                          isActive={draftPriority === priority}
                          onPress={() => setDraftPriority(priority)}
                          colors={colors}
                        />
                      ))}
                    </View>
                  </>
                )}

                {/* Sort — only shown when setter provided */}
                {setSortOrder && (
                  <>
                    <Text
                      className="text-xs font-semibold mb-2"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("common.sort")}
                    </Text>
                    <View className="flex-row mb-3" style={{ gap: 6 }}>
                      <FilterChip
                        label={t("worker.assigned.newToOld")}
                        isActive={draftSort === "new-to-old"}
                        onPress={() => setDraftSort("new-to-old")}
                        colors={colors}
                      />
                      <FilterChip
                        label={t("worker.assigned.oldToNew")}
                        isActive={draftSort === "old-to-new"}
                        onPress={() => setDraftSort("old-to-new")}
                        colors={colors}
                      />
                    </View>
                  </>
                )}

                {/* Date Range */}
                <Text
                  className="text-xs font-semibold mb-2"
                  style={{ color: colors.textSecondary }}
                >
                  {t("hod.complaints.filters.dateRange")}
                </Text>
                <View className="flex-row mb-5" style={{ gap: 8 }}>
                  <View className="flex-1">
                    <DateTimePickerModal
                      mode="date"
                      value={draftStart}
                      onChange={setDraftStart}
                      icon={Calendar}
                      placeholder={t("hod.complaints.filters.startDate")}
                      maxDateToday={true}
                      containerStyle={{ marginBottom: 0, height: 44 }}
                    />
                  </View>
                  <View className="flex-1">
                    <DateTimePickerModal
                      mode="date"
                      value={draftEnd}
                      onChange={setDraftEnd}
                      icon={Calendar}
                      placeholder={t("hod.complaints.filters.endDate")}
                      maxDateToday={true}
                      containerStyle={{ marginBottom: 0, height: 44 }}
                    />
                  </View>
                </View>

                {/* Action buttons */}
                <View className="flex-row" style={{ gap: 10 }}>
                  <TouchableOpacity
                    onPress={handleReset}
                    className="flex-1 py-3 rounded-2xl items-center"
                    style={{
                      backgroundColor: colors.backgroundSecondary,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("common.reset")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleApply}
                    disabled={applying}
                    className="flex-1 py-3 rounded-2xl items-center"
                    style={{
                      backgroundColor: colors.primary,
                      opacity: applying ? 0.8 : 1,
                    }}
                  >
                    {applying ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text
                        className="text-sm font-bold"
                        style={{ color: "#fff" }}
                      >
                        {t("common.apply")}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
