require("dotenv").config();

const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const { auth } = require("express-openid-connect");

const User = require("./models/User"); 
// const jewelleryRoutes = require("./routes/jewelleryRoutes");
// const authRoutes = require("./routes/auth");
const app = express();
const authRoutes = require("./routes/auth"); // Import auth.js
const sellerRoutes = require("./routes/sellers"); // Import sellers.js
const shopRoutes = require("./routes/shopRoutes"); // Import shopRoutes.js

//ye test h 
const config = {
    authRequired: false,
    auth0Logout: true,
    secret: process.env.SECRET,
    baseURL: process.env.BASEURL,
    clientID: process.env.CLIENTID,
    issuerBaseURL: process.env.ISSUER,
    session: {
      cookie: {
        sameSite: "Lax",
      },
    },
 };
 
 // Auth0 Middleware
 app.use(auth(config));
  
 //mongo
 app.use(async (req, res, next) => {
    if (req.oidc.isAuthenticated()) {
        const { sub, name, email, picture } = req.oidc.user;

        console.log("🔹 Authenticated User Data:", req.oidc.user); // Debugging

        try {
            let user = await User.findOne({ auth0Id: sub });

            if (!user) {
                // ❌ User does NOT exist, create a new one
                user = new User({ auth0Id: sub, name, email, picture, cart: [], wishlist: [], addresses: [] });
                await user.save();
                console.log("✅ New User Created:", user);
            } else {
                // ✅ User exists, only update name & picture (NOT email)
                user.name = name;
                user.picture = picture;
                await user.save();
                console.log("🔄 Existing User Updated:", user);
            }

        } catch (error) {
            console.error("❌ Error Saving User:", error);
        }
    }
    next();
});

 // ✅ Route to check if user is logged in
 app.get("/user", (req, res) => {
     if (req.oidc.isAuthenticated()) {
         res.json({ loggedIn: true, user: req.oidc.user });
     } else {
         res.json({ loggedIn: false });
     }
 });
 
 // ✅ Homepage Route
 
 
 // ✅ Profile Route (Only for logged-in users)
 app.get("/profile", (req, res) => {
    if (req.oidc.isAuthenticated()) {
        res.send(`Hello ${req.oidc.user.name}!`);
    } else {
        res.redirect("/login");
    }
 });
 // ye end hai na

// Middleware
app.use(cors({
    origin: ['http://localhost:5000', 'https://instashop-ur4l.onrender.com'],  // Allow both localhost and your render domain
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],  // Added OPTIONS for preflight requests
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept']
}));

app.use(express.json()); // Parse incoming JSON requests
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));
// Routes
app.use(authRoutes); // Use auth routes
app.use('/', sellerRoutes);
app.use("/api", shopRoutes);
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ✅ Correct

//app.use(authRoutes); // Use auth routes

// ✅ MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("✅ MongoDB Connected"))
  .catch(err => {
      console.error("❌ MongoDB Connection Error:", err);
      process.exit(1);
  });

// ✅ Product Schema (Updated)
const productSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    metaDescription: { type: String, required: true, trim: true },  // New field
    detailedDescription: { type: String, required: true, trim: true }, // New field
    category: { type: String, required: true, trim: true },
    subcategory: { type: String, trim: true },
    seller: { type: String, required: true, trim: true },
    metal: { type: String, trim: true },
    occasion: [{ type: String, trim: true }],
    originalPrice: { type: Number, required: true },
    discount: { type: Number, required: true, default: 0 },
    price: { type: Number, required: true },
    deliveryChargeNagpur: { type: Number, required: true },  // New field
    deliveryChargeOutside: { type: Number, required: true }, // New field
    images: [{ type: String, required: true }],
    material: { type: String, trim: true }
}, { timestamps: true });

