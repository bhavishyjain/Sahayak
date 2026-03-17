import { useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import apiCall from "../api";
import useApiMutation from "./useApiMutation";
import { queryKeys } from "../queryKeys";
import {
  GET_COMPLAINT_BY_ID_URL,
  HOD_ASSIGN_MULTIPLE_WORKERS_URL,
  HOD_GET_COMPLAINT_WORKERS_URL,
  HOD_UPDATE_WORKER_TASK_URL,
  HOD_WORKERS_URL,
} from "../../url";
import { invalidateComplaintQueries } from "../invalidateComplaintQueries";

function getWorkerName(worker, t) {
  return (
    worker?.fullName ??
    worker?.username ??
    worker?.workerName ??
    worker?.workerId?.fullName ??
    worker?.workerId?.username ??
    t("hod.workerAssignment.fallbacks.worker")
  );
}

export function useHodWorkerAssignment(complaintId, t) {
  const queryClient = useQueryClient();

  const refetchAssignment = async () => {
    const [complainRes, workersRes, allWorkersRes] = await Promise.all([
      queryClient.fetchQuery({
        queryKey: [...queryKeys.hodWorkerAssignment(complaintId), "complaint"],
        queryFn: async () =>
          apiCall({ method: "GET", url: GET_COMPLAINT_BY_ID_URL(complaintId) }),
      }),
      queryClient.fetchQuery({
        queryKey: [...queryKeys.hodWorkerAssignment(complaintId), "workers"],
        queryFn: async () =>
          apiCall({
            method: "GET",
            url: HOD_GET_COMPLAINT_WORKERS_URL(complaintId),
          }),
      }),
      queryClient.fetchQuery({
        queryKey: [...queryKeys.hodWorkerAssignment(complaintId), "all-workers"],
        queryFn: async () => apiCall({ method: "GET", url: HOD_WORKERS_URL }),
      }),
    ]);

    return {
      complaint: complainRes?.data?.complaint ?? null,
      assignedWorkers: (workersRes?.data?.workers ?? []).map((w) => ({
        workerId: String(w.workerId?._id ?? w.workerId ?? w._id ?? ""),
        workerName: getWorkerName(w, t),
        taskDescription: w.taskDescription ?? "",
        status: w.status ?? "assigned",
        isLeader: Boolean(w.isLeader),
        notes: w.notes ?? "",
        assignedAt: w.assignedAt,
        completedAt: w.completedAt,
      })),
      allWorkers: allWorkersRes?.data?.workers ?? [],
    };
  };

  const assignMutation = useApiMutation({ method: "POST" });
  const updateTaskMutation = useApiMutation({ method: "PUT" });

  const assignWorkers = async ({ selectedWorkerIds, assignedWorkers, taskDescs }) => {
    if (selectedWorkerIds.size === 0) {
      Toast.show({
        type: "error",
        text1: t("hod.workerAssignment.toasts.selectWorker"),
      });
      return false;
    }

    const existingWorkers = assignedWorkers.map((w) => ({
      workerId: w.workerId,
      taskDescription: w.taskDescription ?? "",
    }));
    const newWorkers = [...selectedWorkerIds].map((id) => ({
      workerId: id,
      taskDescription: taskDescs[id] ?? "",
    }));

    try {
      await assignMutation.mutateAsync({
        urlOverride: HOD_ASSIGN_MULTIPLE_WORKERS_URL(complaintId),
        data: { workers: [...existingWorkers, ...newWorkers] },
      });
      Toast.show({
        type: "success",
        text1: t("hod.workerAssignment.toasts.assignSuccessTitle"),
        text2: t("hod.workerAssignment.toasts.assignSuccessMessage", {
          count: selectedWorkerIds.size,
          plural: selectedWorkerIds.size > 1 ? "s" : "",
        }),
      });
      await invalidateComplaintQueries(queryClient, { complaintId });
      return true;
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("hod.workerAssignment.toasts.assignFailedTitle"),
        text2:
          e?.response?.data?.message ??
          t("hod.workerAssignment.toasts.assignFailedMessage"),
      });
      return false;
    }
  };

  const removeWorker = async ({ removeTarget, assignedWorkers }) => {
    if (!removeTarget?.workerId) return false;
    const remaining = assignedWorkers
      .filter((w) => w.workerId !== removeTarget.workerId)
      .map((w) => ({
        workerId: w.workerId,
        taskDescription: w.taskDescription ?? "",
      }));

    try {
      await assignMutation.mutateAsync({
        urlOverride: HOD_ASSIGN_MULTIPLE_WORKERS_URL(complaintId),
        data: { workers: remaining },
      });
      Toast.show({
        type: "success",
        text1: t("hod.workerAssignment.toasts.removeSuccessTitle"),
      });
      await invalidateComplaintQueries(queryClient, { complaintId });
      return true;
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("hod.workerAssignment.toasts.removeFailedTitle"),
        text2:
          e?.response?.data?.message ??
          t("hod.workerAssignment.toasts.removeFailedMessage"),
      });
      return false;
    }
  };

  const updateTask = async ({ workerId, taskDescription, workerName }) => {
    if (!workerId) return false;
    try {
      await updateTaskMutation.mutateAsync({
        urlOverride: HOD_UPDATE_WORKER_TASK_URL(complaintId, workerId),
        data: { taskDescription },
      });
      Toast.show({
        type: "success",
        text1: t("hod.workerAssignment.toasts.updateSuccessTitle"),
        text2: t("hod.workerAssignment.toasts.updateSuccessMessage", {
          name: workerName,
        }),
      });
      await invalidateComplaintQueries(queryClient, { complaintId });
      return true;
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("hod.workerAssignment.toasts.updateFailedTitle"),
        text2:
          e?.response?.data?.message ??
          t("hod.workerAssignment.toasts.updateFailedMessage"),
      });
      return false;
    }
  };

  return {
    refetchAssignment,
    assignWorkers,
    removeWorker,
    updateTask,
    assigning: assignMutation.isPending,
    updatingTask: updateTaskMutation.isPending,
  };
}
