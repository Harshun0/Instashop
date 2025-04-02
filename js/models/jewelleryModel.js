const mongoose = require("mongoose");

const jewellerySchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    subcategory: { type: String },
    metal: { type: String },
    occasion: { type: String },
    originalPrice: { type: Number, required: true },
    discount: { type: Number },
    price: { type: Number, required: true },
    image: { type: String, required: true },  // Cloudinary URL or local path
}, { timestamps: true });

module.exports = mongoose.model("Jewellery", jewellerySchema);
