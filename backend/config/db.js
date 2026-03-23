const mongoose = require("mongoose");
const { ensureDefaultDepartments } = require("../services/departmentService");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    await ensureDefaultDepartments();
    console.log(`MongoDB Connected `);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

module.exports = connectDB;