const Product = mongoose.model("Product", productSchema);
app.get("/search", async (req, res) => {
    try {
        const query = req.query.query.trim();
        if (!query) {
            return res.json([]);
        }

        // Search across multiple fields
        const results = await Product.find({
            $or: [
                { name: { $regex: query, $options: "i" } },
                { category: { $regex: query, $options: "i" } },
                { subcategory: { $regex: query, $options: "i" } }
            ]
        })
        .select('name price images category') // Make sure to select images
        .limit(10);

        // Format the response with proper image handling
        const formattedResults = results.map(product => {
            // Ensure we have a valid image URL
            const imageUrl = product.images && product.images.length > 0 
                ? product.images[0]  // Take first image from array
                : '/placeholder.jpg'; // Fallback image

            return {
                _id: product._id,
                name: product.name,
                price: product.price,
                category: product.category,
                image: imageUrl
            };
        });

        // Log for debugging
        console.log('Search results:', formattedResults);
        
        res.json(formattedResults);
    } catch (err) {
        console.error("Search error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// 🔹 GET: Filtered Products by Category
app.get("/api/products", async (req, res) => {
    try {
        const { category } = req.query;
        const filter = category ? { category: { $regex: new RegExp("^" + category + "$", "i") } } : {};

        const products = await Product.find(filter);
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
//product.html ke lie 
app.get("/app/products/:id", async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ error: "Product not found" });
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});
//cart ke liye test 
app.get("/cart", async (req, res) => {
    if (!req.oidc.isAuthenticated()) {
        return res.json({ cart: [] });
    }

    const user = await User.findOne({ auth0Id: req.oidc.user.sub });

    if (!user) {
        return res.json({ cart: [] });
    }

    res.json({ cart: user.cart });
});

// ✅ Add to Cart
app.post("/cart/add", async (req, res) => {
    if (!req.oidc.isAuthenticated()) {
        return res.status(401).json({ loginRedirect: true });
    }

    const { productId, name, price, image } = req.body;
    const user = await User.findOne({ auth0Id: req.oidc.user.sub });

    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

    let product = user.cart.find(item => item.productId.toString() === productId);

    if (product) {
        product.quantity += 1;
    } else {
        user.cart.push({ productId, name, price, quantity: 1, image });
    }

    await user.save();
    res.json({ success: true, cart: user.cart });
});

// ✅ Update Quantity
app.post("/cart/update", async (req, res) => {
    if (!req.oidc.isAuthenticated()) {
        return res.status(401).json({ message: "Not logged in" });
    }

    const { productId, change } = req.body;
    const user = await User.findOne({ auth0Id: req.oidc.user.sub });

    if (!user) return res.status(404).json({ message: "User not found" });

    let product = user.cart.find(item => item.productId.toString() === productId);
    if (product) {
        product.quantity = Math.max(1, product.quantity + change);
        await user.save();
    }

    res.json({ success: true, cart: user.cart });
});

// ✅ Remove from Cart
app.delete("/cart/:productId", async (req, res) => {
    if (!req.oidc.isAuthenticated()) {
        return res.status(401).json({ message: "Not logged in" });
    }

    const user = await User.findOne({ auth0Id: req.oidc.user.sub });
    if (!user) return res.status(404).json({ message: "User not found" });

    user.cart = user.cart.filter(item => item.productId.toString() !== req.params.productId);
    await user.save();

    res.json({ success: true, cart: user.cart });
});
//yaha cart ka end hai
// 🔹 GET: Jewellery Products with Filters
app.get("/api/products/jewellery", async (req, res) => {
    try {
        const { subcategory, material, priceRange, sort } = req.query;
        let query = { category: { $regex: new RegExp("^jewellery$", "i") } };

        if (subcategory) query.subcategory = { $in: subcategory.split(",") };
        if (material) query.material = { $in: material.split(",") };
        if (priceRange) {
            const [min, max] = priceRange.split('-').map(Number);
            query.price = { $gte: min, $lte: max };
        }

        let sortQuery = {};
        switch (sort) {
            case "price-low":
                sortQuery.price = 1;
                break;
            case "price-high":
                sortQuery.price = -1;
                break;
            case "name-az":
                sortQuery.name = 1;
                break;
            case "name-za":
                sortQuery.name = -1;
                break;
            default:
                sortQuery = { createdAt: -1 }; // Default: Show newest first
        }

        const products = await Product.find(query).sort(sortQuery);

        res.json(products);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch jewelry products" });
    }
});
//fetch crochet
app.get("/api/products/crochet", async (req, res) => {
    try {
        const { subcategory, material, priceRange, sort } = req.query;
        let query = { category: { $regex: new RegExp("^crochet$", "i") } };

        if (subcategory) query.subcategory = { $in: subcategory.split(",") };
        if (material) query.material = { $in: material.split(",") };
        if (priceRange) {
            const [min, max] = priceRange.split('-').map(Number);
            query.price = { $gte: min, $lte: max };
        }

        let sortQuery = {};
        switch (sort) {
            case "price-low":
                sortQuery.price = 1;
                break;
            case "price-high":
                sortQuery.price = -1;
                break;
            case "name-az":
                sortQuery.name = 1;
                break;
            case "name-za":
                sortQuery.name = -1;
                break;
            default:
                sortQuery = { createdAt: -1 }; // Default: Show newest first
        }

        const products = await Product.find(query).sort(sortQuery);

        res.json(products);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch crochet products" });
    }
});

// GET: Clothing
app.get("/api/products/clothing", async (req, res) => {
    try {
        const { subcategory, material, size, priceRange, color, gender, brand, sort } = req.query;
        let query = { category: { $regex: new RegExp("^clothing$", "i") } };

        if (subcategory) query.subcategory = { $in: subcategory.split(",") };
        if (material) query.material = { $in: material.split(",") };
        if (size) query.sizes = { $in: size.split(",") };
        if (color) query.colors = { $in: color.split(",") };
        if (gender) query.gender = { $in: gender.split(",") };
        if (brand) query.brand = { $in: brand.split(",") };
        if (priceRange) {
            const [min, max] = priceRange.split('-').map(Number);
            query.price = { $gte: min, $lte: max };
        }

        let sortQuery = {};
        switch (sort) {
            case "price-low":
                sortQuery.price = 1;
                break;
            case "price-high":
                sortQuery.price = -1;
                break;
            case "name-az":
                sortQuery.name = 1;
                break;
            case "name-za":
                sortQuery.name = -1;
                break;
            case "newest":
                sortQuery.createdAt = -1;
                break;
            case "bestseller":
                sortQuery.salesCount = -1;
                break;
            case "rating":
                sortQuery.averageRating = -1;
                break;
            default:
                sortQuery = { createdAt: -1 }; // Default: Show newest first
        }

        const products = await Product.find(query).sort(sortQuery);

        res.json(products);
    } catch (error) {
        console.error("Error fetching clothing products:", error);
        res.status(500).json({ error: "Failed to fetch clothing products" });
    }
});

// 🔹 GET: Hampers Products
app.get("/api/products/gift_hampers", async (req, res) => {
    try {
        const { subcategory, material, priceRange } = req.query;
        
        // Build query object
        const query = { category: { $in: ["hampers", "gift_hampers"] } };
 
        // Add subcategory filter if provided
        if (subcategory) {
            const subcategories = subcategory.split(',');
            query.subcategory = { $in: subcategories };
        }
        
        // Add material filter if provided
        if (material) {
            const materials = material.split(',');
            query.material = { $in: materials };
        }
        
        // Add price range filter if provided
        if (priceRange) {
            const [min, max] = priceRange.split('-').map(Number);
            query.price = { $gte: min, $lte: max };
        }
        
        const products = await Product.find(query);
        res.json(products);
    } catch (error) {
        console.error("❌ Error fetching hampers products:", error);
        res.status(500).json({ error: "Failed to fetch hampers products" });
    }
});
// 🔹 POST: Add New Product (Admin Only) - Updated
app.post("/api/products", async (req, res) => {
    try {
        const {
            name, metaDescription, detailedDescription, category, subcategory,
            metal, occasion, originalPrice, discount, price, 
            deliveryChargeNagpur, deliveryChargeOutside, images,
            seller
        } = req.body;

        if (!name || !metaDescription || !detailedDescription || !category || 
            !originalPrice || !price || !images || discount === undefined || 
            deliveryChargeNagpur === undefined || deliveryChargeOutside === undefined ||
            !seller) {
            return res.status(400).json({ 
                error: "Missing required fields",
                received: req.body
            });
        }

        const newProduct = new Product({
            name: name.trim(),
            metaDescription: metaDescription.trim(),
            detailedDescription: detailedDescription.trim(),
            category: category.trim().toLowerCase(),
            subcategory: subcategory?.trim(),
            seller: seller.trim(),
            metal: metal?.trim(),
            occasion: Array.isArray(occasion) ? occasion : (occasion ? [occasion.trim()] : []),
            originalPrice: Number(originalPrice),
            discount: Number(discount),
            price: Number(price),
            deliveryChargeNagpur: Number(deliveryChargeNagpur),
            deliveryChargeOutside: Number(deliveryChargeOutside),
            images: Array.isArray(images) ? images : [images.trim()]
        });

        await newProduct.save();
        res.status(201).json({ message: "✅ Product added successfully!", product: newProduct });

    } catch (error) {
        console.error("❌ Error adding product:", error);
        res.status(500).json({ error: "Failed to add product", details: error.message });
    }
});
// PUT: Update Product (Admin Only)
app.put("/api/products/:id", async (req, res) => {
    try {
        const {
            name, metaDescription, detailedDescription, category, subcategory,
            metal, occasion, originalPrice, discount, price, 
            deliveryChargeNagpur, deliveryChargeOutside, images,
            inStock, quantity, restockDate
        } = req.body;
        
        if (!name || !category || !price) {
            return res.status(400).json({ 
                error: "Missing required fields",
                received: req.body 
            });
        }
        
        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            {
                name: name.trim(),
                metaDescription: metaDescription?.trim(),
                detailedDescription: detailedDescription?.trim(),
                category: category.trim().toLowerCase(),
                subcategory: subcategory?.trim(),
                metal: metal?.trim(),
                occasion: Array.isArray(occasion) ? occasion : (occasion ? [occasion.trim()] : []),
                originalPrice: Number(originalPrice),
                discount: Number(discount),
                price: Number(price),
                deliveryChargeNagpur: Number(deliveryChargeNagpur),
                deliveryChargeOutside: Number(deliveryChargeOutside),
                images: Array.isArray(images) ? images : [images].filter(img => img),
                inStock: Boolean(inStock),
                quantity: Number(quantity || 0),
                restockDate: restockDate || null
            },
            { new: true, runValidators: true }
        );
        
        if (!updatedProduct) {
            return res.status(404).json({ error: "Product not found" });
        }
        
        res.json({ 
            message: "✅ Product updated successfully!", 
            product: updatedProduct 
        });
    } catch (error) {
        console.error("❌ Error updating product:", error);
        res.status(500).json({ 
            error: "Failed to update product", 
            details: error.message 
        });
    }
});
// 🔹 DELETE: Product (Admin Only)
app.delete("/api/products/:id", async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) return res.status(404).json({ error: "Product not found" });

        res.json({ message: "✅ Product deleted successfully!" });
    } catch (error) {
        console.error("❌ Error deleting product:", error);
        res.status(500).json({ error: "Failed to delete product" });
    }
});

