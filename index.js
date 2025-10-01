const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const twilio = require("twilio");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());
app.use(express.static("public")); 


mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error(err));

const UserSchema = new mongoose.Schema({
  name: String,
  phone: String,
  email: String,
});
const User = mongoose.model("User", UserSchema);


const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

let otpStore = {}; 



// Send OTP
app.post("/send-otp", async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ message: "Phone is required" });

  const otp = Math.floor(100000 + Math.random() * 900000);
  otpStore[phone] = otp; 

  try {
    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP,
      to: `whatsapp:${phone}`,
      body: `Your OTP is: ${otp}`,
    });
    res.json({ message: "OTP sent via WhatsApp" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send OTP" });
  }
});

app.post("/verify-otp", async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) return res.status(400).json({ status: "invalid", message: "Phone and OTP required" });

  const user = await User.findOne({ phone });

  if (otpStore[phone] && otpStore[phone] == otp) {
    // ✅ OTP correct
    delete otpStore[phone]; 

    if (user) {
      // existing user
      await client.messages.create({
        from: process.env.TWILIO_WHATSAPP,
        to: `whatsapp:${phone}`,
        body: `Welcome back, ${user.name}!`
      });
      return res.json({ status: "existing", message: `Welcome Back ${user.name}`, user });
    } else {
      // new user
      return res.json({ status: "new", message: "New user, please register" });
    }
  } else {
    // OTP invalid
    if (user) {
      
      return res.json({ status: "invalid", message: "Invalid OTP, please try again" });
    } else {
      
      return res.json({ status: "new", message: "OTP invalid, but you can register as a new user" });
    }
  }
});

// Register new user
app.post("/register", async (req, res) => {
  const { name, phone, email } = req.body;
  if (!name || !phone || !email) return res.status(400).json({ message: "All fields required" });

  const user = new User({ name, phone, email });
  await user.save();

  await client.messages.create({
    from: process.env.TWILIO_WHATSAPP,
    to: `whatsapp:${phone}`,
    body: `Hi ${name}, your registration is complete! 🎉`,
  });

  res.json({ message: "User registered successfully", user });
});

// Start server
app.listen(3000, () => console.log("🚀 Server running at http://localhost:3000"));
