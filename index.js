const express = require('express');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const ProductModel = require('./models/Product');
const UserModel = require('./models/User');
const CategoryModel = require('./models/Category');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const Order = require('./models/Orders');
const bodyParser = require('body-parser');
const { getEsewaPaymentHash, verifyEsewaPayment } = require("./esewa");
const Payment = require("./models/paymentModel");
const PORT = process.env.PORT || 3001 

const app = express();
const BASE_URL = process.env.REACT_APP_BASE_URL;
app.use(express.json());
app.use(cors());
// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${BASE_URL}`);
});


// Set up storage engine for Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Specify the directory to store images
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname); // Name the file with a timestamp
    }
});

// Initialize upload middleware
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        // Accept only image files
        const filetypes = /jpeg|jpg|png|webp|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Invalid file type. Only JPEG, PNG, and GIF files are allowed.'));
    }
});






// Serve static files (like uploaded images)
app.use('/uploads', express.static('uploads'));

// Add a new product with image upload
app.post('/products', upload.single('image'), (req, res) => {
    const { title, category, price, stock, desc } = req.body;
    const image = req.file ? req.file.path : ''; // Access the uploaded file's path

    ProductModel.create({ title, image, category, price, stock, desc })
        .then(newProduct => res.json(newProduct))
        .catch(err => res.status(500).json({ message: 'Server error', error: err }));
});









// Delete a product by ID
app.delete('/products/:id', (req, res) => {
    const { id } = req.params;

    ProductModel.findByIdAndDelete(id)
        .then(deletedProduct => {
            if (!deletedProduct) {
                return res.status(404).json({ message: 'Product not found' });
            }

            // Delete the associated image if it exists
            const oldImagePath = path.join(__dirname, deletedProduct.image);
            if (fs.existsSync(oldImagePath)) {
                fs.unlinkSync(oldImagePath); // Delete old image file
            }

            res.json({ message: 'Product deleted successfully' });
        })
        .catch(err => res.status(500).json({ message: 'Server error', error: err }));
});

// Get all products
app.get('/products', (req, res) => {
    ProductModel.find()
        .then(products => res.json(products))
        .catch(err => res.status(500).json({ message: 'Server error', error: err }));
});

// Get product by ID
app.get('/products/:id', (req, res) => {
    const { id } = req.params;
    ProductModel.findById(id)
        .then(product => res.json(product))
        .catch(err => res.status(500).json({ message: 'Server error', error: err }));
});

// Update stock for a product 
app.put('/products/:id/stock', (req, res) => {
    const { id } = req.params;
    const { quantityChange } = req.body;

    console.log('Updating stock for product:', id);
    console.log('Quantity change:', quantityChange);

    ProductModel.findById(id)
      .then(product => {
        if (!product) {
          return res.status(404).json({ message: 'Product not found' });
        }

        const newStock = product.stock + quantityChange;
        console.log('New stock value:', newStock);

        if (newStock < 0) {
          return res.status(400).json({ message: 'Insufficient stock' });
        }

        product.stock = newStock;

        return product.save()
          .then(() => res.json({ message: 'Stock updated successfully', stock: product.stock }))
          .catch(err => {
            console.error('Error saving product:', err);
            res.status(500).json({ message: 'Error updating stock', error: err.message });
          });
      })
      .catch(err => {
        console.error('Error finding product:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
      });
});



// Update a product
app.put('/products/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        const updatedData = req.body;
        const updatedProduct = await ProductModel.findByIdAndUpdate(productId, updatedData, { new: true });
        if (!updatedProduct) {
            return res.status(404).send('Product not found');
        }
        res.json(updatedProduct);
    } catch (error) {
        res.status(500).send('Server error');
    }
});

// Delete old image
app.delete('/products/:id/image', async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await ProductModel.findById(productId);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const oldImagePath = path.join(__dirname, product.image);
        if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath); // Delete old image file
        }

        res.sendStatus(200); // Successfully deleted old image
    } catch (error) {
        res.status(500).json({ message: 'Error deleting image', error });
    }
});

