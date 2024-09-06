


const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    title: String,
    image: String,
    desc: String,
    category: String,
    price: Number,
    stock: Number,
});

const ProductModel = mongoose.model('Product', ProductSchema);

module.exports = ProductModel;