// 🔹 Serve Frontend Pages
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Add this endpoint to your server.js
app.get("/app/similar-products/:id", async (req, res) => {
    try {
        // First, find the current product to get its category and subcategory
        const currentProduct = await Product.findById(req.params.id);
        
        if (!currentProduct) {
            return res.status(404).json({ error: "Product not found" });
        }

        // Find similar products based on category and subcategory
        let similarProducts = await Product.find({
            _id: { $ne: currentProduct._id }, // Exclude current product
            $or: [
                // First priority: Same category AND subcategory
                {
                    category: currentProduct.category,
                    subcategory: currentProduct.subcategory
                },
                // Second priority: Same category only
                {
                    category: currentProduct.category
                }
            ]
        })
        .limit(8) // Limit to 8 similar products
        .select('name images price originalPrice category subcategory'); // Select only needed fields

        // If no similar products found with same category/subcategory
        if (similarProducts.length === 0) {
            // Fallback to products from same category only
            similarProducts = await Product.find({
                _id: { $ne: currentProduct._id },
                category: currentProduct.category
            })
            .limit(8)
            .select('name images price originalPrice category subcategory');
        }

        console.log(`Found ${similarProducts.length} similar products for product ID: ${req.params.id}`);
        res.json(similarProducts);

    } catch (error) {
        console.error("Error fetching similar products:", error);
        res.status(500).json({ 
            error: "Failed to fetch similar products",
            details: error.message 
        });
    }
});

