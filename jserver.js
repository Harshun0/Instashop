require('dotenv').config();
console.log('TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID);  // Should show your Twilio SID

// First, let's modify the MongoDB connection to be more explicit
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log("✅ MongoDB Connected Successfully");
    console.log("Connected to database:", mongoose.connection.name);
}).catch(err => {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1);
});

// Update the User Schema with better validation
const userSchema = new mongoose.Schema({
    fullName: { 
        type: String, 
        required: [true, 'Full name is required'],
        trim: true 
    },
    email: { 
        type: String, 
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true
    },
    password: { 
        type: String, 
        required: [true, 'Password is required']
    },
    mobileNumber: { 
        type: String, 
        trim: true 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

// Add pre-save middleware to log data before saving
userSchema.pre('save', function(next) {
    console.log('Attempting to save user:', this);
    next();
});

const User = mongoose.model('Registration', userSchema);

// Update the registration endpoint with more detailed logging
app.post("/api/register", async (req, res) => {
    try {
        console.log('📝 Registration request received:', req.body);
        
        const { fullName, email, password, mobileNumber } = req.body;
        
        // Validate required fields
        if (!fullName || !email || !password) {
            console.log('❌ Missing required fields');
            return res.status(400).json({ 
                error: 'Missing required fields',
                received: { fullName: !!fullName, email: !!email, password: !!password }
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.log('❌ Email already exists:', email);
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Create new user
        const user = new User({
            fullName,
            email,
            password,
            mobileNumber
        });

        // Save user
        console.log('💾 Attempting to save user to database...');
        const savedUser = await user.save();
        console.log('✅ User saved successfully:', savedUser);

        res.status(201).json({ 
            message: 'Registration successful',
            userId: savedUser._id
        });
        
    } catch (error) {
        console.error("❌ Registration error:", error);
        console.error("Error stack:", error.stack);
        res.status(500).json({ 
            error: 'Registration failed', 
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Add to wishlist
app.post('/api/wishlist', async (req, res) => {
    if (!req.user) {
        return res.json({ loginRedirect: true });
    }
    
    try {
        const { productId, name, price, image } = req.body;
        await User.findByIdAndUpdate(req.user._id, {
            $addToSet: { 
                wishlist: { productId, name, price, image }
            }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add to wishlist' });
    }
});

// Remove from wishlist
app.delete('/api/wishlist/:productId', async (req, res) => {
    if (!req.user) {
        return res.json({ loginRedirect: true });
    }
    
    try {
        await User.findByIdAndUpdate(req.user._id, {
            $pull: { 
                wishlist: { productId: req.params.productId }
            }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to remove from wishlist' });
    }
});

// Get wishlist items
app.get('/api/wishlist', async (req, res) => {
    if (!req.user) {
        return res.json({ loginRedirect: true });
    }
    
    try {
        const user = await User.findById(req.user._id);
        res.json(user.wishlist || []);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch wishlist' });
    }
});

// Move item from wishlist to cart
app.post('/api/wishlist/:productId/move-to-cart', async (req, res) => {
    if (!req.user) {
        return res.json({ loginRedirect: true });
    }
    
    try {
        const user = await User.findById(req.user._id);
        const wishlistItem = user.wishlist.find(item => item.productId.toString() === req.params.productId);
        
        if (wishlistItem) {
            // Add to cart
            await User.findByIdAndUpdate(req.user._id, {
                $push: { 
                    cart: {
                        productId: wishlistItem.productId,
                        name: wishlistItem.name,
                        price: wishlistItem.price,
                        image: wishlistItem.image,
                        quantity: 1
                    }
                },
                // Remove from wishlist
                $pull: { 
                    wishlist: { productId: req.params.productId }
                }
            });
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to move item to cart' });
    }
});

// Update the search endpoint
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

// Serve the product.html file
app.get("/product.html", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "product.html"));
});

// API endpoint for getting product details
app.get("/app/products/:id", async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }
        res.json(product);
    } catch (error) {
        console.error("Error fetching product:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// If you're using category-specific routes, add these as well
app.get("/:category/product/:id", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "product.html"));
});

// Add this logging middleware for debugging
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

const productSchema = new mongoose.Schema({
    images: {
        type: [String], // Array of image URLs
        required: true,
        validate: {
            validator: function(v) {
                return v.length > 0; // Must have at least one image
            },
            message: 'Product must have at least one image'
        }
    },
});

// Seller Login Route
app.post("/api/seller/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find seller in database
        const seller = await mongoose.model('sellerdata').findOne({ email });

        if (!seller) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        if (seller.password !== password) { // Note: In production, use proper password hashing
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Login successful
        res.json({ success: true });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: 'Login failed' });
    }
}); 