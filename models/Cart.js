const mongoose = require("mongoose")

const CartSchema = new mongoose.Schema({
  UserId:String,
  Items:[
    {
      productId:String,
      quantity:Number
    }
  ]
})

module.exports = mongoose.model("Cart",CartSchema)