// User Schema for Registrations
const addressSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    streetAddress: { type: String, required: true },
    apartment: String,
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    phone: { type: String, required: true },
    isDefault: { type: Boolean, default: false }
});

const userSchema = new mongoose.Schema({
    auth0Id: String,
    name: String,
    email: String,
    picture: String,
    cart: Array,
    wishlist: Array,
    addresses: [addressSchema]
});

// Registration endpoint
app.post("/api/register", async (req, res) => {
    try {
        const { fullName, email, password, mobileNumber } = req.body;
        
        // Log the received data (remove in production)
        console.log('Received registration data:', { fullName, email, mobileNumber });
        
        // Validate required fields
        if (!fullName || !email || !password || !mobileNumber) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check if user already exists by email or mobile number
        const existingUser = await User.findOne({
            $or: [{ email }, { mobileNumber }]
        });

        if (existingUser) {
            return res.status(400).json({ error: 'User already exists, please sign in' });
        }

        // Create new user
        const user = new User({
            fullName,
            email,
            password, // Note: In production, hash the password!
            mobileNumber
        });

        // Save user and log success
        await user.save();
        console.log('User registered successfully:', email);
        
        res.status(201).json({ message: 'Registration successful' });
    } catch (error) {
        console.error("❌ Registration error:", error);
        res.status(500).json({ error: 'Registration failed: ' + error.message });
    }
});


