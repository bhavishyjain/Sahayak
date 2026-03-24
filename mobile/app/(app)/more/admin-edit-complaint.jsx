import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { TextInput as PaperTextInput } from "react-native-paper";
import Toast from "react-native-toast-message";
import { Search, FilePenLine, Trash2 } from "lucide-react-native";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import PressableBlock from "../../../components/PressableBlock";
import { formatStatusLabel } from "../../../data/complaintStatus";
import apiCall from "../../../utils/api";
import { useTheme } from "../../../utils/context/theme";
import useDepartments from "../../../utils/hooks/useDepartments";
import {
  ADMIN_COMPLAINT_DETAIL_URL,
  GET_MY_COMPLAINTS_URL,
} from "../../../url";

function DetailRow({ label, value, colors }) {
  return (
    <View className="mb-3">
      <Text className="text-xs" style={{ color: colors.textSecondary }}>
        {label}
      </Text>
      <Text className="text-sm mt-1" style={{ color: colors.textPrimary }}>
        {value || "-"}
      </Text>
    </View>
  );
}

function SimpleInput({
  value,
  onChangeText,
  placeholder,
  colors,
  multiline = false,
}) {
  return (
    <PaperTextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      mode="flat"
      multiline={multiline}
      underlineStyle={{ display: "none" }}
      style={{
        backgroundColor: colors.backgroundPrimary,
        borderWidth: 1,
        borderColor: colors.border,
        color: colors.textPrimary,
        minHeight: multiline ? 120 : 48,
        borderRadius: 12,
        textAlignVertical: multiline ? "top" : "center",
      }}
      contentStyle={{
        color: colors.textPrimary,
        fontSize: 14,
        paddingHorizontal: 16,
        paddingVertical: multiline ? 12 : 10,
      }}
      theme={{
        colors: {
          text: colors.textPrimary,
          placeholder: colors.textSecondary,
        },
        roundness: 12,
      }}
    />
  );
}

