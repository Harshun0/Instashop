const express = require('express');
const mongoose = require('mongoose');
const Product = require('./models/Product'); // Ensure you have a Product model
const app = express();

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("✅ MongoDB Connected"))
  .catch(err => {
      console.error("❌ MongoDB Connection Error:", err);
      process.exit(1);
  });

app.use(express.static('public')); // Serve static files from 'public' folder

// Fetch only jewellery products
app.get('/jewellery', async (req, res) => {
    try {
        const jewelleryProducts = await Product.find({ category: "Jewellery" }); 
        res.json(jewelleryProducts);
    } catch (error) {
        res.status(500).json({ message: "Error fetching jewellery products", error });
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));
