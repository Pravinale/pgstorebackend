const mongoose = require('mongoose')


//Creating Schema for newuser 
const UserSchema = new mongoose.Schema({
    username: String,
    phonenumber: Number,
    address: String,
    email: String,
    password: String,
    role: String,
    resetToken: String,
    resetTokenExpiry: Date,
    activationToken: String,  // Add this field
    activationTokenExpiry: Date,  // Add this field
    isActive: { type: Boolean, default: false }  // Add this field
}
)

//creating modlel for newuser
const UserModel = mongoose.model("User", UserSchema)
module.exports = UserModel