const mongoose = require("mongoose")

const StockManagementSchema = new mongoose.Schema({
    productName:String,
    productDesc:String,
    imageURL:String,
    productPrice:String,
    screenOption:String,
    color:String,
    badges:String,
    category:String
})

module.exports = mongoose.model("StockManage",StockManagementSchema)