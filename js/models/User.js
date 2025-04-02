const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    auth0Id: { type: String, unique: true, required: true }, // Auth0 User ID
    name: String,
    email: { type: String, unique: true, required: true },
    picture: String, // Profile Image
    cart: [
        {
            productId: mongoose.Schema.Types.ObjectId, // Product ID
            name: String, // Product Name
            price: Number, // Product Price
            quantity: Number, // Quantity in Cart
            image: String // Product Image (optional)
        }
    ],
    wishlist: [
        {
            productId: mongoose.Schema.Types.ObjectId,
            name: String,
            price: Number,
            image: String,
            addedAt: { type: Date, default: Date.now }
        }
    ]
}, { timestamps: true }); // Automatically adds createdAt & updatedAt fields

const User = mongoose.model("User", userSchema);
module.exports = User;
