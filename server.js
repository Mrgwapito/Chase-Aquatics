const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const Product = require('./models/productModel'); // Ensure this path is correct
const Cart = require('./models/cartModel'); // Import the Cart model
const User = require('./models/userModel'); // Make sure this path is correct


const app = express();
const port = 3000;

// Middleware to parse JSON request bodies
app.use(express.json());

// Serve static files (CSS, JS, images)
app.use(express.static(path.join(__dirname))); // Serves files in the 'capstone' folder (like ipage.js, Ipage.css, images, etc.)

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/Lifeinabox', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.log('MongoDB connection error:', err));

// ✅ Route to save product data (POST)
app.post('/api/products', async (req, res) => {
    try {
        const { name, category, price, description, image, additionalImages } = req.body;
        const newProduct = new Product({
            name,
            category,
            price,
            description,
            image,
            additionalImages
        });
        await newProduct.save();
        res.status(201).send('Product saved successfully');
    } catch (err) {
        res.status(500).send('Error saving product: ' + err.message);
    }
});

// ✅ Route to fetch all product data (GET)
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find(); // Fetch all products
        res.json(products);
    } catch (err) {
        res.status(500).send('Error fetching products: ' + err.message);
    }
});

// ✅ Route to fetch a single product by custom 'id' (GET)
app.get('/api/product/:id', async (req, res) => {
    const productId = parseInt(req.params.id); // Ensure the id is an integer (stored as an integer in MongoDB)

    try {
        const product = await Product.findOne({ id: productId }); // Query by 'id' field (custom field)

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.json(product); // Send the product data as a response
    } catch (error) {
        res.status(500).json({ message: "Error fetching product", error });
    }
});

// ✅ NEW: Route to fetch related products by category (excluding current product)
app.get('/api/products/:id/related', async (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        const selectedProduct = await Product.findOne({ id: productId });

        if (!selectedProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const relatedProducts = await Product.find({
            category: selectedProduct.category,
            id: { $ne: productId } // Exclude current product
        }).limit(4); // Optional: Limit to 4 related products

        res.json(relatedProducts);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching related products', error: err.message });
    }
});

// ✅ Backend route to add product to cart
app.post('/api/cart/add', async (req, res) => {
    const { userId, productId, quantity } = req.body;

    if (!userId || !productId || !quantity) {
        return res.status(400).json({ success: false, message: "Invalid input data" });
    }

    try {
        // Check if the cart already exists for the user
        let cart = await Cart.findOne({ userId });

        // If cart doesn't exist, create a new cart
        if (!cart) {
            cart = new Cart({
                userId,
                items: [
                    { productId, quantity }
                ]
            });
        } else {
            // If cart exists, find the product in the cart
            const existingProduct = cart.items.find(item => item.productId.toString() === productId);

            if (existingProduct) {
                // If product already in cart, update quantity
                existingProduct.quantity += quantity;
            } else {
                // If product not in cart, add it
                cart.items.push({ productId, quantity });
            }
        }

        // Save the cart
        await cart.save();

        res.json({ success: true, message: "Product added to cart" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error adding to cart", error: err.message });
    }
});


app.post('/login', async (req, res) => {
    console.log('Login attempt:', req.body); // Log the email and password being sent
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            console.log('User not found');
            return res.status(400).json({ success: false, message: 'User not found' });
        }

        if (user.password !== password) {
            console.log('Incorrect password');
            return res.status(400).json({ success: false, message: 'Incorrect password' });
        }

        console.log('Login successful');
        return res.status(200).json({ success: true, message: 'Login successful' });
    } catch (err) {
        console.error('Server error:', err); // Log the error
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


app.post('/register', async (req, res) => {
    console.log('Register route hit');
    try {
        const { fullName, email, password } = req.body;

        // Check if the email already exists in the database
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        // Create a new user if no existing user found
        const newUser = new User({
            email,
            password,
            fullName
        });

        await newUser.save(); // Save the new user to the database

        // Return a success response
        res.setHeader('Content-Type', 'application/json');
        return res.status(201).json({ success: true, message: 'User registered successfully' });
    } catch (err) {
        // Catch any errors and respond with a 500 error
        console.log('Error in register route:', err);  // Log error to the console for debugging
        res.setHeader('Content-Type', 'application/json');
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


// Serve landing page (http://localhost:3000/)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'landingpage.html'));
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});


