const express = require("express");
const cors = require("cors");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const connectDB = require("./config/dbs");
const dotenv = require('dotenv');
dotenv.config();
const User = require("./models/user");
const StockManagement = require("./models/stockmanagement");
const app = express();
const PORT = process.env.PORT || 5000;
const cartRoutes = require("./routes/cart");
const orderRoutes = require("./routes/order");
const razorpay = require("razorpay");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const JWT_SECRET = process.env.JWT_SECRET;
const jwt = require('jsonwebtoken');
const { authenticateToken, authorizeRoles } = require("./middleware/auth");

// Validate environment variables at startup
if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
    console.error("FATAL ERROR: JWT secrets are not configured");
    process.exit(1);
}

// middleware
app.use(express.json());
app.use(cors())
const allowedOrigins = [
  "http://localhost:3000",
  "https://cyber-t-desgin-ecommerce-front.vercel.app"
];Add commentMore actions

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));

// Connect MongoDB
connectDB().then(() => {
    createAdminUser();
});

async function createAdminUser() {
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminEmail || !adminPassword) {
            console.warn("Admin credentials not set in .env");
            return;
        }

        const existingAdmin = await User.findOne({ email: adminEmail });

        if (existingAdmin) {
            return;
        }

        const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);

        const adminUser = new User({
            email: adminEmail,
            password: hashedPassword,
            role: "admin",
        });

        await adminUser.save();

    } catch (error) {
        console.error("Error creating admin user:", error);
    }
}

const generateAccessToken = (user) => {
    if (!JWT_SECRET) {
        throw new Error("JWT_SECRET is not configured");
    }
    return jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "15m" });
};

const generateRefreshToken = (user) => {
    if (!process.env.JWT_REFRESH_SECRET) {
        throw new Error("JWT_REFRESH_SECRET is not configured");
    }
    return jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
};

const verifyTokenStructure = (token) => {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split('.');
    return parts.length === 3;
};

// Routes
app.get('/', (req, res) => {
    res.send('API is running...');
});

app.post("/token", async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(401).json({ message: "Refresh token required" });
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const user = await User.findById(decoded.id);

        if (!user || !user.refreshTokens.includes(refreshToken)) {
            return res.status(403).json({ message: "Invalid refresh token" });
        }

        const newAccessToken = generateAccessToken(user);
        if (!verifyTokenStructure(newAccessToken)) {
            throw new Error("Invalid token structure");
        }

        res.json({ accessToken: newAccessToken });
    } catch (err) {
        console.error(err);
        res.status(403).json({ message: "Invalid or expired refresh token" });
    }
});

app.post('/create-user', async (req, res) => {
    const { email, password } = req.body;

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "User already exists" });
        }

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

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, error: "User does not exist!" });
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            return res.status(401).json({ success: false, error: "Incorrect password!" });
        }

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
// Google Signup
app.post("/google-signup", async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email }) // Check user email exist
        if (!user) {
            return res.json({ success: true, error: "User not exists!" })
        } else {
            return res.json({ success: false, message: "User exist. Please Login" })
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: "Server error" })
    }
})

app.post("/google-login", async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, error: "User not exists!" });
        }

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

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedNewPassword;
    await user.save();

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


app.put("/update-email", async (req, res) => {
  const { oldEmail, newEmail } = req.body;

  try {
    if (!oldEmail || !newEmail) {
      return res.status(400).json({ message: "Old and new email required" });
    }

    const user = await User.findOne({ email: oldEmail });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Optional: Check if newEmail already exists in DB
    const emailExists = await User.findOne({ email: newEmail });
    if (emailExists) {
      return res.status(409).json({ message: "Email already in use" });
    }

    user.email = newEmail;
    await user.save();

    res.status(200).json({ message: "Email updated successfully. Please Login again!", email: newEmail });
  } catch (error) {
    console.error("Error updating email:", error);
    res.status(500).json({ message: "Server error" });
  }
});


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

// Admin routes
app.post("/admin-management", authenticateToken, authorizeRoles("admin"), async (req, res) => {
    try {
        const { productName, productDesc, imageURL, productPrice, screenOption, color, badges, category } = req.body;
        const addProduct = new StockManagement({
            productName,
            productDesc,
            imageURL,
            productPrice,
            screenOption,
            color,
            badges,
            category
        });
        const savedProduct = await addProduct.save();
        res.status(201).json({
            message: "Product add successfully!",
            product: savedProduct
        });
    } catch (error) {
        res.status(500).json({
            message: "An error occurred while adding the product",
            error: error.message
        });
    }
});

app.delete("/delete-product/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const deletedProduct = await StockManagement.findByIdAndDelete(id);
        if (!deletedProduct) {
            return res.status(404).json({ message: "Product not found" });
        }
        res.status(200).json({ message: "Product deleted successfully" });
    } catch (error) {
        console.error("Error deleting product:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// Cloudinary configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        allowed_formats: ["jpg", "png"],
    },
});

const upload = multer({ storage });

app.post("/upload", upload.single("image"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }
    res.json({ url: req.file.path });
});

app.get("/get-data", async (req, res) => {
    try {
        const data = await StockManagement.find();
        res.json({ data: data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Razorpay configuration
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_SECRET_KEY = process.env.RAZORPAY_SECRET_KEY;

app.post("/order-now", async (req, res) => {
    try {
        const { amount } = req.body;
        const razorpayInstance = new razorpay({
            key_id: RAZORPAY_KEY_ID,
            key_secret: RAZORPAY_SECRET_KEY
        });

        const options = {
            amount: amount * 100,
            currency: "INR",
            receipt: crypto.randomBytes(10).toString("hex"),
        };

        razorpayInstance.orders.create(options, (error, order) => {
            if (error) {
                console.error("Razorpay order creation error:", error);
                return res.status(500).json({ error: "Order Creation Failed!" });
            }
            return res.status(200).json({ data: order });
        });
    } catch (error) {
        console.error("Server crash error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post("/verify", (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
        const requestedSign = crypto.createHmac("sha256", process.env.RAZORPAY_SECRET_KEY)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest("hex");

        if (requestedSign === razorpay_signature) {
            res.status(200).send("Success");
        } else {
            res.status(400).send("Failure");
        }
    } catch (error) {
        console.log(error);
        res.status(500).send("Server Error");
    }
});

// Mount routes
app.use("/cart", cartRoutes);
app.use("/order", orderRoutes);

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});