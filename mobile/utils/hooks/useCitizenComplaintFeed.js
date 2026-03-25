import useComplaintList from "./useComplaintList";

export function useCitizenComplaintFeed(filters = {}) {
  const {
    status = "all",
    department = "all",
    priority = "all",
    sort = "new-to-old",
    startDate = "",
    endDate = "",
    search = "",
    limit = 10,
    enabled = true,
  } = filters;

  return useComplaintList({
    scope: "mine",
    status,
    excludeStatus: "resolved",
    department,
    priority,
    sort,
    startDate,
    endDate,
    search,
    limit,
    enabled,
  });
}
