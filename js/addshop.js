require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

const app = express();
app.use(
  cors({
    origin: "*", // Allow requests from any origin
    methods: ["GET", "POST", "DELETE"],
    allowedHeaders: ["Content-Type"],
  })
);
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // Serve static frontend files

// MongoDB Connection with better error logging
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1); // Exit process on DB failure
  });

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "instashop",
    allowed_formats: ["jpg", "jpeg", "png", "gif"],
  },
});

const upload = multer({ storage: storage });

// Define Shop Schema
const shopSchema = new mongoose.Schema({
  instagramName: { type: String, required: true, trim: true },
  shopLogo: { type: String, required: true },
  shopImage: { type: String, required: true },
});
const Shop = mongoose.model("Shop", shopSchema);

// Route to add a new shop
app.post(
  "/api/addshop",
  upload.fields([
    { name: "shopLogo", maxCount: 1 },
    { name: "shopImage", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { instagramName } = req.body;
      if (!instagramName || !req.files["shopLogo"] || !req.files["shopImage"]) {
        return res.status(400).json({ message: "Missing required fields." });
      }

      const shopLogoUrl = req.files["shopLogo"][0].path;
      const shopImageUrl = req.files["shopImage"][0].path;

      const newShop = new Shop({
        instagramName,
        shopLogo: shopLogoUrl,
        shopImage: shopImageUrl,
      });

      await newShop.save();
      console.log("✅ New Shop added:", newShop);
      res.status(201).json({ message: "Shop added successfully!", shop: newShop });
    } catch (error) {
      console.error("❌ Error adding shop:", error);
      res.status(500).json({ message: "Error adding shop.", error: error.message });
    }
  }
);

// GET all shops
app.get("/api/shops", async (req, res) => {
  try {
    console.log("Fetching all shops");
    const shops = await Shop.find({});
    console.log(`Found ${shops.length} shops`);
    res.json(shops);
  } catch (error) {
    console.error("❌ Error fetching shops:", error);
    res.status(500).json({ message: "Failed to fetch shops." });
  }
});

// DELETE shop
app.delete("/api/shops/:id", async (req, res) => {
  try {
    const shop = await Shop.findByIdAndDelete(req.params.id);
    if (!shop) {
      return res.status(404).json({ message: "Shop not found." });
    }
    res.json({ message: "✅ Shop deleted successfully!" });
  } catch (error) {
    console.error("❌ Error deleting shop:", error);
    res.status(500).json({ message: "Failed to delete shop." });
  }
});

// Start Server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🌐 API endpoints available at:`);
  console.log(`   - GET http://localhost:${PORT}/api/shops`);
  console.log(`   - POST http://localhost:${PORT}/api/addshop`);
  console.log(`   - DELETE http://localhost:${PORT}/api/shops/:id`);
});