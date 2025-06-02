const express = require("express")
const cors = require("cors")
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const connectDB = require("./config/dbs")
const dotenv = require('dotenv')
dotenv.config();
const User = require("./models/user")
const StockManagement = require("./models/stockmanagement")
const app = express()
const PORT = process.env.PORT || 5000;
const cartRoutes = require("./routes/cart")
// middleware
app.use(express.json())
const allowedOrigins = [
  "http://localhost:3000",
  "https://cyber-t-desgin-ecommerce-front.vercel.app"
];

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
connectDB()

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

app.use("/cart",cartRoutes)

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

// Routes
app.get('/', (req, res) => {
    // For Testing Purpose.. Api is working or not..
    res.send('API is running...');
});

app.post('/create-user', async (req, res) => {
    // Create User and storage data in mongodb
    const { email, password } = req.body;
    try {
        // Check User Already Exist
        const existingUser = await User.findOne({ email })
        if (existingUser) {
            return res.json({ success: false, message: "User already exists" })
        }

        // Create and Save New User
        const user = new User({ email, password })
        await user.save()
        res.status(201).json({ success: true, message: "User Created Successfully" })

    } catch (error) {
        console.error(error)
        res.status(500).json({ success: false, message: "Server error" })
    }
})

// Manual Login
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        // Check user exists or Not
        const user = await User.findOne({ email })
        if (!user) {
            return res.json({ success: false, error: "User not exists!" })
        }
        // check user password and password from db
        if (user.password !== password) {
            return res.json({ success: false, error: "Incorrect password!" })
        }
        // finally approve login
        res.status(200).json({ success: true, message: 'Login successfully!' })
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: "Server error" })
    }
})

// Google Login
app.post("/google-login", async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email }) // Check user email exist
        if (!user) {
            return res.json({ success: false, error: "User not exists!" })
        } else {
            return res.json({ success: true, message: "Login Successfully!" })
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: "Server error" })
    }
})


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


// Admin Stock Management
app.post("/admin-management", async (req, res) => {
    try {
        const { productName, 
            productDesc, 
            imageURL, 
            productPrice,
            screenOption,
            color, 
            badges,
            category } = req.body;
        const addProduct = new StockManagement(
            {
            productName, 
            productDesc, 
            imageURL, 
            productPrice,
            screenOption,
            color,
            badges,
            category
            }
        )
        const savedProduct = await addProduct.save()
        res.status(201).json({
            message: "Product add successfully!",
            product:savedProduct
        })
    } catch (error){
        res.status(500).json({
            message:"An error occured while adding the product",
            error:error.message
        })
    }
})


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

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});