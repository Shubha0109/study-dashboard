const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("./models/User");

const app = express();
const SECRET_KEY = "mysecretkey";

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

/* =========================
   DB CONNECTION
========================= */
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

/* =========================
   AUTH MIDDLEWARE
========================= */
function verifyToken(req, res, next) {
  const token = req.headers["authorization"];

  if (!token) {
    return res.status(401).json({ message: "Access denied" });
  }

  try {
    const verified = jwt.verify(token, SECRET_KEY);
    req.user = verified;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

/* =========================
   SIGNUP
========================= */
app.post("/signup", async (req, res) => {
  const { email, password } = req.body;

  let user = await User.findOne({ email });
  if (user) return res.json({ message: "User already exists" });

  const hash = await bcrypt.hash(password, 10);

  const newUser = new User({
    email,
    password: hash,
    goal: 120,
    studyData: []
  });

  await newUser.save();

  res.json({ message: "Signup successful" });
});

/* =========================
   LOGIN
========================= */
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  let user = await User.findOne({ email });
  if (!user) return res.json({ message: "User not found" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.json({ message: "Wrong password" });

  const token = jwt.sign({ email }, SECRET_KEY, { expiresIn: "1h" });

  res.json({ message: "Login successful", token });
});

/* =========================
   ADD STUDY
========================= */
app.post("/add-study", verifyToken, async (req, res) => {
  const { subject, time } = req.body;

  if (!subject || !time) {
    return res.json({ message: "Enter subject and time" });
  }

  const user = await User.findOne({ email: req.user.email });
  if (!user) return res.status(404).json({ message: "User not found" });

  user.studyData.push({
    subject,
    time: Number(time),
    date: new Date().toISOString().split("T")[0]
  });

  await user.save();

  res.json({ message: "Study added" });
});

/* =========================
   DELETE STUDY
========================= */
app.delete("/delete-study/:id", verifyToken, async (req, res) => {
  const user = await User.findOne({ email: req.user.email });
  if (!user) return res.status(404).json({ message: "User not found" });

  user.studyData = user.studyData.filter(
    item => item._id.toString() !== req.params.id
  );

  await user.save();

  res.json({ message: "Deleted successfully" });
});

/* =========================
   GET ALL RECORDS
========================= */
app.get("/records", verifyToken, async (req, res) => {
  const user = await User.findOne({ email: req.user.email });
  if (!user) return res.status(404).json({ message: "User not found" });

  res.json(user.studyData);
});

/* =========================
   STATS
========================= */
app.get("/stats", verifyToken, async (req, res) => {
  const user = await User.findOne({ email: req.user.email });
  if (!user) return res.status(404).json({ message: "User not found" });

  let totalTime = 0;
  let subjectMap = {};
  let studyDays = new Set();

  user.studyData.forEach(item => {
    totalTime += item.time;

    subjectMap[item.subject] =
      (subjectMap[item.subject] || 0) + item.time;

    studyDays.add(item.date);
  });

  let streak = studyDays.size;

  res.json({
    totalTime,
    subjectMap,
    streak,
    goal: user.goal,
    completed: totalTime >= user.goal,
    studyDays: [...studyDays]
  });
});

/* =========================
   SET GOAL
========================= */
app.post("/set-goal", verifyToken, async (req, res) => {
  const { goal } = req.body;

  const user = await User.findOne({ email: req.user.email });
  if (!user) return res.status(404).json({ message: "User not found" });

  user.goal = Number(goal);

  await user.save();

  res.json({ message: "Goal updated" });
});

/* =========================
   SUGGESTIONS
========================= */
app.get("/suggestions", verifyToken, async (req, res) => {
  const user = await User.findOne({ email: req.user.email });
  if (!user) return res.status(404).json({ message: "User not found" });

  let suggestions = [];
  let subjectMap = {};
  let totalTime = 0;

  user.studyData.forEach(item => {
    totalTime += item.time;

    subjectMap[item.subject] =
      (subjectMap[item.subject] || 0) + item.time;
  });

  if (!user.goal || totalTime < user.goal) {
    suggestions.push("🎯 You need to study more to reach your goal");
  } else {
    suggestions.push("✅ Goal completed");
  }

  let minSub = null;
  let minTime = Infinity;

  for (let sub in subjectMap) {
    if (subjectMap[sub] < minTime) {
      minTime = subjectMap[sub];
      minSub = sub;
    }
  }

  if (minSub) {
    suggestions.push("⚠️ Focus more on " + minSub);
  }

  if (user.studyData.length < 3) {
    suggestions.push("📅 Try studying daily");
  } else {
    suggestions.push("🔥 Good consistency");
  }

  res.json(suggestions);
});

/* =========================
   SERVER START
========================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});