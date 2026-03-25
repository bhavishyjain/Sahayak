const { normalizeStatus, getResolvedAt } = require("../../utils/normalize");
const {
  normalizeString,
} = require("../../services/filterContractService");
const {
  buildReportFiltersForRequest,
} = require("../../services/reportPolicyService");

module.exports = {
  normalizeString,
  buildFilters: buildReportFiltersForRequest,
  getResolvedAt,
  normalizeStatus,
};
