import { useCallback } from "react";
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

function normalizeLeaderId(value) {
  return String(value || "").trim();
}

function buildAssignmentPayload({
  existingWorkers = [],
  newWorkerIds = [],
  taskDescs = {},
  selectedLeaderId = "",
}) {
  const normalizedSelectedLeaderId = normalizeLeaderId(selectedLeaderId);
  const currentLeaderId =
    existingWorkers.find((worker) => worker?.isLeader)?.workerId ?? "";
  const fallbackLeaderId =
    currentLeaderId || String(newWorkerIds[0] || "").trim() || "";
  const leaderId = normalizedSelectedLeaderId || fallbackLeaderId;

  const existingPayload = existingWorkers.map((worker) => ({
    workerId: worker.workerId,
    taskDescription: worker.taskDescription ?? "",
    isLeader: worker.workerId === leaderId,
  }));

  const newPayload = newWorkerIds.map((id) => ({
    workerId: id,
    taskDescription: taskDescs[id] ?? "",
    isLeader: String(id) === leaderId,
  }));

  return [...existingPayload, ...newPayload];
}

export function useHodWorkerAssignment(complaintId, t) {
  const queryClient = useQueryClient();

  const refetchAssignment = useCallback(async () => {
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
  }, [complaintId, queryClient, t]);

  const assignMutation = useApiMutation({ method: "POST" });
  const updateTaskMutation = useApiMutation({ method: "PUT" });

  const assignWorkers = useCallback(
    async ({
      selectedWorkerIds,
      assignedWorkers,
      taskDescs,
      selectedLeaderId,
    }) => {
      if (selectedWorkerIds.size === 0) {
        Toast.show({
          type: "error",
          text1: t("hod.workerAssignment.toasts.selectWorker"),
        });
        return false;
      }

      try {
        await assignMutation.mutateAsync({
          urlOverride: HOD_ASSIGN_MULTIPLE_WORKERS_URL(complaintId),
          data: {
            workers: buildAssignmentPayload({
              existingWorkers: assignedWorkers,
              newWorkerIds: [...selectedWorkerIds],
              taskDescs,
              selectedLeaderId,
            }),
          },
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
    },
    [assignMutation, complaintId, queryClient, t],
  );

  const removeWorker = useCallback(
    async ({ removeTarget, assignedWorkers }) => {
      if (!removeTarget?.workerId) return false;
      const remainingWorkers = assignedWorkers.filter(
        (w) => w.workerId !== removeTarget.workerId,
      );

      try {
        await assignMutation.mutateAsync({
          urlOverride: HOD_ASSIGN_MULTIPLE_WORKERS_URL(complaintId),
          data: {
            workers: buildAssignmentPayload({
              existingWorkers: remainingWorkers,
            }),
          },
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
    },
    [assignMutation, complaintId, queryClient, t],
  );

  const updateTask = useCallback(
    async ({ workerId, taskDescription, workerName }) => {
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
    },
    [complaintId, queryClient, t, updateTaskMutation],
  );

  const setLeader = useCallback(
    async ({ workerId, assignedWorkers, workerName }) => {
      if (!workerId || !Array.isArray(assignedWorkers) || assignedWorkers.length === 0) {
        return false;
      }

      try {
        await assignMutation.mutateAsync({
          urlOverride: HOD_ASSIGN_MULTIPLE_WORKERS_URL(complaintId),
          data: {
            workers: buildAssignmentPayload({
              existingWorkers: assignedWorkers,
              selectedLeaderId: workerId,
            }),
          },
        });
        Toast.show({
          type: "success",
          text1: t("hod.workerAssignment.toasts.leaderUpdatedTitle"),
          text2: t("hod.workerAssignment.toasts.leaderUpdatedMessage", {
            name: workerName,
          }),
        });
        await invalidateComplaintQueries(queryClient, { complaintId });
        return true;
      } catch (e) {
        Toast.show({
          type: "error",
          text1: t("hod.workerAssignment.toasts.leaderUpdatedFailedTitle"),
          text2:
            e?.response?.data?.message ??
            t("hod.workerAssignment.toasts.leaderUpdatedFailedMessage"),
        });
        return false;
      }
    },
    [assignMutation, complaintId, queryClient, t],
  );

  return {
    refetchAssignment,
    assignWorkers,
    removeWorker,
    updateTask,
    setLeader,
    assigning: assignMutation.isPending,
    updatingTask: updateTaskMutation.isPending,
  };
}
