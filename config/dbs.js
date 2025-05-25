const mongoose = require("mongoose")

const ConnectDB = async ()=>{
    try{
        const conn = await mongoose.connect(process.env.MONGO_URI)
        console.log("MongoDB connected");
    }catch (e){
        console.error(`Error: ${e.message}`);
    }
}

module.exports = ConnectDB;