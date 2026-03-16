function buildListPayload({
  items = [],
  itemKey = "items",
  page = 1,
  limit = items.length,
  total = items.length,
  legacy = {},
} = {}) {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    items,
    [itemKey]: items,
    page,
    limit,
    total,
    totalPages,
    pages: totalPages,
    ...legacy,
  };
}

function buildDetailPayload(item, itemKey = "item", legacy = {}) {
  return {
    item,
    [itemKey]: item,
    ...legacy,
  };
}

function buildSummaryPayload(summary, summaryKey = "summary", legacy = {}) {
  return {
    summary,
    [summaryKey]: summary,
    ...legacy,
  };
}

module.exports = {
  buildListPayload,
  buildDetailPayload,
  buildSummaryPayload,
};
