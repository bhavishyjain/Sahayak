import { useQuery } from "@tanstack/react-query";
import apiCall from "../api";
import { DEPARTMENTS_URL } from "../../url";

function normalizeDepartmentRows(rows) {
  return (rows ?? []).map((department) => ({
    ...department,
    id: String(department?._id || department?.id || ""),
    name: department?.name || "",
    code: department?.code || "",
    isActive: department?.isActive !== false,
  }));
}

export default function useDepartments({
  includeInactive = false,
  enabled = true,
} = {}) {
  const query = useQuery({
    queryKey: ["departments", { includeInactive }],
    enabled,
    queryFn: async () => {
      const querySuffix = includeInactive ? "?includeInactive=true" : "";
      const response = await apiCall({
        method: "GET",
        url: `${DEPARTMENTS_URL}${querySuffix}`,
      });
      return normalizeDepartmentRows(response?.data ?? []);
    },
  });

  const departments = query.data ?? [];
  const departmentOptions = departments.map((department) => ({
    label: department.name,
    value: department.name,
  }));

  return {
    ...query,
    departments,
    departmentOptions,
  };
}
