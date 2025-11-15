const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/banglahomes';
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).catch(err => {
    console.warn('MongoDB connection warning:', err.message);
});

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: String,
    role: { type: String, enum: ['tenant', 'owner'], default: 'tenant' },
    createdAt: { type: Date, default: Date.now }
});

const propertySchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    location: { type: String, required: true },
    city: { type: String, required: true },
    price: { type: Number, required: true },
    type: { type: String, enum: ['apartment', 'house', 'duplex', 'villa', 'commercial'] },
    bedrooms: Number,
    bathrooms: Number,
    size: Number,
    images: [String],
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    featured: { type: Boolean, default: false },
    available: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

const contactSchema = new mongoose.Schema({
    name: String,
    email: String,
    phone: String,
    subject: String,
    message: String,
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Property = mongoose.model('Property', propertySchema);
const Contact = mongoose.model('Contact', contactSchema);

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Demo data for fallback
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

// ============ API ROUTES (MUST COME BEFORE SPA FALLBACK) ============

app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, phone, role } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            name,
            email,
            password: hashedPassword,
            phone,
            role
        });

        await user.save();

        const token = jwt.sign(
            { userId: user._id, email: user.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'User created successfully',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
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

        const token = jwt.sign(
            { userId: user._id, email: user.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
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
        if (bedrooms) filter.bedrooms = { $gte: parseInt(bedrooms) };
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price.$gte = parseInt(minPrice);
            if (maxPrice) filter.price.$lte = parseInt(maxPrice);
        }

        const properties = await Property.find(filter)
            .populate('owner', 'name email phone')
            .sort({ createdAt: -1 });

        if (!properties || properties.length === 0) {
            return res.json(demoProperties);
        }

        res.json(properties);
    } catch (error) {
        console.error('/api/properties error:', error.message);
        res.json(demoProperties);
    }
});

app.get('/api/properties/featured', async (req, res) => {
    try {
        const properties = await Property.find({ featured: true, available: true })
            .populate('owner', 'name email phone')
            .limit(6)
            .sort({ createdAt: -1 });

        if (!properties || properties.length === 0) {
            return res.json(demoProperties);
        }

        res.json(properties);
    } catch (error) {
        console.error('/api/properties/featured error:', error.message);
        res.json(demoProperties);
    }
});

app.get('/api/properties/:id', async (req, res) => {
    try {
        const property = await Property.findById(req.params.id)
            .populate('owner', 'name email phone');

        if (!property) {
            // Try demo data
            const demoProp = demoProperties.find(p => p._id === req.params.id);
            if (demoProp) return res.json(demoProp);
            return res.status(404).json({ message: 'Property not found' });
        }

        res.json(property);
    } catch (error) {
        console.error('/api/properties/:id error:', error.message);
        // Return demo if possible
        const demoProp = demoProperties.find(p => p._id === req.params.id);
        if (demoProp) return res.json(demoProp);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.post('/api/properties', authenticateToken, async (req, res) => {
    try {
        const property = new Property({
            ...req.body,
            owner: req.user.userId
        });

        await property.save();
        await property.populate('owner', 'name email phone');

        res.status(201).json({
            message: 'Property added successfully',
            property
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.post('/api/contact', async (req, res) => {
    try {
        const contact = new Contact(req.body);
        await contact.save();

        console.log('Contact form submission:', req.body);

        res.json({ message: 'Message sent successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.get('/api/user/properties', authenticateToken, async (req, res) => {
    try {
        const properties = await Property.find({ owner: req.user.userId })
            .sort({ createdAt: -1 });

        res.json(properties);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.put('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.user.userId,
            { $set: req.body },
            { new: true }
        ).select('-password');

        res.json({
            message: 'Profile updated successfully',
            user
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// ============ SPA FALLBACK ROUTE (MUST COME AFTER ALL API ROUTES) ============

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Visit: http://localhost:${PORT}`);
});
