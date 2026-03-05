const mongoose = require("mongoose");
const Complaint = require("../models/Complaint");
const User = require("../models/User");
const AppError = require("../core/AppError");

function normalizeEstimatedTime(estimatedCompletionTime) {
  if (estimatedCompletionTime === undefined || estimatedCompletionTime === null) {
    return undefined;
  }
  const parsed = Number(estimatedCompletionTime);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AppError("Estimated completion time must be a positive number", 400);
  }
  return parsed;
}

function normalizeEntityId(entity) {
  if (!entity) return null;
  return String(entity._id || entity.id || entity || "").trim() || null;
}

function getTaskDescription(taskDescriptions, workerId) {
  if (!taskDescriptions) return null;
  const value = taskDescriptions[String(workerId)];
  return value ? String(value) : null;
}

function buildTaskDescriptionMap(workers) {
  if (!Array.isArray(workers)) return null;
  return workers.reduce((acc, item) => {
    const workerId = normalizeEntityId(item?.workerId || item);
    if (!workerId) return acc;
    if (item && typeof item === "object" && "taskDescription" in item) {
      acc[workerId] = item.taskDescription || null;
    }
    return acc;
  }, {});
}

async function assignComplaintToWorker(options) {
  const {
    complaint,
    worker,
    assignedBy,
    estimatedCompletionTime,
    note = null,
    taskDescription = null,
  } = options || {};

  if (!complaint || !worker) {
    throw new AppError("Complaint and worker are required for assignment", 400);
  }
  const complaintId = normalizeEntityId(complaint);
  const workerId = normalizeEntityId(worker);
  const taskDescriptions = workerId ? { [workerId]: taskDescription } : null;

  return assignComplaintToWorkers({
    complaintId,
    workers: [{ workerId }],
    assignedBy,
    estimatedCompletionTime,
    note,
    taskDescriptions,
  });
}