// Login endpoint (optional but recommended)
app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // In production, you should compare hashed passwords
        if (user.password !== password) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        res.json({ message: 'Login successful' });
    } catch (error) {
        console.error("❌ Login error:", error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get wishlist items
app.get("/api/wishlist", async (req, res) => {
    if (!req.oidc.isAuthenticated()) {
        return res.json({ loginRedirect: true });
    }

    try {
        const user = await User.findOne({ auth0Id: req.oidc.user.sub });
        if (!user) {
            return res.json([]);
        }
        res.json(user.wishlist);
    } catch (error) {
        console.error("Error fetching wishlist:", error);
        res.status(500).json({ error: "Failed to fetch wishlist" });
    }
});

// Add to wishlist
app.post("/api/wishlist", async (req, res) => {
    if (!req.oidc.isAuthenticated()) {
        return res.json({ loginRedirect: true });
    }

    try {
        const { productId, name, price, image } = req.body;
        const user = await User.findOne({ auth0Id: req.oidc.user.sub });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Check if item already exists in wishlist
        const existingItem = user.wishlist.find(item => item.productId.toString() === productId);
        if (existingItem) {
            return res.json({ message: "Item already in wishlist" });
        }

        // Add new item to wishlist
        user.wishlist.push({
            productId,
            name,
            price,
            image,
            addedAt: new Date()
        });

        await user.save();
        res.json({ success: true, wishlist: user.wishlist });
    } catch (error) {
        console.error("Error adding to wishlist:", error);
        res.status(500).json({ error: "Failed to add to wishlist" });
    }
});

// Remove from wishlist
app.delete("/api/wishlist", async (req, res) => {
    if (!req.oidc.isAuthenticated()) {
        return res.json({ loginRedirect: true });
    }

    try {
        const { productId } = req.body;
        const user = await User.findOne({ auth0Id: req.oidc.user.sub });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        user.wishlist = user.wishlist.filter(item => item.productId.toString() !== productId);
        await user.save();
        res.json({ success: true, wishlist: user.wishlist });
    } catch (error) {
        console.error("Error removing from wishlist:", error);
        res.status(500).json({ error: "Failed to remove from wishlist" });
    }
});

//seller login
const sellerSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
    // Add other fields as needed
});

const Seller = mongoose.model('sellerdata', sellerSchema); 

app.post("/api/seller/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        
        console.log("Login attempt for:", email); // Debug log

        // Find seller in database
        const seller = await Seller.findOne({ email });
        
        console.log("Found seller:", seller); // Debug log

        if (!seller) {
            console.log("No seller found with email:", email);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password (case-sensitive comparison)
        if (seller.password !== password) {
            console.log("Password mismatch for:", email);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Login successful
        console.log("Login successful for:", email);
        res.json({ success: true });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: 'Login failed: ' + error.message });
    }
}); 

