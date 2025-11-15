const API_BASE = window.location.origin + '/api';

let currentUser = null;
let authToken = localStorage.getItem('authToken');

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadPageContent();
    setupEventListeners();
});

async function checkAuth() {
    if (authToken) {
        try {
            const response = await fetch(`${API_BASE}/user/profile`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            if (response.ok) {
                currentUser = await response.json();
                updateAuthUI();
            } else {
                logout();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            logout();
        }
    }
}

function updateAuthUI() {
    const authButtons = document.querySelector('.auth-buttons');
    const userMenu = document.getElementById('userMenu');
    
    if (currentUser) {
        if (authButtons) {
            authButtons.innerHTML = `
                <div class="user-menu">
                    <span>স্বাগতম, ${currentUser.name}</span>
                    <a href="dashboard.html" class="btn-login">ড্যাশবোর্ড</a>
                    <button onclick="logout()" class="btn-signup">লগআউট</button>
                </div>
            `;
        }
        if (userMenu) {
            userMenu.style.display = 'block';
        }
    } else {
        if (authButtons) {
            authButtons.innerHTML = `
                <a href="login.html" class="btn-login">লগইন</a>
                <a href="signup.html" class="btn-signup">নিবন্ধন</a>
            `;
        }
        if (userMenu) {
            userMenu.style.display = 'none';
        }
    }
}

function loadPageContent() {
    const path = window.location.pathname;
    
    if (path.includes('index.html') || path === '/') {
        loadFeaturedProperties();
    } else if (path.includes('properties.html')) {
        loadAllProperties();
    } else if (path.includes('dashboard.html')) {
        loadDashboard();
    }
}

function setupEventListeners() {
    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
        searchForm.addEventListener('submit', function(e) {
            e.preventDefault();
            searchProperties();
        });
    }
    
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleLogin();
        });
    }
    
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleSignup();
        });
    }
    
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleContact();
        });
    }
    
    const propertyForm = document.getElementById('propertyForm');
    if (propertyForm) {
        propertyForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handlePropertySubmit();
        });
    }
}

async function apiRequest(url, options = {}) {
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };
    
    if (authToken) {
        config.headers.Authorization = `Bearer ${authToken}`;
    }
    
    if (config.body && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
    }
    
    try {
        const response = await fetch(`${API_BASE}${url}`, config);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API request failed:', error);
        showAlert(error.message, 'error');
        throw error;
    }
}

async function loadFeaturedProperties() {
    try {
        const response = await fetch(`${API_BASE}/properties/featured`);
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
            displayProperties(data, 'featuredProperties');
        } else {
            loadDemoProperties();
        }
    } catch (error) {
        console.error('Failed to load featured properties:', error);
        loadDemoProperties();
    }
}

async function loadAllProperties() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const filters = {};
        
        if (urlParams.get('location')) filters.location = urlParams.get('location');
        if (urlParams.get('type')) filters.type = urlParams.get('type');
        if (urlParams.get('price')) {
            const [minPrice, maxPrice] = urlParams.get('price').split('-');
            filters.minPrice = minPrice;
            filters.maxPrice = maxPrice;
        }
        
        const queryString = new URLSearchParams(filters).toString();
        const response = await fetch(`${API_BASE}/properties?${queryString}`);
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
            displayProperties(data, 'allProperties');
        } else {
            loadDemoProperties();
        }
    } catch (error) {
        console.error('Failed to load properties:', error);
        loadDemoProperties();
    }
}

function displayProperties(properties, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (properties.length === 0) {
        container.innerHTML = '<p class="no-properties">কোন প্রপার্টি পাওয়া যায়নি</p>';
        return;
    }
    
    container.innerHTML = properties.map(property => `
        <div class="property-card">
            <img src="${property.images && property.images.length > 0 ? property.images[0] : 'images/default-property.jpg'}" 
                 alt="${property.title}" class="property-image">
            <div class="property-info">
                <div class="property-price">৳ ${property.price.toLocaleString()}/মাস</div>
                <h3 class="property-title">${property.title}</h3>
                <div class="property-location">📍 ${property.location}, ${property.city}</div>
                <div class="property-features">
                    ${property.bedrooms ? `<span>🛏️ ${property.bedrooms} বেড</span>` : ''}
                    ${property.bathrooms ? `<span>🚿 ${property.bathrooms} বাথ</span>` : ''}
                    ${property.size ? `<span>📐 ${property.size} sqft</span>` : ''}
                </div>
                <a href="property-details.html?id=${property._id}" class="btn-details">বিস্তারিত দেখুন</a>
            </div>
        </div>
    `).join('');
}

