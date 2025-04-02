const mongoose = require("mongoose");

const shopSchema = new mongoose.Schema({
    shopName: { type: String, required: true },
    description: { type: String, required: true },
    instagramLink: { type: String, required: true },
    logoUrl: { type: String, required: true },
    shopImageUrl: { type: String, required: true }
}, { timestamps: true });

const Shop = mongoose.model("Shop", shopSchema);

module.exports = Shop;