// Add this new endpoint to save address
app.post("/api/save-address", async (req, res) => {
    try {
        if (!req.oidc.isAuthenticated()) {
            return res.status(401).json({ loginRedirect: true });
        }

        const user = await User.findOne({ auth0Id: req.oidc.user.sub });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const newAddress = {
            fullName: req.body.fullName,
            streetAddress: req.body.streetAddress,
            apartment: req.body.apartment,
            city: req.body.city,
            state: req.body.state,
            pincode: req.body.pincode,
            phone: req.body.phone,
            isDefault: user.addresses.length === 0 // Make first address default
        };

        user.addresses.push(newAddress);
        await user.save();

        res.json({ success: true, message: "Address saved successfully" });
    } catch (error) {
        console.error("Error saving address:", error);
        res.status(500).json({ error: "Failed to save address" });
    }
});

// Add Order Schema after your existing schemas
const orderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    items: [{
        productId: String,
        name: String,
        price: Number,
        quantity: Number,
        image: String,
        seller: String
    }],
    totalAmount: Number,
    status: {
        type: String,
        enum: ['Processing', 'Shipped', 'Delivered', 'Cancelled'],
        default: 'Processing'
    },
    paymentMethod: String,
    shippingAddress: {
        fullName: String,
        streetAddress: String,
        city: String,
        state: String,
        pincode: String,
        phone: String
    },
    orderDate: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', orderSchema);

// Add this endpoint to get user orders
app.get("/api/orders", async (req, res) => {
    if (!req.oidc.isAuthenticated()) {
        return res.status(401).json({ loginRedirect: true });
    }

    try {
        const orders = await Order.find({ userId: req.oidc.user.sub })
            .sort({ orderDate: -1 }); // Most recent first
        res.json(orders);
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json({ error: "Failed to fetch orders" });
    }
});

// Modify your existing place-cod-order endpoint to create an order record
app.post("/api/place-cod-order", async (req, res) => {
    try {
        if (!req.oidc.isAuthenticated()) {
            return res.status(401).json({ error: "Please login to place order" });
        }

        const { items, customer, pricing, orderDetails } = req.body;

        // Create new order
        const newOrder = new Order({
            orderId: `ORD-${Date.now()}`,
            userId: req.oidc.user.sub,
            items: items.map(item => ({
                productId: item.productId,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                image: item.image,
                seller: item.seller
            })),
            totalAmount: pricing.total,
            paymentMethod: 'COD',
            shippingAddress: {
                fullName: customer.name,
                streetAddress: customer.address.split(',')[0].trim(),
                city: customer.address.split(',')[1].trim(),
                state: customer.address.split(',')[2].split('-')[0].trim(),
                pincode: customer.address.split(',')[2].split('-')[1].trim(),
                phone: customer.phone
            }
        });

        await newOrder.save();

        // Get user details from Auth0
        const userData = req.oidc.user;

        // Format items details for telegram message
        const itemsList = items.map(item => `
- Name: ${item.name}
- Quantity: ${item.quantity}
- Price per item: ₹${item.price}
- Item Total: ₹${item.total}
- Seller: ${item.seller}
`).join('\n');

        // Format message for Telegram
        const message = `
🛍️ New COD Order!

📦 Order Items:
${itemsList}

👤 Customer Details:
- Name: ${customer.name}
- Email: ${userData.email}
- Address: ${customer.address}
- Phone: ${customer.phone}

💰 Pricing Details:
- Subtotal: ₹${pricing.subtotal}
- Shipping: ₹${pricing.shipping}
- Tax: ₹${pricing.tax}
- Total Amount: ₹${pricing.total}

📅 Order Date: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
📝 Order Status: Pending
Payment Method: Cash on Delivery

${orderDetails.deliveryInstructions ? `📝 Delivery Instructions: ${orderDetails.deliveryInstructions}` : ''}
`;

        // Send message to Telegram
        await bot.sendMessage(TELEGRAM_CHAT_ID, message);

        // Save the address if it's new
        const user = await User.findOne({ auth0Id: userData.sub });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Initialize addresses array if it doesn't exist
        if (!user.addresses) {
            user.addresses = [];
        }

        // Check if address exists and add if it's new
        if (!user.addresses.some(addr => 
            addr.streetAddress === customer.address.split(',')[0].trim() &&
            addr.phone === customer.phone
        )) {
            const addressParts = customer.address.split(',');
            const newAddress = {
                fullName: customer.name,
                streetAddress: addressParts[0].trim(),
                city: addressParts[1].trim(),
                state: addressParts[2].split('-')[0].trim(),
                pincode: addressParts[2].split('-')[1].trim(),
                phone: customer.phone,
                isDefault: user.addresses.length === 0
            };
            user.addresses.push(newAddress);
            await user.save();
        }

        // Clear the user's cart after successful order
        user.cart = [];
        await user.save();
        
        res.json({ 
            success: true, 
            message: "Order placed successfully!",
            orderId: newOrder.orderId
        });

    } catch (error) {
        console.error('Error processing COD order:', error);
        res.status(500).json({ 
            error: 'Failed to process order',
            details: error.message 
        });
    }
});

