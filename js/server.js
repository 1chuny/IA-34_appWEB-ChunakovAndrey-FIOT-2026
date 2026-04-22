const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const ACCESS_TOKEN_SECRET = 'super_secret_access_key_123';
const DB_FILE = path.join(__dirname, 'users.json');
const FLIGHTS_FILE = path.join(__dirname, 'flights.json');
const PURCHASES_FILE = path.join(__dirname, 'purchases.json');

// --- Створення БД, якщо їх немає ---
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([]));
if (!fs.existsSync(PURCHASES_FILE)) fs.writeFileSync(PURCHASES_FILE, JSON.stringify([]));
if (!fs.existsSync(FLIGHTS_FILE)) {
    const defaultFlights = [
        { id: 1, from: 'Warsaw', to: 'Cambodia', price: '500 $', timestart: '14:00', timeend: '00:00', img: 'assets/images/cambodia.jpg' },
        { id: 2, from: 'Dubai', to: 'Hong Kong', price: '350 $', timestart: '09:30', timeend: '16:30', img: 'assets/images/hongkong.jpg' }
    ];
    fs.writeFileSync(FLIGHTS_FILE, JSON.stringify(defaultFlights, null, 2));
}

const readDB = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeDB = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// --- Middleware: Перевірка токена ---
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Access denied.' });

    jwt.verify(token, ACCESS_TOKEN_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token.' });
        req.user = user;
        next();
    });
};

// --- Middleware: Перевірка прав Адміна ---
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied. Admins only.' });
    }
    next();
};

// ================= AUTH =================
app.post('/register', async (req, res) => {
    const { email, password, confirmPassword } = req.body;
    if (password !== confirmPassword) return res.status(400).json({ message: 'Passwords do not match.' });

    let users = readDB(DB_FILE);
    if (users.find(u => u.email === email)) return res.status(400).json({ message: 'User already exists.' });

    const hashedPassword = await bcrypt.hash(password, 10);
    // За замовчуванням всі - звичайні юзери (user)
    users.push({ id: Date.now().toString(), email, password: hashedPassword, role: 'user' });
    writeDB(DB_FILE, users);
    res.status(201).json({ message: 'Registered successfully.' });
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const users = readDB(DB_FILE);
    const user = users.find(u => u.email === email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const accessToken = jwt.sign({ id: user.id, email: user.email, role: user.role }, ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
    res.json({ accessToken, role: user.role });
});

app.get('/profile', authenticateToken, (req, res) => {
    const user = readDB(DB_FILE).find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ email: user.email, role: user.role });
});

// ================= ФУНКЦІОНАЛ КВИТКІВ ТА ПОКУПОК =================

// Отримати всі рейси (доступно всім)
app.get('/flights', (req, res) => {
    res.json(readDB(FLIGHTS_FILE));
});

// Купити квиток (тільки для авторизованих)
app.post('/buy', authenticateToken, (req, res) => {
    const { flightId, destination } = req.body;
    let purchases = readDB(PURCHASES_FILE);
    
    purchases.push({
        id: Date.now().toString(),
        userEmail: req.user.email,
        flightId,
        destination,
        date: new Date().toLocaleString()
    });
    
    writeDB(PURCHASES_FILE, purchases);
    res.json({ message: `Successfully booked a ticket to ${destination}!` });
});

// ================= АДМІН ПАНЕЛЬ =================

// Отримати всі покупки (тільки Адмін)
app.get('/admin/purchases', authenticateToken, requireAdmin, (req, res) => {
    res.json(readDB(PURCHASES_FILE));
});

// Додати новий рейс (тільки Адмін)
app.post('/admin/flights', authenticateToken, requireAdmin, (req, res) => {
    const { from, to, price, timestart, timeend, img } = req.body;
    let flights = readDB(FLIGHTS_FILE);
    
    flights.push({
        id: Date.now(),
        from, to, price, timestart, timeend, 
        img: img || 'https://via.placeholder.com/320x170?text=Flight'
    });
    
    writeDB(FLIGHTS_FILE, flights);
    res.status(201).json({ message: 'Flight added successfully!' });
});

// Оновити існуючий рейс (Update)
app.put('/admin/flights/:id', authenticateToken, requireAdmin, (req, res) => {
    const flightId = parseInt(req.params.id);
    let flights = readDB(FLIGHTS_FILE);
    const index = flights.findIndex(f => f.id === flightId);

    if (index !== -1) {
        // Оновлюємо дані, залишаючи старі там, де нові не передані
        flights[index] = { ...flights[index], ...req.body };
        writeDB(FLIGHTS_FILE, flights);
        res.json({ message: 'Flight updated successfully!' });
    } else {
        res.status(404).json({ message: 'Flight not found.' });
    }
});

// Видалити рейс (Delete)
app.delete('/admin/flights/:id', authenticateToken, requireAdmin, (req, res) => {
    const flightId = parseInt(req.params.id);
    let flights = readDB(FLIGHTS_FILE);
    const initialLength = flights.length;
    
    flights = flights.filter(f => f.id !== flightId);
    
    if (flights.length < initialLength) {
        writeDB(FLIGHTS_FILE, flights);
        res.json({ message: 'Flight deleted successfully!' });
    } else {
        res.status(404).json({ message: 'Flight not found.' });
    }
});

app.listen(3000, () => console.log(`Server running on http://localhost:3000`));