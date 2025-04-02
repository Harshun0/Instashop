// Update the place-cod-order endpoint
app.post("/api/place-cod-order", async (req, res) => {
    try {
        if (!req.oidc.isAuthenticated()) {
            return res.status(401).json({ error: "Please login to place order" });
        }

        const { items, customer, pricing, orderDetails } = req.body;

        // Get user details from Auth0
        const userData = req.oidc.user;

        // Fetch seller information for each product
        const itemsWithSellers = await Promise.all(items.map(async (item) => {
            const product = await Product.findById(item.productId);
            return {
                ...item,
                seller: product ? product.seller : 'Unknown Seller'
            };
        }));

        // Format items details for telegram message with seller info
        const itemsList = itemsWithSellers.map(item => `
🏷️ Product Details:
- Name: ${item.name}
- Quantity: ${item.quantity}
- Price per item: ₹${item.price}
- Item Total: ₹${item.total}
- Seller: ${item.seller}
`).join('\n');

        // Format message for Telegram
        const message = `
🛍️ New COD Order!

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

        // Rest of your existing code...
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
            message: "Order placed successfully!" 
        });

    } catch (error) {
        console.error('Error processing COD order:', error);
        res.status(500).json({ 
            error: 'Failed to process order',
            details: error.message 
        });
    }
});

// Create Razorpay order
app.post("/api/create-razorpay-order", async (req, res) => {
    try {
        if (!req.oidc.isAuthenticated()) {
            return res.status(401).json({ loginRedirect: true });
        }

        const { items, customer, pricing, orderDetails } = req.body;

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

        res.json({
            orderId: order.id,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID,
            userEmail: req.oidc.user.email,
            amount: order.amount
        });

    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// Add Order Schema
const orderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    items: [{
        productId: String,
        name: String,
        price: Number,
        quantity: Number,
        image: String
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

// Get user orders endpoint
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

app.use(cors({
    origin: ['http://localhost:5000', 'http://127.0.0.1:5000'], // Replace with your frontend URLs
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
})); 