require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const UserModel = require("./models/Users");
const OrdersModel = require("./models/Orders");
const app = express();
app.use(cors());
app.use(express.json());

// Serve static files for images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Configure Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads'); // Save images to the "uploads" folder
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName); // Use a unique filename
    }
});

const upload = multer({ storage });

mongoose.connect("mongodb://127.0.0.1:27017/goldhallmark")
app.get("/", (req, res) => {
    res.json("Welcome to Gold Hallmark API");
})

app.get("/users", (req, res) => {
    UserModel.find({})
        .then(users => res.json(users))
        .catch(err => res.json(err))
})
// app.get("/userWithID", (req, res) => {
//     CustomerModel.find({})
//         .then(users => res.json(users))
//         .catch(err => res.json(err))
// })


// POST route to create a new customer with customerID, name, and company
// app.post("/createCustomer", (req, res) => {
//     console.log("Received customer data:", req.body); // Log the incoming data

//     const { customerID, name, company } = req.body;

//     // Validate required fields
//     if (!customerID || !name || !company) {
//         return res.status(400).json({ error: "Missing required fields" });
//     }

//     const newCustomer = new CustomerModel({
//         customerID,
//         name,
//         company,
//     });

//     newCustomer.save()
//         .then(customer => res.json(customer))
//         .catch(err => res.status(500).json({ error: "Error creating customer", details: err }));
// });


// Create user with image upload
app.post("/createUser", upload.single('image'), (req, res) => {
    const { customerID, name, contact, company, address } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    const newUser = new UserModel({
        customerID,
        name,
        contact,
        company,
        address,
        image: imagePath
    });

    newUser.save()
        .then(user => res.json(user))
        .catch(err => res.status(500).json({ error: "Error creating user", details: err }));
});

// Endpoint to get the last customerID
app.get("/getLastCustomerID", async (req, res) => {
    try {
        const lastCustomer = await UserModel.findOne().sort({ customerID: -1 }).limit(1);
        const lastCustomerID = lastCustomer ? lastCustomer.customerID : 0;
        res.json({ lastCustomerID });
    } catch (error) {
        console.error("Error fetching last customer ID:", error);
        res.status(500).json({ error: "Error fetching last customer ID" });
    }
});



// Endpoint to update user details
app.put("/updateUser/:id", async (req, res) => {
    const { id } = req.params;
    const updatedData = req.body;

    try {
        const updatedUser = await UserModel.findByIdAndUpdate(id, updatedData, { new: true });
        if (!updatedUser) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json(updatedUser);
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
app.delete("/deleteUser/:id", async (req, res) => {
    const { id } = req.params;
    console.log("Deleting user with ID:", id); // Debugging log

    try {
        // Delete the user from the 'users' collection
        const deletedUser = await UserModel.findByIdAndDelete(id);
        if (!deletedUser) {
            console.error("User not found with ID:", id); // Debugging log
            return res.status(404).json({ message: "User not found" });
        }

        console.log("User deleted successfully"); // Debugging log
        res.status(200).json({ message: "User deleted successfully" });
    } catch (err) {
        console.error("Error deleting user:", err); // Debugging log
        res.status(500).json({ message: "Server error", error: err });
    }
});

// Route to create a new orders record
app.post("/orders", upload.single("image"), async (req, res) => {
    try {
        const { name, customerID, company, item, type, quantity, weight, weightUnite, rate, amount, xray, customerFrom, contact,
            address } = req.body;

        // Extract the image path
        const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
        // Create a new record
        const newXray = new OrdersModel({
            name,
            customerID,
            company,
            contact,
            address,
            item,
            type,
            quantity: parseFloat(quantity),
            weight: parseFloat(weight),
            weightUnite,
            rate: parseFloat(rate),
            amount: parseFloat(amount),
            xray,
            customerFrom: new Date(customerFrom),
            image: imagePath,

        });

        const savedXray = await newXray.save();
        res.status(201).json(savedXray);
    } catch (error) {
        console.error("Error saving X-ray record:", error);
        res.status(500).json({ error: "Failed to save X-ray record" });
    }
});


app.get("/orders", (req, res) => {
    OrdersModel.find({})
        .then(users => res.json(users))
        .catch(err => res.json(err))
})
// Assuming you're using Express.js in the backend
app.get("/orders/:id", (req, res) => {
    const { id } = req.params;
    OrdersModel.findById(id)
        .then(order => {
            if (order) {
                res.json(order);
            } else {
                res.status(404).json({ message: "Order not found" });
            }
        })
        .catch(err => res.status(500).json({ message: "Error fetching order", error: err }));
});
const port = 8003;
app.listen(port, () => {
    console.log(`server running on port ${port}`)
})