const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create Razorpay order
app.post("/api/create-razorpay-order", async (req, res) => {
    try {
        if (!req.oidc.isAuthenticated()) {
            return res.status(401).json({ loginRedirect: true });
        }

        const { items, customer, pricing } = req.body;

        // Create Razorpay order
        const order = await razorpay.orders.create({
            amount: Math.round(pricing.total * 100), // Convert to paisa
            currency: "INR",
            receipt: `order_${Date.now()}`,
            notes: {
                customerName: customer.name,
                customerPhone: customer.phone,
                shippingAddress: customer.address,
                userEmail: req.oidc.user.email,
                items: JSON.stringify(items.map(item => ({
                    productId: item.productId,
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price
                })))
            }
        });

        // Make sure to send back all required data
        res.json({
            orderId: order.id,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID, // Make sure this environment variable is set
            userEmail: req.oidc.user.email,
            amount: order.amount
        });

    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({ error: 'Failed to create order: ' + error.message });
    }
});

// Modify your verify-payment endpoint to create an order for Razorpay payments
app.post("/api/verify-payment", async (req, res) => {
    try {
        if (!req.oidc.isAuthenticated()) {
            return res.status(401).json({ success: false, error: "Please login to continue" });
        }

        const {
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature,
            orderDetails
        } = req.body;

        // Verify signature
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest("hex");

        const isAuthentic = expectedSignature === razorpay_signature;

        if (!isAuthentic) {
            return res.status(400).json({ success: false, error: 'Invalid payment signature' });
        }

        // Get user details
        const userData = req.oidc.user;

        // Fetch the Razorpay order details
        const razorpayOrder = await razorpay.orders.fetch(razorpay_order_id);

        // Format items details for telegram message
        const itemsList = orderDetails.items.map(item => `
- Name: ${item.name}
- Quantity: ${item.quantity}
- Price per item: ₹${item.price}
- Item Total: ₹${item.total}
- Seller: ${item.seller}
`).join('\n');

        // Format message for Telegram
        const message = `
🛍️ New Online Payment Order!

📦 Order Items:
${itemsList}

👤 Customer Details:
- Name: ${orderDetails.customer.name}
- Email: ${userData.email}
- Address: ${orderDetails.customer.address}
- Phone: ${orderDetails.customer.phone}

💰 Pricing Details:
- Subtotal: ₹${orderDetails.pricing.subtotal}
- Shipping: ₹${orderDetails.pricing.shipping}
- Tax: ₹${orderDetails.pricing.tax}
- Total Amount: ₹${orderDetails.pricing.total}

💳 Payment Details:
- Payment ID: ${razorpay_payment_id}
- Order ID: ${razorpay_order_id}
- Payment Status: Paid
- Amount Paid: ₹${razorpayOrder.amount / 100}

📅 Order Date: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
📝 Order Status: Confirmed
Payment Method: Online Payment (Razorpay)
`;

        // Send message to Telegram
        await bot.sendMessage(TELEGRAM_CHAT_ID, message);

        // Create new order for online payment
        const newOrder = new Order({
            orderId: `ORD-${Date.now()}`,
            userId: req.oidc.user.sub,
            items: orderDetails.items.map(item => ({
                productId: item.productId,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                image: item.image,
                seller: item.seller
            })),
            totalAmount: orderDetails.pricing.total,
            paymentMethod: 'Online Payment',
            shippingAddress: {
                fullName: orderDetails.customer.name,
                streetAddress: orderDetails.customer.address.split(',')[0].trim(),
                city: orderDetails.customer.address.split(',')[1].trim(),
                state: orderDetails.customer.address.split(',')[2].split('-')[0].trim(),
                pincode: orderDetails.customer.address.split(',')[2].split('-')[1].trim(),
                phone: orderDetails.customer.phone
            }
        });

        await newOrder.save();

        // Clear user's cart
        const user = await User.findOne({ auth0Id: req.oidc.user.sub });
        if (user) {
            user.cart = [];
            await user.save();
        }

        res.json({
            success: true,
            message: "Payment verified successfully",
            orderId: newOrder.orderId
        });

    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Payment verification failed: ' + error.message
        });
    }
});

