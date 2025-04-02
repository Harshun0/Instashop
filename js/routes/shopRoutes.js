const express = require("express");
const Shop = require("../models/Shop");

const router = express.Router();

// Add a new shop
router.post("/shop", async (req, res) => {
    try {
        const { shopName, description, instagramLink, logoUrl, shopImageUrl } = req.body;
        const newShop = new Shop({ shopName, description, instagramLink, logoUrl, shopImageUrl });
        await newShop.save();
        res.status(201).json({ message: "Shop added successfully", shop: newShop });
    } catch (error) {
        res.status(500).json({ error: error.message || "Failed to add shop" });
    }
});

// Get all shops
router.get("/shops", async (req, res) => {
    try {
        const shops = await Shop.find();
        res.status(200).json(shops);
    } catch (error) {
        res.status(500).json({ error: error.message || "Failed to fetch shops" });
    }
});

module.exports = router;
