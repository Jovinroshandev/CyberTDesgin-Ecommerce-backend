// Load core dependencies
const express = require("express"); // Web framework for handling HTTP requests
const cors = require("cors"); // Middleware to enable Cross-Origin Resource Sharing
const multer = require("multer"); // Middleware for handling multipart/form-data (file uploads)

// Load external service integrations
const cloudinary = require("cloudinary").v2; // Cloud image hosting platform
const { CloudinaryStorage } = require("multer-storage-cloudinary"); // Cloudinary storage engine for multer

// Load internal utilities and configuration
const connectDB = require("./config/dbs"); // MongoDB connection utility
const dotenv = require('dotenv'); // Load environment variables from .env file
dotenv.config(); // Initialize dotenv

// Load MongoDB models
const User = require("./models/user");
const StockManagement = require("./models/stockmanagement");

// Create express app instance
const app = express();
const PORT = process.env.PORT || 5000;

// Load route modules
const cartRoutes = require("./routes/cart");
const orderRoutes = require("./routes/order");

// Load utility and crypto modules
const razorpay = require("razorpay"); // Razorpay payment gateway SDK
const crypto = require("crypto"); // For secure signature verification
const bcrypt = require("bcrypt"); // Password hashing library
const jwt = require('jsonwebtoken'); // JWT library for access/refresh token management

// Constants
const saltRounds = 10; // Number of salt rounds for bcrypt hashing
const JWT_SECRET = process.env.JWT_SECRET; // Secret for signing access tokens

// Load middleware functions
const { authenticateToken, authorizeRoles } = require("./middleware/auth");

// Validate critical environment variables at server startup
if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
    console.error("FATAL ERROR: JWT secrets are not configured");
    process.exit(1); // Exit process if critical config is missing
}

// Middleware for parsing JSON requests and enabling CORS
app.use(express.json());
app.use(cors());

// Initialize database connection, then auto-create admin user if not exists
connectDB().then(() => createAdminUser());

// Create admin user on first server start using env credentials
async function createAdminUser() {
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminEmail || !adminPassword) {
            console.warn("Admin credentials not set in .env");
            return;
        }

        const existingAdmin = await User.findOne({ email: adminEmail });
        if (existingAdmin) return;

        const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);
        const adminUser = new User({ email: adminEmail, password: hashedPassword, role: "admin" });
        await adminUser.save();
    } catch (error) {
        console.error("Error creating admin user:", error);
    }
}

// Utility: Generate JWT access token (expires in 15 min)
const generateAccessToken = (user) => {
    if (!JWT_SECRET) throw new Error("JWT_SECRET is not configured");
    return jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "15m" });
};

// Utility: Generate JWT refresh token (expires in 7 days)
const generateRefreshToken = (user) => {
    if (!process.env.JWT_REFRESH_SECRET) throw new Error("JWT_REFRESH_SECRET is not configured");
    return jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
};

// Utility: Verify basic structure of JWT token
const verifyTokenStructure = (token) => {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split('.');
    return parts.length === 3;
};

// Route: Health check
app.get('/', (req, res) => {
    res.send('API is running...');
});

// Route: Generate new access token using refresh token
app.post("/token", async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ message: "Refresh token required" });

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const user = await User.findById(decoded.id);

        if (!user || !user.refreshTokens.includes(refreshToken)) {
            return res.status(403).json({ message: "Invalid refresh token" });
        }

        const newAccessToken = generateAccessToken(user);
        if (!verifyTokenStructure(newAccessToken)) throw new Error("Invalid token structure");

        res.json({ accessToken: newAccessToken });
    } catch (err) {
        console.error(err);
        res.status(403).json({ message: "Invalid or expired refresh token" });
    }
});

// Route: Register new user
app.post('/create-user', async (req, res) => {
    const { email, password } = req.body;

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ success: false, message: "User already exists" });

        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const user = new User({ email, password: hashedPassword });

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        if (!verifyTokenStructure(accessToken) || !verifyTokenStructure(refreshToken)) {
            throw new Error("Token generation failed");
        }

        user.refreshTokens.push(refreshToken);
        await user.save();

        res.status(201).json({
            success: true,
            message: "User Created Successfully",
            accessToken,
            refreshToken,
            user: { id: user._id, email: user.email }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Route: User login
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ success: false, error: "User does not exist!" });

        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) return res.status(401).json({ success: false, error: "Incorrect password!" });

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        if (!verifyTokenStructure(accessToken) || !verifyTokenStructure(refreshToken)) {
            throw new Error("Token generation failed");
        }

        user.refreshTokens.push(refreshToken);
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Login successfully!',
            accessToken,
            refreshToken,
            user: { id: user._id, email: user.email, role: user.role }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: "Server error" });
    }
});

// Route: Google-based signup check
app.post("/google-signup", async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.json({ success: true, error: "User not exists!" });
        return res.json({ success: false, message: "User exist. Please Login" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: "Server error" });
    }
});