// Update a product's image
app.put('/products/:id/image', upload.single('image'), async (req, res) => {
    try {
        const productId = req.params.id;
        const image = req.file ? req.file.path : '';

        // Find the product and update its image
        const product = await ProductModel.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // If there's an old image, delete it
        const oldImagePath = path.join(__dirname, product.image);
        if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath); // Delete old image file
        }

        // Update the product's image path
        product.image = image;
        await product.save();

        res.json(product); // Return the updated product
    } catch (error) {
        res.status(500).json({ message: 'Error updating image', error });
    }
});


// Add a new category
app.post('/categories', (req, res) => {
    const { name } = req.body;

    CategoryModel.create({ name })
        .then(newCategory => res.json(newCategory))
        .catch(err => res.status(500).json({ message: 'Server error', error: err }));
});

// Get all categories
app.get('/categories', (req, res) => {
    CategoryModel.find()
        .then(categories => res.json(categories))
        .catch(err => res.status(500).json({ message: 'Server error', error: err }));
});


// Delete a category by ID
app.delete('/categories/:id', (req, res) => {
    const { id } = req.params;

    CategoryModel.findByIdAndDelete(id)
        .then(deletedCategory => {
            if (!deletedCategory) {
                return res.status(404).json({ message: 'Category not found' });
            }
            res.json({ message: 'Category deleted successfully' });
        })
        .catch(err => res.status(500).json({ message: 'Server error', error: err }));
});


//.//................................................................................


