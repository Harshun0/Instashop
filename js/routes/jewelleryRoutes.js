const express = require("express");
const router = express.Router();
const Jewellery = require("../models/jewelleryModel");

// ➤ Add New Jewellery Item
router.post("/", async (req, res) => {
    try {
        const { name, description, category, subcategory, metal, occasion, originalPrice, discount, price, image } = req.body;

        if (!name || !description || !category || !originalPrice || !price || !image) {
            return res.status(400).json({ error: "All required fields must be filled" });
        }

        const newJewellery = new Jewellery({ name, description, category, subcategory, metal, occasion, originalPrice, discount, price, image });

        await newJewellery.save();
        res.status(201).json({ message: "Jewellery item added successfully", jewellery: newJewellery });
    } catch (error) {
        console.error("Error adding jewellery:", error);
        res.status(500).json({ error: "Server error while adding jewellery" });
    }
});

// ➤ Get All Jewellery Items
router.get("/", async (req, res) => {
    try {
        const jewellery = await Jewellery.find();
        res.status(200).json(jewellery);
    } catch (error) {
        console.error("Error fetching jewellery:", error);
        res.status(500).json({ error: "Server error while fetching jewellery" });
    }
});

// ➤ Get Single Jewellery Item by ID
router.get("/:id", async (req, res) => {
    try {
        const jewellery = await Jewellery.findById(req.params.id);
        if (!jewellery) return res.status(404).json({ error: "Jewellery item not found" });
        res.status(200).json(jewellery);
    } catch (error) {
        console.error("Error fetching jewellery:", error);
        res.status(500).json({ error: "Server error while fetching jewellery" });
    }
});

// ➤ Delete Jewellery Item by ID
router.delete("/:id", async (req, res) => {
    try {
        const deletedJewellery = await Jewellery.findByIdAndDelete(req.params.id);
        if (!deletedJewellery) return res.status(404).json({ error: "Jewellery item not found" });

        res.status(200).json({ message: "Jewellery item deleted successfully" });
    } catch (error) {
        console.error("Error deleting jewellery:", error);
        res.status(500).json({ error: "Server error while deleting jewellery" });
    }
});

// ➤ Update Jewellery Item by ID
router.put("/:id", async (req, res) => {
    try {
        const updatedJewellery = await Jewellery.findByIdAndUpdate(req.params.id, req.body, { new: true });

        if (!updatedJewellery) return res.status(404).json({ error: "Jewellery item not found" });

        res.status(200).json({ message: "Jewellery item updated successfully", jewellery: updatedJewellery });
    } catch (error) {
        console.error("Error updating jewellery:", error);
        res.status(500).json({ error: "Server error while updating jewellery" });
    }
});

module.exports = router;