async function assignComplaintToWorkers(options) {
  const {
    complaint,
    complaintId,
    workers,
    assignedBy,
    estimatedCompletionTime,
    note = null,
    taskDescriptions = null,
  } = options || {};

  if (!Array.isArray(workers) || workers.length === 0) {
    throw new AppError("Complaint and workers are required for assignment", 400);
  }
  const targetComplaintId = normalizeEntityId(complaintId || complaint);
  const orderedWorkerIds = workers
    .map((item) => normalizeEntityId(item?.workerId || item))
    .filter(Boolean);

  if (!targetComplaintId || orderedWorkerIds.length === 0) {
    throw new AppError("Complaint and worker IDs are required for assignment", 400);
  }

  const seen = new Set();
  for (const workerId of orderedWorkerIds) {
    if (seen.has(workerId)) {
      throw new AppError("Duplicate worker IDs are not allowed", 400);
    }
    seen.add(workerId);
  }

  const mergedTaskDescriptions =
    taskDescriptions || buildTaskDescriptionMap(workers);
  const normalizedETA = normalizeEstimatedTime(estimatedCompletionTime);
  const now = new Date();
  let updatedComplaint = null;
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const complaintDoc = await Complaint.findById(targetComplaintId).session(session);
      if (!complaintDoc) {
        throw new AppError("Complaint not found", 404);
      }

      const workerDocs = await User.find({
        _id: { $in: orderedWorkerIds },
        role: "worker",
      }).session(session);

      if (workerDocs.length !== orderedWorkerIds.length) {
        throw new AppError("Some workers were not found", 404);
      }

      const workersById = new Map(
        workerDocs.map((workerDoc) => [String(workerDoc._id), workerDoc]),
      );
      const orderedWorkerDocs = orderedWorkerIds.map((id) => workersById.get(id));

      const previousWorkerIds = (complaintDoc.assignedWorkers || []).map((assignment) =>
        String(assignment.workerId),
      );
      const removedWorkerIds = previousWorkerIds.filter((id) => !seen.has(id));

      complaintDoc.assignedWorkers = orderedWorkerDocs.map((workerDoc) => ({
        workerId: workerDoc._id,
        taskDescription: getTaskDescription(
          mergedTaskDescriptions,
          workerDoc._id,
        ),
        assignedAt: now,
        status: "assigned",
      }));
      complaintDoc.status = "assigned";
      complaintDoc.assignedAt = now;
      complaintDoc.assignedBy = assignedBy;
      complaintDoc.resolvedAt = null;

      if (normalizedETA !== undefined) {
        complaintDoc.estimatedCompletionTime = normalizedETA;
      }

      complaintDoc.history.push({
        status: "assigned",
        updatedBy: assignedBy,
        timestamp: now,
        note: note || `Assigned to ${orderedWorkerDocs.length} workers`,
      });

      await complaintDoc.save({ session });

      if (removedWorkerIds.length > 0) {
        await User.updateMany(
          { _id: { $in: removedWorkerIds } },
          { $pull: { assignedComplaints: complaintDoc._id } },
          { session },
        );
      }

      await User.updateMany(
        { _id: { $in: orderedWorkerIds } },
        { $addToSet: { assignedComplaints: complaintDoc._id } },
        { session },
      );

      updatedComplaint = complaintDoc;
    });
  } catch (error) {
    const message = String(error?.message || "");
    const transactionUnsupported =
      message.includes("Transaction numbers are only allowed") ||
      message.includes("replica set");

    if (!transactionUnsupported) {
      throw error;
    }

    const complaintDoc = await Complaint.findById(targetComplaintId);
    if (!complaintDoc) {
      throw new AppError("Complaint not found", 404);
    }

    const workerDocs = await User.find({
      _id: { $in: orderedWorkerIds },
      role: "worker",
    });
    if (workerDocs.length !== orderedWorkerIds.length) {
      throw new AppError("Some workers were not found", 404);
    }

    const workersById = new Map(
      workerDocs.map((workerDoc) => [String(workerDoc._id), workerDoc]),
    );
    const orderedWorkerDocs = orderedWorkerIds.map((id) => workersById.get(id));
    const previousState = complaintDoc.toObject();
    const previousWorkerIds = (complaintDoc.assignedWorkers || []).map((assignment) =>
      String(assignment.workerId),
    );
    const removedWorkerIds = previousWorkerIds.filter((id) => !seen.has(id));

    try {
      complaintDoc.assignedWorkers = orderedWorkerDocs.map((workerDoc) => ({
        workerId: workerDoc._id,
        taskDescription: getTaskDescription(
          mergedTaskDescriptions,
          workerDoc._id,
        ),
        assignedAt: now,
        status: "assigned",
      }));
      complaintDoc.status = "assigned";
      complaintDoc.assignedAt = now;
      complaintDoc.assignedBy = assignedBy;
      complaintDoc.resolvedAt = null;
      if (normalizedETA !== undefined) {
        complaintDoc.estimatedCompletionTime = normalizedETA;
      }
      complaintDoc.history.push({
        status: "assigned",
        updatedBy: assignedBy,
        timestamp: now,
        note: note || `Assigned to ${orderedWorkerDocs.length} workers`,
      });
      await complaintDoc.save();

      if (removedWorkerIds.length > 0) {
        await User.updateMany(
          { _id: { $in: removedWorkerIds } },
          { $pull: { assignedComplaints: complaintDoc._id } },
        );
      }
      await User.updateMany(
        { _id: { $in: orderedWorkerIds } },
        { $addToSet: { assignedComplaints: complaintDoc._id } },
      );
      updatedComplaint = complaintDoc;
    } catch (fallbackError) {
      await Complaint.replaceOne({ _id: complaintDoc._id }, previousState);
      throw fallbackError;
    }
  } finally {
    await session.endSession();
  }

  return updatedComplaint;
}

module.exports = {
  assignComplaintToWorker,
  assignComplaintToWorkers,
};
