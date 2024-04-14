const port=4000;
const express=require("express");
const app=express();
const mongoose=require("mongoose");
const jwt=require("jsonwebtoken");
const multer=require( "multer" );
const path=require("path");
const cors=require("cors");
const bcrypt = require('bcrypt');

app.use(express.json());
app.use(cors());

//Database Connection With MongoDB

mongoose.connect("mongodb+srv://BritzMongo:rumbelstiltskin417*@cluster0.72usb72.mongodb.net/greenthumb")

//API Creation

app.get("/", (req, res) => {

res.send("Express App is Running")
})

//Image storage Engine
const storage=multer.diskStorage({
    destination:'./upload/images',
    filename:(req,file,cb)=>{
        return cb(null,`${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
    }
})
const upload=multer({storage:storage})
//Creating Upload Endpoint for Images
app.use('/images',express.static('upload/images'))
app.post("/upload",upload.single('product'),(req,res)=>{
res.json({
    success:1,
    image_url:`http://localhost:${port}/images/${req.file.filename}`

})
})
// Schema for Creating Products
const Product=mongoose.model("Product",{
    id:{
        type:Number,
        required:true,
    },
    name:{
        type:String,
        required:true,
    
    },
    image:{
        type:String,
        required:true,

    },
    category:{
        type:String,
        required:true,
    },
    new_price:{
        type:Number,
        required:true,
    },
    old_price:{
        type:Number,
        required:true,
    },
    date:{
        type:Date,
        default:Date.now,
    },
    avilable:{
        type:Boolean,
        default:true,
    },
})

app.post('/addproduct',async(req,res)=>{
    let products=await Product.find({});
    let id;
    if(products.length>0)
    {
        let last_product_array=products.slice(-1);
        let last_product=last_product_array[0];
        id=last_product.id+1;
    }
    else
    {
        id=1;
    
    }
const product=new Product({
    
    id:id,
    name:req.body.name,
    image:req.body.image,
    category:req.body.category,
    new_price:req.body.new_price,
    old_price:req.body.old_price,
});
console.log(product);
await product.save();
console.log("Saved");
res.json({
    success:true,
    name:req.body.name,
})
})

//Creating API for deleting product
app.post('/removeproduct',async(req,res)=>{
    await Product.findOneAndDelete({id:req.body.id});
    console.log("Removed")
    res.json({
        success: true,
        name:req.body.name,

    })

})
// Creating API for getting all products
app.get('/allproducts', async (req , res) =>{
    let products=await Product.find({});
    console.log("All Products Fetched");
    res.send(products);
    
})
//user model
const Users=mongoose.model('Users',{
    name:{
        type:String,
        unique:true,
    },
    email:{
        type:String,
        unique:true
    },
    password:{
        type:String,
    },
    cartData:{
        type:Object,
    },
    date:{
        type:Date,
        default:Date.now,
    }
})

 //Register new user
app.post('/signup', async (req, res) => {
    console.log("Sign Up");

    try {
        let success = false;

        // Check if a user with the same email already exists
        let check = await Users.findOne({ email: req.body.email });
        if (check) {
            return res.status(400).json({ success: success, errors: "Existing user found with this email" });
        }

        // Hash the password before saving it to the database
        const hashedPassword = await bcrypt.hash(req.body.password, 10);

        // Initialize cart data
        let cart = {};
        for (let i = 0; i < 300; i++) {
            cart[i] = 0;
        }

        // Create a new user object
        const user = new Users({
            name: req.body.username,
            email: req.body.email,
            password: hashedPassword,
            cartData: cart,
        });

        // Save the user to the database
        await user.save();

        // Create a data object containing the user's ID
        const data = {
            user: {
                id: user.id
            }
        };

        // Generate a JWT token with the user data and sign it with a secret key
        const token = jwt.sign(data, 'secret_greenthumb');

        // Set success flag to true
        success = true;

        // Send back a JSON response with success flag and token
        res.json({ success, token });
    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).json({ success: false, errors: "An error occurred while processing your request" });
    }
});

//creating endpoint for the user login
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        // Find user by email
        const user = await Users.findOne({ email });
        
        if (!user) {
            // User not found
            return res.status(404).json({ success: false, errors: "User not found" });
        }

        // Compare passwords
        const passwordMatch = await bcrypt.compare(password, user.password);
        
        if (passwordMatch) {
            // Passwords match, generate token
            const token = jwt.sign({ user: { id: user.id } }, 'secret_greenthumb');
            return res.json({ success: true, token });
        } else {
            // Passwords don't match
            return res.status(401).json({ success: false, errors: "Incorrect password" });
        }
    } catch (error) {
        console.error("Error:", error.message);
        return res.status(500).json({ success: false, errors: "An error occurred while processing your request" });
    }
});

//Creating Middleware to fetch user
const fetchUser= async(req,res,next)=>{
    const token=req.header('auth-token');
    console.log(token);
    if( !token ) {
     res.status(401).send({errors:"Please authenticate using valid token"})
    }
    else{
        try{
            const data=jwt.verify(token,'secret_greenthumb');
        req.user=data.user;
        next();
        }catch(error){
            res.status(401).send({errors:"Please aunthenticate using a valid token"})

        }
    }
}
//creating endpoint for adding products in cartdata
// Endpoint for adding products to cart data
app.post('/addtocart', fetchUser, async (req, res) => {
    console.log("Added", req.body.itemid);
    let userData = await Users.findOne({ _id: req.user.id });
    console.log(userData);
    userData.cartData[req.body.itemid] += 1;
    await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });
    res.json({ success: true, message: "Item added to cart" }); // Send JSON response
});

// Endpoint for removing products from cart data
app.post('/removefromcart', fetchUser, async (req, res) => {
    console.log("Removed", req.body.itemid);
    let userData = await Users.findOne({ _id: req.user.id }); 
    if (userData.cartData[req.body.itemid] > 0)
        userData.cartData[req.body.itemid] -= 1;
    await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData }); 
    res.json({ success: true, message: "Item removed from cart" }); // Send JSON response
});
//creating endpoint to get cartdata
app.post('/getcart', fetchUser, async (req, res) => {
   
    try {
        // Fetch the user's cart data from the database
        const userData = await Users.findOne({ _id: req.user.id });
        res.json(userData.cartData);
    } catch (error) {
        console.error("Error fetching cart items:", error);
        res.status(500).json({ success: false, errors: "An error occurred while fetching cart items" });
    }
});

app.listen (port,(error)=>{
    if(!error){
    console.log(`Server is running on Port `+port)
}
else
{
console.log("Error:"+error)
}
})