// Add endpoint to get single order details
app.get("/api/orders/:orderId", async (req, res) => {
    if (!req.oidc.isAuthenticated()) {
        return res.status(401).json({ loginRedirect: true });
    }

    try {
        const order = await Order.findOne({
            orderId: req.params.orderId,
            userId: req.oidc.user.sub
        });

        if (!order) {
            return res.status(404).json({ error: "Order not found" });
        }

        res.json(order);
    } catch (error) {
        console.error("Error fetching order details:", error);
        res.status(500).json({ error: "Failed to fetch order details" });
    }
});

// Add a route to serve order.html
app.get("/order", (req, res) => {
    // Check if user is authenticated
    if (!req.oidc.isAuthenticated()) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, "public", "order.html"));
});

// Add this with your other order routes
app.post("/api/orders/:orderId/cancel", async (req, res) => {
    try {
        if (!req.oidc.isAuthenticated()) {
            return res.status(401).json({ error: "Please login to continue" });
        }

        console.log("Attempting to cancel order:", req.params.orderId);

        // Find and update the order in one operation
        const order = await Order.findOneAndUpdate(
            {
                orderId: req.params.orderId,
                userId: req.oidc.user.sub,
                status: 'Processing' // Only update if current status is Processing
            },
            { 
                $set: { 
                    status: 'Cancelled',
                    cancelledAt: new Date()
                }
            },
            { new: true } // Return the updated document
        );

        console.log("Updated order:", order);

        if (!order) {
            console.log("Order not found or not cancellable");
            return res.status(400).json({ 
                error: "Order not found or cannot be cancelled" 
            });
        }

        // Format items details for telegram message
        const itemsList = order.items.map(item => `
📦 Product Details:
- Product ID: ${item.productId}
- Name: ${item.name}
- Price: ₹${item.price}
- Quantity: ${item.quantity}
- Seller: ${item.seller}
`).join('\n');

        // Send Telegram notification with detailed information
        const message = `
🚫 Order Cancelled!

🔹 Order Information:
- Order ID: ${order.orderId}
- Order Date: ${new Date(order.orderDate).toLocaleString('en-IN')}
- Cancelled Date: ${new Date().toLocaleString('en-IN')}
- Payment Method: ${order.paymentMethod}
- Total Amount: ₹${order.totalAmount}

👤 Customer Details:
- Name: ${req.oidc.user.name}
- Email: ${req.oidc.user.email}
- User ID: ${order.userId}

📍 Shipping Address:
- Name: ${order.shippingAddress.fullName}
- Address: ${order.shippingAddress.streetAddress}
- City: ${order.shippingAddress.city}
- State: ${order.shippingAddress.state}
- Pincode: ${order.shippingAddress.pincode}
- Phone: ${order.shippingAddress.phone}

${itemsList}

💫 Order Status: Cancelled
`;

        await bot.sendMessage(TELEGRAM_CHAT_ID, message);
        console.log("Telegram notification sent with complete details");

        res.json({ 
            success: true, 
            message: "Order cancelled successfully",
            order: {
                orderId: order.orderId,
                orderDate: order.orderDate,
                cancelledAt: order.cancelledAt,
                status: order.status,
                totalAmount: order.totalAmount,
                paymentMethod: order.paymentMethod,
                items: order.items,
                shippingAddress: order.shippingAddress,
                customer: {
                    name: req.oidc.user.name,
                    email: req.oidc.user.email,
                    userId: order.userId
                }
            }
        });

    } catch (error) {
        console.error("Error cancelling order:", error);
        res.status(500).json({ error: "Failed to cancel order" });
    }
});

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
