const AppError = require("../core/AppError");

function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user?._id) {
      return next(new AppError("Authentication required", 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError("Forbidden", 403));
    }

    return next();
  };
}

module.exports = authorize;