//to add new user Registration endpoint
app.post('/register', async (req, res) => {
    const { username, phonenumber, address, email, password, role = 'user' } = req.body;

    try {
        // Check if the email or phone number already exists
        const existingUser = await UserModel.findOne({ $or: [{ email }, { phonenumber }] });

        if (existingUser) {
            return res.status(400).json({ message: 'Email or Phone Number already exists' });
        }

        // Generate activation token
        const activationToken = crypto.randomBytes(20).toString('hex');
        const activationTokenExpiry = Date.now() + 3600000; // 1 hour expiry

        // Create a new user but not activated yet
        const newUser = await UserModel.create({
            username,
            phonenumber,
            address,
            email,
            password,
            role,
            activationToken,
            activationTokenExpiry,
            isActive: false // Initially set to false
        });

        // Send activation email
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const activationURL = `${process.env.FRONTEND_URL}/activate/${activationToken}`;
        const mailOptions = {
            to: email,
            from: process.env.EMAIL_USER,
            subject: 'Account Activation',
            html: `Please activate your account by clicking the following link: <a href="${activationURL}">Activate Account</a>`
        };

        await transporter.sendMail(mailOptions);

        res.json({ message: 'Registration successful! Please check your email to activate your account.' });
    } catch (err) {
        console.error('Error during registration:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

//to login users
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await UserModel.findOne({ username });

        if (user) {
            // Check if the user is active
            if (!user.isActive) {
                return res.json({ status: 'Error', message: 'Account is not active' });
            }

            // Compare passwords (plain text comparison)
            if (user.password === password) {
                res.json({ status: 'Success', userId: user._id, role: user.role });
            } else {
                res.json({ status: 'Error', message: 'Incorrect Username or Password' });
            }
        } else {
            res.json({ status: 'Error', message: 'Invalid Username or Password' });
        }
    } catch (err) {
        res.json({ status: 'Error', message: 'Server error' });
    }
});



// Endpoint to get all non-admin but users only
app.get('/users/non-admins', (req, res) => {
    UserModel.find({ role: { $ne: 'admin' } })
      .then(users => res.json(users))
      .catch(err => res.status(500).json({ message: 'Server error', error: err }));
});

// Endpoint to get all admins only
app.get('/admins', (req, res) => {
    UserModel.find({ role: 'admin' })
      .then(admins => res.json(admins))
      .catch(err => res.status(500).json({ message: 'Server error', error: err }));
});

// Update a user's role (admin or user)
app.put('/users/:id/role', (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    UserModel.findByIdAndUpdate(id, { role }, { new: true })
        .then(updatedUser => res.json(updatedUser))
        .catch(err => res.status(500).json({ message: 'Server error', error: err }));
});

// Delete a user by ID
app.delete('/users/:id', (req, res) => {
    const { id } = req.params;

    UserModel.findByIdAndDelete(id)
        .then(deletedUser => {
            if (!deletedUser) {
                return res.status(404).json({ message: 'User not found' });
            }
            res.json({ message: 'User deleted successfully' });
        })
        .catch(err => res.status(500).json({ message: 'Server error', error: err }));
});

// Endpoint to request password reset
app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const user = await UserModel.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Generate a reset token
        const resetToken = crypto.randomBytes(20).toString('hex');
        user.resetToken = resetToken;
        user.resetTokenExpiry = Date.now() + 3600000; // Token expires in 1 hour
        await user.save();

        // Send reset token via email
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            host: process.env.EMAIL_SERVICE_PROVIDER,
            port: 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS 
            }
        });

        const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
        const mailOptions = {
            to: email,
            from: process.env.EMAIL_USER,
            subject: 'Password Reset Request',
            html: `You requested a password reset. Click the following link to reset your password: <a href="${resetURL}">Reset Link</a>`
        };

        await transporter.sendMail(mailOptions);
        res.json({ message: 'Reset link sent to your email' });

    } catch (error) {
        console.error('Error sending reset email:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Endpoint to reset password
app.post('/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    const { newPassword } = req.body;

    // Validate request
    if (!newPassword) {
        return res.status(400).json({ message: 'New password is required' });
    }

    try {
        const user = await UserModel.findOne({
            resetToken: token,
            resetTokenExpiry: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired token' });
        }

        // Check if new password is different from current password
        if (user.password === newPassword) {
            return res.status(400).json({ message: 'New password should be different than old password' });
        }

        user.password = newPassword;
        user.resetToken = undefined;
        user.resetTokenExpiry = undefined;
        await user.save();

        res.json({ message: 'Password updated successfully. You can now login.' });
    } catch (error) {
        console.error('Error updating password:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


// Activation endpoint
app.get('/activate/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const user = await UserModel.findOne({
            activationToken: token,
            activationTokenExpiry: { $gt: Date.now() }
        });
        console.log("User found:", user);

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired activation token' });
        }

        user.isActive = true; 
        user.activationToken = undefined;
        user.activationTokenExpiry = undefined;
        await user.save();
        res.json({ message: 'Account activated successfully. You can now login.' });


    } catch (err) {
        console.error('Error during activation:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

//////.......................//....................................

// Get user profile by ID for dashboard and checkout details
app.get('/users/:id/profile', async (req, res) => {
    const { id } = req.params;

    try {
        const user = await UserModel.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});



///////////////////////////////////////////////////////////////////

//new order added
app.post('/orders', async (req, res) => {
    const { orderId, userId, username, phoneNumber, email, address, products, price, paymentMethod } = req.body;
    console.log('Order Data Received:', { orderId, userId, username, phoneNumber, email, address, products, price, paymentMethod }); // Log the data

    // Validate paymentMethod
    const validPaymentMethods = ["esewa", "khalti", "Cash in hand"];
    if (paymentMethod && !validPaymentMethods.includes(paymentMethod)) {
        return res.status(400).json({ message: 'Invalid payment method' });
    }


    try {
        const newOrder = new Order({
            orderId,
            userId,
            username,
            phoneNumber, // Add phone number
            email,       // Add email
            address,     // Add address
            products,
            price,
            paymentMethod: paymentMethod || "Cash in hand",
            status: "pending",
            purchaseDate: new Date(),
            deliveryStatus: "in progress",
        });

        await newOrder.save();
        res.status(201).json({ message: 'Order placed successfully', order: newOrder });
    } catch (err) {
        console.error('Error creating order:', err);
        res.status(500).json({ message: 'Failed to place order', error: err.message });
    }
});



// to cancel order...
app.delete('/orders/:orderId', async (req, res) => {
    const { orderId } = req.params;

    try {
        // Fetch the order details
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Restore stock for each product in the order
        await Promise.all(order.products.map(async (item) => {
            await ProductModel.findById(item.productId)
                .then(product => {
                    if (product) {
                        product.stock += item.quantity;
                        return product.save();
                    } else {
                        throw new Error('Product not found');
                    }
                })
                .catch(err => {
                    console.error(`Error updating stock for product ${item.productId}:`, err);
                    throw err;
                });
        }));

        // Delete the order
        await Order.deleteOne({ _id: orderId });

        res.status(200).json({ message: 'Order deleted and stock restored successfully' });
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ message: 'Failed to delete order and restore stock', error: error.message });
    }
});



//get all orders of particular users
app.get('/orders/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        // Fetch orders specific to the userId
        const orders = await Order.find({ userId });
        res.status(200).json(orders);
    } catch (err) {
        console.error('Error fetching orders:', err);
        res.status(500).json({ message: 'Failed to fetch orders', error: err.message });
    }
});

// Fetch all orders
app.get('/orders', async (req, res) => {
    try {
        const orders = await Order.find();
        res.status(200).json(orders);
    } catch (err) {
        console.error('Error fetching orders:', err);
        res.status(500).json({ message: 'Failed to fetch orders', error: err.message });
    }
});


// Update delivery status endpoint
app.put('/orders/:id', async (req, res) => {
    const { id } = req.params;
    const { status, deliveryStatus } = req.body;
  
    try {
      // Find the order by ID and update it
      const updatedOrder = await Order.findByIdAndUpdate(
        id,
        { status, deliveryStatus },
        { new: true } // Return the updated document
      );
  
      if (!updatedOrder) {
        return res.status(404).json({ message: 'Order not found' });
      }
  
      res.json(updatedOrder);
    } catch (error) {
      console.error('Error updating order:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  

  

//////////////////////////////////////////////////////////////////


app.post("/initialize-esewa", async (req, res) => {
    try {
      const { itemId, totalPrice } = req.body;
      // Validate item exists and the price matches
      const itemData = await Order.findOne({
        _id: itemId,
        price: Number(totalPrice),
      });
      console.log(itemData)
  
      if (!itemData) {
        return res.status(400).send({
          success: false,
          message: "Item not found or price mismatch.",
        });
      }

      // Initiate payment with eSewa
      const paymentInitiate = await getEsewaPaymentHash({
        amount: totalPrice,
        transaction_uuid: itemData._id,
      });
  
      // Respond with payment details
      res.json({
        success: true,
        payment: paymentInitiate,
        purchasedItemData: {
            _id: itemId,
            paymentMethod: "esewa",
            price: itemData.price,
            status: itemData.status, // Include the status here
            purchaseDate: itemData.purchaseDate // 
        },
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }    
  });

app.get("/complete-payment", async (req, res) => {
    const { data } = req.query;

    try {
        const paymentInfo = await verifyEsewaPayment(data);

        const purchasedItemData = await Order.findById(paymentInfo.response.transaction_uuid);

        if (!purchasedItemData) {
            return res.status(500).json({
                success: false,
                message: "Purchase not found",
            });
        }

        await Payment.create({
            pidx: paymentInfo.decodedData.transaction_code,
            transactionId: paymentInfo.decodedData.transaction_code,
            productId: paymentInfo.response.transaction_uuid,
            amount: purchasedItemData.price,
            dataFromVerificationReq: paymentInfo,
            apiQueryFromUser: req.query,
            paymentGateway: "esewa",
            status: "success",
        });

        await Order.findByIdAndUpdate(paymentInfo.response.transaction_uuid, {
            $set: { status: "completed" },
        });

        // Redirect to the thank-you page
        res.redirect(`${process.env.FRONTEND_URL}`);
    } catch (error) {
        console.error("Error completing eSewa payment:", error);
        res.status(500).json({
            success: false,
            message: "An error occurred during payment verification",
            error: error.message,
        });
    }
});