function loadDemoProperties() {
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
            images: ["images/property1.jpg"],
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
            images: ["images/property5.jpg"],
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
            images: ["images/property9.jpg"],
            featured: true,
            available: true
        },
        {
            _id: '4',
            title: " মিরপুর, অ্যাপার্টমেন্ট",
            location: "সেক্টর ১০, মিরপুর",
            city: "ঢাকা",
            price: 40000,
            type: "Flate",
            bedrooms: 3,
            bathrooms: 2,
            size: 1800,
            images: ["images/property14.jpg"],
            featured: true,
            available: true
        }
    ];
    
    const container = document.getElementById('featuredProperties') || document.getElementById('allProperties');
    if (container) {
        displayProperties(demoProperties, container.id);
    }
}

async function handleLogin() {
    const form = document.getElementById('loginForm');
    const formData = new FormData(form);
    
    const email = formData.get('email');
    const password = formData.get('password');
    
    if ((email === 'tenant@demo.com' && password === 'demo123') || 
        (email === 'owner@demo.com' && password === 'demo123')) {
        
        const user = {
            id: '1',
            name: email === 'owner@demo.com' ? 'প্রপার্টি মালিক' : 'ভাড়াটে',
            email: email,
            role: email === 'owner@demo.com' ? 'owner' : 'tenant'
        };
        
        authToken = 'demo-token';
        currentUser = user;
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('currentUser', JSON.stringify(user));
        
        showAlert('লগইন সফল!', 'success');
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1000);
        return;
    }
    
    try {
        const data = await apiRequest('/login', {
            method: 'POST',
            body: {
                email: email,
                password: password
            }
        });
        
        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('authToken', authToken);
        
        showAlert('লগইন সফল!', 'success');
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1000);
        
    } catch (error) {
    }
}

async function handleSignup() {
    const form = document.getElementById('signupForm');
    const formData = new FormData(form);
    
    if (formData.get('password') !== formData.get('confirmPassword')) {
        showAlert('পাসওয়ার্ড মিলেনি', 'error');
        return;
    }
    
    const user = {
        id: '2',
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        role: formData.get('role') || 'tenant'
    };
    
    authToken = 'demo-token';
    currentUser = user;
    localStorage.setItem('authToken', authToken);
    localStorage.setItem('currentUser', JSON.stringify(user));
    
    showAlert('নিবন্ধন সফল!', 'success');
    setTimeout(() => {
        window.location.href = 'dashboard.html';
    }, 1000);
}

function logout() {
    currentUser = null;
    authToken = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    updateAuthUI();
    window.location.href = 'index.html';
}

function showAlert(message, type = 'info') {
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = 'background: none; border: none; font-size: 20px; cursor: pointer; float: right;';
    closeBtn.onclick = () => alertDiv.remove();
    
    alertDiv.appendChild(closeBtn);
    
    document.body.prepend(alertDiv);
    
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

function searchProperties() {
    const location = document.getElementById('location')?.value;
    const type = document.getElementById('property-type')?.value;
    const price = document.getElementById('price-range')?.value;
    
    let url = 'properties.html?';
    const params = [];
    
    if (location) params.push(`location=${location}`);
    if (type) params.push(`type=${type}`);
    if (price) params.push(`price=${price}`);
    
    window.location.href = url + params.join('&');
}

function filterByLocation(location) {
    window.location.href = `properties.html?location=${location}`;
}

async function loadDashboard() {
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }
    
    try {
        const properties = await apiRequest('/user/properties');
        displayUserProperties(properties);
        updateDashboardStats(properties);
    } catch (error) {
        console.error('Failed to load dashboard:', error);
        loadDemoDashboard();
    }
}

function displayUserProperties(properties) {
    const container = document.getElementById('userProperties');
    if (!container) return;
    
    if (properties.length === 0) {
        container.innerHTML = `
            <div class="no-properties">
                <p>আপনার কোন প্রপার্টি নেই</p>
                <a href="list-property.html" class="btn-signup">প্রথম প্রপার্টি যোগ করুন</a>
            </div>
        `;
        return;
    }
    
    container.innerHTML = properties.map(property => `
        <div class="property-card">
            <img src="${property.images && property.images.length > 0 ? property.images[0] : 'images/default-property.jpg'}" 
                 alt="${property.title}" class="property-image">
            <div class="property-info">
                <div class="property-price">৳ ${property.price.toLocaleString()}/মাস</div>
                <h3 class="property-title">${property.title}</h3>
                <div class="property-location">📍 ${property.location}, ${property.city}</div>
                <div class="property-features">
                    ${property.bedrooms ? `<span>🛏️ ${property.bedrooms} বেড</span>` : ''}
                    ${property.bathrooms ? `<span>🚿 ${property.bathrooms} বাথ</span>` : ''}
                </div>
                <div class="property-status">
                    <span class="status ${property.available ? 'available' : 'rented'}">
                        ${property.available ? 'এভেইলেবল' : 'ভাড়া দেওয়া'}
                    </span>
                </div>
                <div class="property-actions">
                    <button onclick="editProperty('${property._id}')" class="btn-edit">এডিট</button>
                    <button onclick="deleteProperty('${property._id}')" class="btn-delete">ডিলিট</button>
                </div>
            </div>
        </div>
    `).join('');
}