// Route: Google login
app.post("/google-login", async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ success: false, error: "User not exists!" });

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        if (!verifyTokenStructure(accessToken) || !verifyTokenStructure(refreshToken)) {
            throw new Error("Token generation failed");
        }

        user.refreshTokens.push(refreshToken);
        await user.save();

        res.status(200).json({
            success: true,
            message: "Login Successfully!",
            accessToken,
            refreshToken,
            user: { id: user._id, email: user.email, role: user.role }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: "Server error" });
    }
});

// Route: Change user password
app.put('/change-password', async (req, res) => {
    const { email, oldPassword, newPassword } = req.body;
    if (!email || !oldPassword || !newPassword) {
        return res.status(400).json({ message: "All fields are required" });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) return res.status(401).json({ message: "Old password is incorrect" });

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.json({ message: "Password changed successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// Route: Update user email
app.put("/update-email", async (req, res) => {
    const { oldEmail, newEmail } = req.body;

    try {
        if (!oldEmail || !newEmail) return res.status(400).json({ message: "Old and new email required" });

        const user = await User.findOne({ email: oldEmail });
        if (!user) return res.status(404).json({ message: "User not found" });

        const emailExists = await User.findOne({ email: newEmail });
        if (emailExists) return res.status(409).json({ message: "Email already in use" });

        user.email = newEmail;
        await user.save();

        res.status(200).json({ message: "Email updated successfully. Please Login again!", email: newEmail });
    } catch (error) {
        console.error("Error updating email:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// Route: Logout user by revoking refresh token
app.post("/logout", async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ message: "Refresh token required" });

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const user = await User.findById(decoded.id);
        if (!user) return res.status(400).json({ message: "User not found" });

        user.refreshTokens = user.refreshTokens.filter(token => token !== refreshToken);
        await user.save();

        res.json({ message: "Logged out successfully" });
    } catch (err) {
        console.error(err);
        res.status(400).json({ message: "Invalid refresh token" });
    }
});

// Admin-protected route: Add a product to inventory
app.post("/admin-management", authenticateToken, authorizeRoles("admin"), async (req, res) => {
    try {
        const { productName, productDesc, imageURL, productPrice, screenOption, color, badges, category } = req.body;

        const addProduct = new StockManagement({
            productName, productDesc, imageURL, productPrice, screenOption, color, badges, category
        });

        const savedProduct = await addProduct.save();
        res.status(201).json({ message: "Product add successfully!", product: savedProduct });
    } catch (error) {
        res.status(500).json({ message: "An error occurred while adding the product", error: error.message });
    }
});

// Route: Delete product by ID
app.delete("/delete-product/:id", async (req, res) => {
    try {
        const deletedProduct = await StockManagement.findByIdAndDelete(req.params.id);
        if (!deletedProduct) return res.status(404).json({ message: "Product not found" });

        res.status(200).json({ message: "Product deleted successfully" });
    } catch (error) {
        console.error("Error deleting product:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// Configure Cloudinary for image uploads
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});


// Multer setup for handling uploads to Cloudinary
const storage = new CloudinaryStorage({
    cloudinary,
    params: { allowed_formats: ["jpg", "png"] },
});
const upload = multer({ storage });

// Route: Upload image to Cloudinary
app.post("/upload", (req, res, next) => {
    console.log("🟡 Middleware reached");
    next();
}, (req, res, next) => {
    upload.single("image")(req, res, function (err) {
        if (err) {
            console.error("🟥 Multer/Cloudinary upload error:", err);
            return res.status(400).json({ success: false, error: err.message });
        }

        if (!req.file) {
            console.warn("⚠️ No file uploaded.");
            return res.status(400).json({ success: false, error: "No file uploaded." });
        }

        console.log("🟢 Upload successful:", req.file);
        res.status(200).json({
            success: true,
            message: "Upload succeeded",
            url: req.file.path,
        });
    });
});





// Route: Retrieve all products
app.get("/get-data", async (req, res) => {
    try {
        const data = await StockManagement.find();
        res.json({ data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Razorpay: Payment order creation
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_SECRET_KEY = process.env.RAZORPAY_SECRET_KEY;

app.post("/order-now", async (req, res) => {
    try {
        const { amount } = req.body;
        const razorpayInstance = new razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_SECRET_KEY });

        const options = {
            amount: amount * 100,
            currency: "INR",
            receipt: crypto.randomBytes(10).toString("hex"),
        };

        razorpayInstance.orders.create(options, (error, order) => {
            if (error) return res.status(500).json({ error: "Order Creation Failed!" });
            res.status(200).json({ data: order });
        });
    } catch (error) {
        console.error("Server crash error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Razorpay: Verify payment signature
app.post("/verify", (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
        const expectedSignature = crypto.createHmac("sha256", RAZORPAY_SECRET_KEY)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        if (expectedSignature === razorpay_signature) return res.status(200).send("Success");
        res.status(400).send("Failure");
    } catch (error) {
        console.log(error);
        res.status(500).send("Server Error");
    }
});

// Mount cart and order routes
app.use("/cart", cartRoutes);
app.use("/order", orderRoutes);

// Start server on defined port
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
