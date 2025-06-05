const mongoose = require("mongoose")

const OrderSchema = new mongoose.Schema(
  {
    UsrId: String,
    Items: [
      {
        productId: String,
        quantity: Number,
        productName: String,
        productPrice: Number,
        imageURL: String,
      },
    ],
  },
  { timestamps: true } // <== This will auto-add createdAt and updatedAt
);


module.exports = mongoose.model("Orders",OrderSchema)