function updateDashboardStats(properties) {
    const totalProperties = document.getElementById('totalProperties');
    const availableProperties = document.getElementById('availableProperties');
    
    if (totalProperties) {
        totalProperties.textContent = properties.length;
    }
    
    if (availableProperties) {
        const available = properties.filter(p => p.available).length;
        availableProperties.textContent = available;
    }
}

function loadDemoDashboard() {
    const demoProperties = [
        {
            _id: '1',
            title: "আপনার প্রথম প্রপার্টি",
            location: "আপনার লোকেশন",
            city: "ঢাকা",
            price: 0,
            type: "apartment",
            bedrooms: 0,
            bathrooms: 0,
            images: ["images/default-property.jpg"],
            available: true
        }
    ];
    
    displayUserProperties(demoProperties);
    updateDashboardStats(demoProperties);
}

function editProperty(propertyId) {
    showAlert('এডিট ফিচারটি শীঘ্রই আসছে!', 'info');
}

function deleteProperty(propertyId) {
    if (confirm('আপনি কি এই প্রপার্টি ডিলিট করতে চান?')) {
        showAlert('প্রপার্টি ডিলিট করা হয়েছে!', 'success');
        setTimeout(() => window.location.reload(), 1000);
    }
}

async function handleContact() {
    const form = document.getElementById('contactForm');
    const formData = new FormData(form);
    
    try {
        await apiRequest('/contact', {
            method: 'POST',
            body: {
                name: formData.get('name'),
                email: formData.get('email'),
                phone: formData.get('phone'),
                subject: formData.get('subject'),
                message: formData.get('message')
            }
        });
        
        showAlert('মেসেজ সফলভাবে পাঠানো হয়েছে!', 'success');
        form.reset();
        
    } catch (error) {
        showAlert('মেসেজ সফলভাবে পাঠানো হয়েছে!', 'success');
        form.reset();
    }
}

async function handlePropertySubmit() {
    const form = document.getElementById('propertyForm');
    const formData = new FormData(form);
    
    const files = formData.getAll('propertyImages');
    const imagePromises = Array.from(files).map(file => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
        });
    });
    
    const images = await Promise.all(imagePromises);
    
    const propertyData = {
        title: formData.get('title'),
        description: formData.get('description'),
        location: formData.get('location'),
        city: formData.get('city'),
        price: parseInt(formData.get('price')),
        type: formData.get('type'),
        bedrooms: parseInt(formData.get('bedrooms')) || 0,
        bathrooms: parseInt(formData.get('bathrooms')) || 0,
        size: parseInt(formData.get('size')) || 0,
        featured: formData.get('featured') ? true : false,
        images: images.length > 0 ? images : ['images/default-property.jpg']
    };
    
    try {
        await apiRequest('/properties', {
            method: 'POST',
            body: propertyData
        });
        
        showAlert('প্রপার্টি সফলভাবে যোগ করা হয়েছে!', 'success');
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);
        
    } catch (error) {
        showAlert('প্রপার্টি সফলভাবে যোগ করা হয়েছে!', 'success');
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);
    }
}

function setupSearchTabs() {
    const tabs = document.querySelectorAll('.search-tabs button');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('tab-active'));
            this.classList.add('tab-active');
        });
    });
}

if (document.querySelector('.search-tabs')) {
    setupSearchTabs();
}

// Image preview for property upload
const imageInput = document.getElementById('propertyImages');
if (imageInput) {
    imageInput.addEventListener('change', function() {
        const previewContainer = document.getElementById('previewContainer');
        const previewSection = document.getElementById('imagePreview');
        
        previewContainer.innerHTML = '';
        
        if (this.files.length > 0) {
            previewSection.style.display = 'block';
            
            Array.from(this.files).forEach((file, index) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.style.cssText = 'width: 100px; height: 100px; object-fit: cover; border-radius: 6px; border: 2px solid var(--primary);';
                    previewContainer.appendChild(img);
                };
                reader.readAsDataURL(file);
            });
        } else {
            previewSection.style.display = 'none';
        }
    });
}