const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// MongoDB Connection Setup
const uri = 'mongodb+srv://Harshu:Harsh2004@cluster0.mvs49.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const client = new MongoClient(uri);
let database; // Store the database connection

async function connectDB() {
    try {
        if (!database) {
            await client.connect();
            database = client.db('test'); // Replace 'test' with your actual DB name
            console.log('✅ Connected to MongoDB');
        }
        return database;
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error);
        process.exit(1); // Stop the server if DB connection fails
    }
}

// Multer Storage Configuration for File Uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Fetch All Products
router.get('/products', async (req, res) => {
    try {
        const database = await connectDB();
        const collection = database.collection('products');
        const products = await collection.find({}).toArray();
        res.json(products);
    } catch (error) {
        console.error('❌ Error fetching data:', error);
        res.status(500).json({ message: 'Error fetching products' });
    }
});

// Update Product (with File Uploads)
router.put('/products/:id', upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 }
]), async (req, res) => {
    try {
        const productId = req.params.id;
        const database = await connectDB();
        const collection = database.collection('products');

        if (!ObjectId.isValid(productId)) {
            return res.status(400).json({ message: 'Invalid product ID' });
        }
        const objId = new ObjectId(productId);

        // Create update object from form fields
        const updateData = {
            name: req.body.name,
            seller: req.body.seller,
            stock: req.body.stock,
            metaDescription: req.body.metaDescription,
            detailedDescription: req.body.detailedDescription,
            category: req.body.category,
            originalPrice: parseFloat(req.body.originalPrice),
            discount: parseFloat(req.body.discount),
            price: parseFloat(req.body.price),
            deliveryChargeNagpur: parseFloat(req.body.deliveryChargeNagpur),
            deliveryChargeOutside: parseFloat(req.body.deliveryChargeOutside),
        };

        // Add optional category-specific fields
        if (req.body.subcategory) updateData.subcategory = req.body.subcategory;
        if (req.body.metal) updateData.metal = req.body.metal;
        if (req.body.occasion) updateData.occasion = req.body.occasion;

        // Handle uploaded images
        if (req.files) {
            const currentProduct = await collection.findOne({ _id: objId });

            if (req.body.image1) updateData.image1 = req.body.image1;
            if (req.body.image2) updateData.image2 = req.body.image2;
            if (req.body.image3) updateData.image3 = req.body.image3;
        }

        console.log('📝 Updating product with data:', updateData);

        const result = await collection.updateOne(
            { _id: objId },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.json({
            message: '✅ Product updated successfully',
            productId: productId,
            updatedFields: updateData
        });
    } catch (error) {
        console.error('❌ Error updating product:', error);
        res.status(500).json({ message: 'Error updating product', error: error.message });
    }
});

// Delete a Product
router.delete('/products/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        const database = await connectDB();
        const collection = database.collection('products');

        if (!ObjectId.isValid(productId)) {
            return res.status(400).json({ message: 'Invalid product ID' });
        }
        const objId = new ObjectId(productId);

        const result = await collection.deleteOne({ _id: objId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.json({ message: '✅ Product deleted successfully' });
    } catch (error) {
        console.error('❌ Error deleting product:', error);
        res.status(500).json({ message: 'Error deleting product', error: error.message });
    }
});

// Create New Product with Cloudinary Image URLs
router.post('/products', express.json(), async (req, res) => {
    try {
        const database = await connectDB();
        const collection = database.collection('products');

        console.log('Received product data:', req.body);

        // Create product object with default values
        const productData = {
            name: req.body.name || "",
            seller: req.body.seller || "",
            metaDescription: req.body.metaDescription || "",
            detailedDescription: req.body.detailedDescription || "",
            category: req.body.category || "",
            originalPrice: parseFloat(req.body.originalPrice) || 0,
            discount: parseFloat(req.body.discount) || 0,
            price: parseFloat(req.body.price) || 0,
            deliveryChargeNagpur: parseFloat(req.body.deliveryChargeNagpur) || 0,
            deliveryChargeOutside: parseFloat(req.body.deliveryChargeOutside) || 0,
            images: req.body.images || [], // Get images array directly
            createdAt: new Date()
        };

        // Add optional fields
        if (req.body.subcategory) productData.subcategory = req.body.subcategory;
        if (req.body.metal) productData.metal = req.body.metal;
        if (req.body.occasion) productData.occasion = req.body.occasion;

        console.log('📝 Creating new product:', productData);
        const result = await collection.insertOne(productData);

        res.status(201).json({
            message: '✅ Product created successfully',
            productId: result.insertedId,
            product: productData
        });
    } catch (error) {
        console.error('❌ Error creating product:', error);
        res.status(500).json({ message: 'Error creating product', error: error.message });
    }
});

module.exports = router;