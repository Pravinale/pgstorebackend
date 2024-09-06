const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    phoneNumber: { type: String, required: true }, // New field
    email: { type: String, required: true },       // New field
    address: { type: String, required: true },     // New field
    products: [
        {
            productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
            name: { type: String, required: true },
            quantity: { type: Number, required: true },
            image: { type: String, required: true },      // New field
            desc: { type: String, required: true } // New field
        }
    ],
    price: { type: Number, required: true },
    purchaseDate: { type: Date, default: Date.now },
    paymentMethod: { type: String, enum: ["esewa", "khalti","Cash in hand"], required: true },
    status: { type: String, enum: ["pending", "completed", "refunded"], default: "pending" },
    deliveryStatus: { type: String, enum: ["in progress", "completed"], default: "in progress" },
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
