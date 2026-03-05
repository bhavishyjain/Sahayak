import { useMutation } from "@tanstack/react-query";
import apiCall from "../api";

export default function useApiMutation({ method = "POST", url, headers }) {
  return useMutation({
    mutationFn: async ({ data, params, responseType, urlOverride } = {}) => {
      const response = await apiCall({
        method,
        url: urlOverride || url,
        data,
        params,
        headers,
        responseType,
      });
      return response?.data;
    },
  });
}
