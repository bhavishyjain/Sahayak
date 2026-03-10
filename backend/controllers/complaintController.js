module.exports = {
  ...require("./complaints/createReadController"),
  ...require("./complaints/aiReviewController"),
  ...require("./complaints/mediaController"),
  ...require("./complaints/satisfactionController"),
  ...require("./complaints/messageController"),
};