export default function AdminEditComplaintScreen() {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const { departmentOptions } = useDepartments();

  const [ticketId, setTicketId] = useState("");
  const [complaint, setComplaint] = useState(null);
  const [department, setDepartment] = useState("");
  const [priority, setPriority] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const priorityOptions = useMemo(() => ["Low", "Medium", "High"], []);

  const handleSearch = async () => {
    const nextTicketId = ticketId.trim();
    if (!nextTicketId) {
      Toast.show({
        type: "error",
        text1: "Complaint ID required",
        text2: "Enter a complaint ID before searching.",
      });
      return;
    }

    try {
      setSearching(true);
      const response = await apiCall({
        method: "GET",
        url: GET_MY_COMPLAINTS_URL,
        params: {
          scope: "all",
          ticketId: nextTicketId,
          limit: 1,
          page: 1,
        },
      });

      const item = response?.data?.complaints?.[0];
      if (!item) {
        setComplaint(null);
        setDepartment("");
        setPriority("");
        Toast.show({
          type: "error",
          text1: "Complaint not found",
          text2: "No complaint was found for that complaint ID.",
        });
        return;
      }

      setComplaint(item);
      setDepartment(item.department || "");
      setPriority(item.priority || "");
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Search failed",
        text2: error?.response?.data?.message || "Please try again.",
      });
    } finally {
      setSearching(false);
    }
  };

  const handleSave = async () => {
    if (!complaint?._id && !complaint?.id) return;
    if (!department || !priority) {
      Toast.show({
        type: "error",
        text1: "Missing details",
        text2: "Choose both a department and priority.",
      });
      return;
    }

    try {
      setSaving(true);
      await apiCall({
        method: "PUT",
        url: ADMIN_COMPLAINT_DETAIL_URL(complaint._id || complaint.id),
        data: {
          department,
          priority,
        },
      });
      setComplaint((previous) =>
        previous
          ? {
              ...previous,
              department,
              priority,
            }
          : previous,
      );
      Toast.show({
        type: "success",
        text1: "Complaint updated",
        text2: "Priority and department were saved.",
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Could not update complaint",
        text2: error?.response?.data?.message || "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!complaint?._id && !complaint?.id) return;

    try {
      setDeleting(true);
      await apiCall({
        method: "DELETE",
        url: ADMIN_COMPLAINT_DETAIL_URL(complaint._id || complaint.id),
      });
      Toast.show({
        type: "success",
        text1: "Complaint deleted",
        text2: "The complaint was soft-deleted successfully.",
      });
      setComplaint(null);
      setTicketId("");
      setDepartment("");
      setPriority("");
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Could not delete complaint",
        text2: error?.response?.data?.message || "Please try again.",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader title="Edit Complaint" />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          className="rounded-2xl p-4 mb-4"
          style={{
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View className="flex-row items-center mb-3">
            <View
              className="w-11 h-11 rounded-2xl items-center justify-center mr-3"
              style={{ backgroundColor: colors.primary + "18" }}
            >
              <Search size={18} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text
                className="text-base font-semibold"
                style={{ color: colors.textPrimary }}
              >
                Search complaint
              </Text>
              <Text
                className="text-xs mt-1"
                style={{ color: colors.textSecondary }}
              >
                Search by complaint ID only.
              </Text>
            </View>
          </View>

          <SimpleInput
            value={ticketId}
            onChangeText={setTicketId}
            placeholder="Complaint ID"
            colors={colors}
          />

          <PressableBlock
            onPress={handleSearch}
            disabled={searching}
            className="rounded-2xl py-4 items-center mt-4"
            style={{
              backgroundColor: searching ? colors.border : colors.primary,
            }}
          >
            <Text
              className="text-sm font-semibold"
              style={{ color: colors.dark }}
            >
              {searching ? "Searching..." : "Search Complaint"}
            </Text>
          </PressableBlock>
        </View>

        {complaint ? (
          <View
            className="rounded-2xl p-4"
            style={{
              backgroundColor: colors.backgroundSecondary,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View className="flex-row items-center mb-4">
              <View
                className="w-11 h-11 rounded-2xl items-center justify-center mr-3"
                style={{ backgroundColor: colors.info + "18" }}
              >
                <FilePenLine size={18} color={colors.info} />
              </View>
              <View className="flex-1">
                <Text
                  className="text-base font-semibold"
                  style={{ color: colors.textPrimary }}
                >
                  Complaint details
                </Text>
                <Text
                  className="text-xs mt-1"
                  style={{ color: colors.textSecondary }}
                >
                  Edit the department or priority, or delete the complaint.
                </Text>
              </View>
            </View>

            <DetailRow
              label="Complaint ID"
              value={complaint.ticketId}
              colors={colors}
            />
            <DetailRow
              label="Status"
              value={formatStatusLabel(undefined, complaint.status)}
              colors={colors}
            />

            <Text
              className="text-xs mb-2"
              style={{ color: colors.textSecondary }}
            >
              Department
            </Text>
            <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
              {departmentOptions.map((item) => (
                <PressableBlock
                  key={item.value}
                  onPress={() => setDepartment(item.value)}
                  className="px-3 py-2 rounded-xl"
                  style={{
                    backgroundColor:
                      department === item.value
                        ? colors.primary + "20"
                        : colors.backgroundPrimary,
                    borderWidth: 1,
                    borderColor:
                      department === item.value
                        ? colors.primary
                        : colors.border,
                  }}
                >
                  <Text
                    className="text-xs font-semibold"
                    style={{
                      color:
                        department === item.value
                          ? colors.primary
                          : colors.textPrimary,
                    }}
                  >
                    {item.label}
                  </Text>
                </PressableBlock>
              ))}
            </View>

            <Text
              className="text-xs mb-2"
              style={{ color: colors.textSecondary }}
            >
              Priority
            </Text>
            <View className="flex-row mb-5" style={{ gap: 8 }}>
              {priorityOptions.map((item) => (
                <PressableBlock
                  key={item}
                  onPress={() => setPriority(item)}
                  className="px-4 py-2 rounded-xl"
                  style={{
                    backgroundColor:
                      priority === item
                        ? colors.primary + "20"
                        : colors.backgroundPrimary,
                    borderWidth: 1,
                    borderColor:
                      priority === item ? colors.primary : colors.border,
                  }}
                >
                  <Text
                    className="text-xs font-semibold"
                    style={{
                      color:
                        priority === item ? colors.primary : colors.textPrimary,
                    }}
                  >
                    {item}
                  </Text>
                </PressableBlock>
              ))}
            </View>

            <PressableBlock
              onPress={handleSave}
              disabled={saving}
              className="rounded-2xl py-4 items-center mb-3"
              style={{
                backgroundColor: saving ? colors.border : colors.primary,
              }}
            >
              <Text
                className="text-sm font-semibold"
                style={{ color: colors.dark }}
              >
                {saving ? "Saving..." : "Save Changes"}
              </Text>
            </PressableBlock>

            <PressableBlock
              onPress={handleDelete}
              disabled={deleting}
              className="rounded-2xl py-4 items-center"
              style={{
                backgroundColor: colors.danger,
                opacity: deleting ? 0.7 : 1,
              }}
            >
              <View className="flex-row items-center">
                <Trash2 size={16} color={colors.light} />
                <Text
                  className="text-sm font-semibold ml-2"
                  style={{ color: colors.light }}
                >
                  {deleting ? "Deleting..." : "Delete Complaint"}
                </Text>
              </View>
            </PressableBlock>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
