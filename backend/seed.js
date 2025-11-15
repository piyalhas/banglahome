require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/banglahomes';

(async () => {
  try {
    await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB for seeding');

    const userSchema = new mongoose.Schema({ name:String, email:String, password:String, phone:String, role:String });
    const propertySchema = new mongoose.Schema({ title:String, description:String, location:String, city:String, price:Number, type:String, bedrooms:Number, bathrooms:Number, size:Number, images:[String], owner: mongoose.Schema.Types.ObjectId, featured:Boolean, available:Boolean });

    const User = mongoose.model('SeedUser', userSchema);
    const Property = mongoose.model('SeedProperty', propertySchema);

    const existing = await Property.countDocuments();
    if (existing > 0) {
      console.log('Properties already exist in DB, skipping seeding. Count =', existing);
      process.exit(0);
    }

    // create owner user
    const ownerPassword = await bcrypt.hash('demo123', 10);
    const owner = new User({ name: 'প্রপার্টি মালিক', email: 'owner@demo.com', password: ownerPassword, phone: '+8801712345678', role: 'owner' });
    await owner.save();

    // create tenant user
    const tenantPassword = await bcrypt.hash('demo123', 10);
    const tenant = new User({ name: 'ভাড়াটে', email: 'tenant@demo.com', password: tenantPassword, phone: '+8801711112222', role: 'tenant' });
    await tenant.save();

    const properties = [
      {
        title: 'লাক্সারি অ্যাপার্টমেন্ট, গুলশান',
        description: 'এটি একটি আধুনিক এবং লাক্সারি অ্যাপার্টমেন্ট গুলশানের প্রাইম লোকেশনে।',
        location: 'রোড ১২৫, গুলশান',
        city: 'ঢাকা',
        price: 45000,
        type: 'apartment',
        bedrooms: 3,
        bathrooms: 2,
        size: 1500,
        images: ['/images/property1.jpg'],
        owner: owner._id,
        featured: true,
        available: true
      },
      {
        title: 'মডার্ন ফ্ল্যাট, বনানী',
        description: 'বনানীর শান্ত পরিবেশে সুসজ্জিত ফ্ল্যাট।',
        location: 'রোড ১১, বনানী',
        city: 'ঢাকা',
        price: 35000,
        type: 'apartment',
        bedrooms: 2,
        bathrooms: 2,
        size: 1200,
        images: ['/images/property2.png'],
        owner: owner._id,
        featured: true,
        available: true
      },
      {
        title: 'বাংলো, উত্তরা',
        description: 'উত্তরার প্রাইম লোকেশনে সুন্দর বাংলো।',
        location: 'সেক্টর ৭, উত্তরা',
        city: 'ঢাকা',
        price: 60000,
        type: 'house',
        bedrooms: 4,
        bathrooms: 3,
        size: 2000,
        images: ['/images/property3.png'],
        owner: owner._id,
        featured: true,
        available: true
      },
      {
        title: 'ডুপ্লেক্স, মিরপুর',
        description: 'মিরপুরে সুন্দর ডুপ্লেক্স, ফ্যামিলি-ফ্রেন্ডলি লোকেশন।',
        location: 'সেক্টর ১০, মিরপুর',
        city: 'ঢাকা',
        price: 40000,
        type: 'duplex',
        bedrooms: 3,
        bathrooms: 2,
        size: 1800,
        images: ['/images/property4.png'],
        owner: owner._id,
        featured: true,
        available: true
      }
    ];

    await Property.insertMany(properties);
    console.log('Seeded demo users and properties');
    process.exit(0);
  } catch (err) {
    console.error('Seeding error', err);
    process.exit(1);
  }
})();
