const express = require("express")
const cors = require("cors")
const connectDB = require("./config/dbs")
const dotenv = require('dotenv')
const User = require("./models/user")

const app = express()
const PORT = process.env.PORT || 5000;

// middleware
app.use(express.json())
app.use(cors())
dotenv.config();

// Connect MongoDB
connectDB()

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
        const existingUser = await User.findOne({email})
        if (existingUser){
            return res.json({success:false,message:"User already exists"})
        }

        // Create and Save New User
        const user = new User({ email, password })
        await user.save()
        res.status(201).json({success:true,message:"User Created Successfully"})

    }catch(error){
        console.error(error)
        res.status(500).json({success:false,message:"Server error"})
    }
})

// Manual Login
app.post('/login', async(req,res)=>{
    const {email,password} = req.body;
    try{
        // Check user exists or Not
        const user = await User.findOne({email})
        if(!user){
            return res.json({success:false,error:"User not exists!"})
        }
        // check user password and password from db
        if (user.password !== password){
            return res.json({success:false,error:"Incorrect password!"})
        }
        // finally approve login
        res.status(200).json({success:true,message:'Login successfully!'})
    } catch (error){
        console.error(error);
        res.status(500).json({success:false,error:"Server error"})
    }
})

// Google Login
app.post("/google-login", async (req,res)=>{
    const {email} = req.body;
    try{
        const user = await User.findOne({email}) // Check user email exist
        if(!user){ 
            return res.json({success:false,error:"User not exists!"})
        }else{
            return res.json({success:true,message:"Login Successfully!"})
        }
    } catch(error){
        console.error(error);
        res.status(500).json({success:false,error:"Server error"})
    }
})

// Google Signup
app.post("/google-signup", async (req,res)=>{
    const {email} = req.body;
    try{
        const user = await User.findOne({email}) // Check user email exist
        if(!user){ 
            return res.json({success:true,error:"User not exists!"})
        }else{
            return res.json({success:false,message:"User exist. Please Login"})
        }
    } catch(error){
        console.error(error);
        res.status(500).json({success:false,error:"Server error"})
    }
})

// Google Signup

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});