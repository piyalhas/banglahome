const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
// Serve frontend static files from the project's public folder
app.use(express.static(path.join(__dirname, '..', 'public')));

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/banglahomes';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || 'sk_test_YOUR_STRIPE_SECRET_HERE';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).catch(err => {
  console.error('MongoDB connection error:', err.message);
  console.log('Will use fallback demo data');
});

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: String,
  role: { type: String, enum: ['tenant', 'owner'], default: 'tenant' },
  address: String,
  bio: String,
  createdAt: { type: Date, default: Date.now }
});

const PropertySchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  location: { type: String, required: true },
  city: { type: String, required: true },
  price: { type: Number, required: true },
  type: { type: String, required: true },
  bedrooms: Number,
  bathrooms: Number,
  size: Number,
  images: [String],
  featured: { type: Boolean, default: false },
  available: { type: Boolean, default: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

const MessageSchema = new mongoose.Schema({
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  read: { type: Boolean, default: false }
});

const User = mongoose.model('User', UserSchema);
const Property = mongoose.model('Property', PropertySchema);
const Message = mongoose.model('Message', MessageSchema);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// JWT_SECRET defined at top with environment variable

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = new User({
      name,
      email,
      password: hashedPassword,
      phone,
      role
    });
    await user.save();
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.get('/api/user/profile', auth, async (req, res) => {
  try {
    res.json(req.user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.put('/api/user/profile', auth, async (req, res) => {
  try {
    const { name, phone, address, bio } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, phone, address, bio },
      { new: true }
    ).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.get('/api/properties/featured', async (req, res) => {
  try {
    const properties = await Property.find({ featured: true, available: true })
      .populate('owner', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(6);
    res.json(properties);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.get('/api/properties', async (req, res) => {
  try {
    const { location, type, minPrice, maxPrice, bedrooms } = req.query;
    let filter = { available: true };
    if (location) filter.city = new RegExp(location, 'i');
    if (type) filter.type = type;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseInt(minPrice);
      if (maxPrice) filter.price.$lte = parseInt(maxPrice);
    }
    if (bedrooms) filter.bedrooms = { $gte: parseInt(bedrooms) };
    const properties = await Property.find(filter)
      .populate('owner', 'name email phone')
      .sort({ createdAt: -1 });
    
    // If no properties in DB, return demo fallback
    if (properties.length === 0) {
      const demoProperties = [
        {
          _id: '1',
          title: "লাক্সারি অ্যাপার্টমেন্ট, গুলশান",
          location: "রোড ১২৫, গুলশান",
          city: "ঢাকা",
          price: 45000,
          type: "apartment",
          bedrooms: 3,
          bathrooms: 2,
          size: 1500,
          images: ["/images/property1.jpg"],
          owner: { name: "আরিফ আহমেদ", email: "arif@demo.com", phone: "+8801712345678" },
          featured: true,
          available: true
        },
        {
          _id: '2',
          title: "মডার্ন ফ্ল্যাট, বনানী",
          location: "রোড ১১, বনানী",
          city: "ঢাকা",
          price: 35000,
          type: "apartment",
          bedrooms: 2,
          bathrooms: 2,
          size: 1200,
          images: ["/images/property2.png"],
          owner: { name: "সুমাইয়া খান", email: "sumaiya@demo.com", phone: "+8801812345678" },
          featured: true,
          available: true
        },
        {
          _id: '3',
          title: "বাংলো, উত্তরা",
          location: "সেক্টর ৭, উত্তরা",
          city: "ঢাকা",
          price: 60000,
          type: "house",
          bedrooms: 4,
          bathrooms: 3,
          size: 2000,
          images: ["/images/property3.png"],
          owner: { name: "রফিকুল ইসলাম", email: "rafiq@demo.com", phone: "+8801912345678" },
          featured: true,
          available: true
        },
        {
          _id: '4',
          title: "ডুপ্লেক্স, মিরপুর",
          location: "সেক্টর ১০, মিরপুর",
          city: "ঢাকা",
          price: 40000,
          type: "duplex",
          bedrooms: 3,
          bathrooms: 2,
          size: 1800,
          images: ["/images/property4.png"],
          owner: { name: "মো: হাসান", email: "hasan@demo.com", phone: "+8801719888777" },
          featured: true,
          available: true
        }
      ];
      return res.json(demoProperties);
    }
    
    res.json(properties);
  } catch (error) {
    console.error('/api/properties error:', error);
    // Return demo data on any error
    const demoProperties = [
      {
        _id: '1',
        title: "লাক্সারি অ্যাপার্টমেন্ট, গুলশান",
        location: "রোড ১২৫, গুলশান",
        city: "ঢাকা",
        price: 45000,
        type: "apartment",
        bedrooms: 3,
        bathrooms: 2,
        size: 1500,
        images: ["/images/property1.jpg"],
        owner: { name: "আরিফ আহমেদ", email: "arif@demo.com", phone: "+8801712345678" },
        featured: true,
        available: true
      },
      {
        _id: '2',
        title: "মডার্ন ফ্ল্যাট, বনানী",
        location: "রোড ১১, বনানী",
        city: "ঢাকা",
        price: 35000,
        type: "apartment",
        bedrooms: 2,
        bathrooms: 2,
        size: 1200,
        images: ["/images/property2.png"],
        owner: { name: "সুমাইয়া খান", email: "sumaiya@demo.com", phone: "+8801812345678" },
        featured: true,
        available: true
      },
      {
        _id: '3',
        title: "বাংলো, উত্তরা",
        location: "সেক্টর ৭, উত্তরা",
        city: "ঢাকা",
        price: 60000,
        type: "house",
        bedrooms: 4,
        bathrooms: 3,
        size: 2000,
        images: ["/images/property3.png"],
        owner: { name: "রফিকুল ইসলাম", email: "rafiq@demo.com", phone: "+8801912345678" },
        featured: true,
        available: true
      },
      {
        _id: '4',
        title: "ডুপ্লেক্স, মিরপুর",
        location: "সেক্টর ১০, মিরপুর",
        city: "ঢাকা",
        price: 40000,
        type: "duplex",
        bedrooms: 3,
        bathrooms: 2,
        size: 1800,
        images: ["/images/property4.png"],
        owner: { name: "মো: হাসান", email: "hasan@demo.com", phone: "+8801719888777" },
        featured: true,
        available: true
      }
    ];
    res.json(demoProperties);
  }
});

app.get('/api/properties/:id', async (req, res) => {
  try {
    const property = await Property.findById(req.params.id)
      .populate('owner', 'name email phone');
    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }
    res.json(property);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/properties', auth, upload.array('images', 10), async (req, res) => {
  try {
    const {
      title,
      description,
      location,
      city,
      price,
      type,
      bedrooms,
      bathrooms,
      size,
      featured
    } = req.body;
    const images = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];
    const property = new Property({
      title,
      description,
      location,
      city,
      price: parseInt(price),
      type,
      bedrooms: parseInt(bedrooms) || 0,
      bathrooms: parseInt(bathrooms) || 0,
      size: parseInt(size) || 0,
      images,
      featured: featured === 'true',
      owner: req.user._id
    });
    await property.save();
    await property.populate('owner', 'name email phone');
    res.status(201).json(property);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.get('/api/user/properties', auth, async (req, res) => {
  try {
    const properties = await Property.find({ owner: req.user._id })
      .populate('owner', 'name email phone')
      .sort({ createdAt: -1 });
    res.json(properties);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.put('/api/properties/:id', auth, upload.array('images', 10), async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }
    if (property.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const updates = { ...req.body };
    if (req.files && req.files.length > 0) {
      updates.images = req.files.map(file => `/uploads/${file.filename}`);
    }
    const updatedProperty = await Property.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    ).populate('owner', 'name email phone');
    res.json(updatedProperty);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.delete('/api/properties/:id', auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }
    if (property.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    await Property.findByIdAndDelete(req.params.id);
    res.json({ message: 'Property deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    console.log('Contact form submission:', { name, email, phone, subject, message });
    res.json({ message: 'Message sent successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  socket.on('user_connected', (userId) => {
    connectedUsers.set(userId, socket.id);
    console.log(`User ${userId} connected with socket ${socket.id}`);
  });
  socket.on('send_message', async (data) => {
    try {
      const { propertyId, senderId, receiverId, message } = data;
      const newMessage = new Message({
        property: propertyId,
        sender: senderId,
        receiver: receiverId,
        message
      });
      await newMessage.save();
      await newMessage.populate('sender', 'name');
      await newMessage.populate('receiver', 'name');
      const receiverSocketId = connectedUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('new_message', newMessage);
      }
      socket.emit('message_sent', newMessage);
    } catch (error) {
      socket.emit('message_error', { error: 'Failed to send message' });
    }
  });
  socket.on('get_messages', async (data) => {
    try {
      const { propertyId, userId1, userId2 } = data;
      const messages = await Message.find({
        property: propertyId,
        $or: [
          { sender: userId1, receiver: userId2 },
          { sender: userId2, receiver: userId1 }
        ]
      })
      .populate('sender', 'name')
      .populate('receiver', 'name')
      .sort({ timestamp: 1 });
      socket.emit('messages_history', messages);
    } catch (error) {
      socket.emit('messages_error', { error: 'Failed to load messages' });
    }
  });
  socket.on('disconnect', () => {
    for (let [userId, socketId] of connectedUsers.entries()) {
      if (socketId === socket.id) {
        connectedUsers.delete(userId);
        break;
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

const stripe = require('stripe')(STRIPE_SECRET);

app.post('/api/create-payment-intent', auth, async (req, res) => {
  try {
    const { amount, propertyId } = req.body;
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100,
      currency: 'bdt',
      metadata: {
        propertyId: propertyId,
        userId: req.user._id.toString()
      }
    });
    res.json({
      clientSecret: paymentIntent.client_secret
    });
  } catch (error) {
    res.status(500).json({ message: 'Payment error', error: error.message });
  }
});

app.post('/api/confirm-payment', auth, async (req, res) => {
  try {
    const { paymentIntentId, propertyId } = req.body;
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status === 'succeeded') {
      await Property.findByIdAndUpdate(propertyId, { available: false });
      res.json({ 
        success: true, 
        message: 'Payment successful and property booked!' 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: 'Payment not completed' 
      });
    }
  } catch (error) {
    res.status(500).json({ message: 'Payment confirmation error', error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// For any other route, serve the frontend index (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});
