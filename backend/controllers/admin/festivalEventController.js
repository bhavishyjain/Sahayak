const FestivalEvent = require("../../models/FestivalEvent");
const AppError = require("../../core/AppError");
const asyncHandler = require("../../core/asyncHandler");
const { sendSuccess } = require("../../core/response");

exports.listEvents = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.active === "true") filter.isActive = true;
  const events = await FestivalEvent.find(filter).sort({ startDate: 1 });
  return sendSuccess(res, { data: events, total: events.length });
});

exports.createEvent = asyncHandler(async (req, res) => {
  const { name, startDate, endDate, highPriorityLocations, priority } =
    req.body;
  if (!name || !startDate || !endDate) {
    throw new AppError("name, startDate and endDate are required", 400);
  }
  if (endDate < startDate) {
    throw new AppError("endDate must be on or after startDate", 400);
  }
  const event = await FestivalEvent.create({
    name,
    startDate,
    endDate,
    highPriorityLocations: highPriorityLocations || [],
    priority,
  });
  return sendSuccess(res, { data: event }, "Festival event created", 201);
});

exports.updateEvent = asyncHandler(async (req, res) => {
  const {
    name,
    startDate,
    endDate,
    highPriorityLocations,
    priority,
    isActive,
  } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (startDate !== undefined) updates.startDate = startDate;
  if (endDate !== undefined) updates.endDate = endDate;
  if (highPriorityLocations !== undefined)
    updates.highPriorityLocations = highPriorityLocations;
  if (priority !== undefined) updates.priority = priority;
  if (isActive !== undefined) updates.isActive = isActive;

  const event = await FestivalEvent.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });
  if (!event) throw new AppError("Festival event not found", 404);
  return sendSuccess(res, { data: event }, "Festival event updated");
});

exports.deleteEvent = asyncHandler(async (req, res) => {
  const event = await FestivalEvent.findByIdAndDelete(req.params.id);
  if (!event) throw new AppError("Festival event not found", 404);
  return sendSuccess(res, {}, "Festival event deleted");
});
