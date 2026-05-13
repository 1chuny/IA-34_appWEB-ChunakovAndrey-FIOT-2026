const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createClient } = require('redis');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { body, validationResult } = require('express-validator');

const app = express();
app.use(express.json());
app.use(cors());

// --- ЗАХИСТ API ---
app.use(helmet()); // Захист HTTP-заголовків

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 хвилин
    max: 100, // Максимум 100 запитів з одного IP
    message: "Забагато запитів, спробуйте пізніше."
});
app.use(limiter);

// --- НАЛАШТУВАННЯ REDIS ---
// url 'redis://redis:6379' для роботи через Docker. Якщо запускаєш локально без Docker, зміни на 'redis://localhost:6379'
const redisClient = createClient({ url: 'redis://redis:6379' });
redisClient.on('error', (err) => console.log('Redis Error: ', err));

// --- SWAGGER ДОКУМЕНТАЦІЯ ---
const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: { title: 'Airline Tickets API', version: '1.0.0', description: 'API для бронювання авіаквитків' },
        components: {
            securitySchemes: {
                bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
            }
        }
    },
    apis: ['server.js'], 
};
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerJsDoc(swaggerOptions)));

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

/**
 * @swagger
 * /register:
 *   post:
 *     description: Реєстрація нового користувача
 */
app.post('/register', [
    body('email').isEmail().withMessage('Некоректний email'),
    body('password').isLength({ min: 6 }).withMessage('Пароль має бути мінімум 6 символів')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, confirmPassword } = req.body;
    if (password !== confirmPassword) return res.status(400).json({ message: 'Passwords do not match.' });

    let users = readDB(DB_FILE);
    if (users.find(u => u.email === email)) return res.status(400).json({ message: 'User already exists.' });

    const hashedPassword = await bcrypt.hash(password, 10);
    users.push({ id: Date.now().toString(), email, password: hashedPassword, role: 'user' });
    writeDB(DB_FILE, users);
    res.status(201).json({ message: 'Registered successfully.' });
});

/**
 * @swagger
 * /login:
 *   post:
 *     description: Авторизація користувача
 */
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

/**
 * @swagger
 * /flights:
 *   get:
 *     description: Отримати всі рейси (оптимізовано через Redis)
 */
app.get('/flights', async (req, res) => {
    try {
        // Перевіряємо кеш Redis
        const cachedFlights = await redisClient.get('flights');
        if (cachedFlights) {
            console.log("✈️ Дані віддано з Redis");
            return res.json(JSON.parse(cachedFlights));
        }

        console.log("📂 Читання даних з файлу JSON");
        const flights = readDB(FLIGHTS_FILE);
        
        // Записуємо в кеш на 60 секунд
        await redisClient.setEx('flights', 60, JSON.stringify(flights));
        res.json(flights);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @swagger
 * /buy:
 *   post:
 *     description: Купити квиток
 *     security:
 *       - bearerAuth: []
 */
app.post('/buy', authenticateToken, [
    body('flightId').notEmpty(),
    body('destination').notEmpty()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

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

app.get('/admin/purchases', authenticateToken, requireAdmin, (req, res) => {
    res.json(readDB(PURCHASES_FILE));
});

/**
 * @swagger
 * /admin/flights:
 *   post:
 *     description: Додати новий рейс (Тільки Адмін)
 *     security:
 *       - bearerAuth: []
 */
app.post('/admin/flights', authenticateToken, requireAdmin, [
    body('from').notEmpty(),
    body('to').notEmpty(),
    body('price').notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { from, to, price, timestart, timeend, img } = req.body;
    let flights = readDB(FLIGHTS_FILE);
    
    flights.push({
        id: Date.now(),
        from, to, price, timestart, timeend, 
        img: img || 'https://via.placeholder.com/320x170?text=Flight'
    });
    
    writeDB(FLIGHTS_FILE, flights);
    await redisClient.del('flights'); // Скидаємо кеш, оскільки додано новий рейс
    res.status(201).json({ message: 'Flight added successfully!' });
});

app.put('/admin/flights/:id', authenticateToken, requireAdmin, async (req, res) => {
    const flightId = parseInt(req.params.id);
    let flights = readDB(FLIGHTS_FILE);
    const index = flights.findIndex(f => f.id === flightId);

    if (index !== -1) {
        flights[index] = { ...flights[index], ...req.body };
        writeDB(FLIGHTS_FILE, flights);
        await redisClient.del('flights'); // Скидаємо кеш
        res.json({ message: 'Flight updated successfully!' });
    } else {
        res.status(404).json({ message: 'Flight not found.' });
    }
});

app.delete('/admin/flights/:id', authenticateToken, requireAdmin, async (req, res) => {
    const flightId = parseInt(req.params.id);
    let flights = readDB(FLIGHTS_FILE);
    const initialLength = flights.length;
    
    flights = flights.filter(f => f.id !== flightId);
    
    if (flights.length < initialLength) {
        writeDB(FLIGHTS_FILE, flights);
        await redisClient.del('flights'); // Скидаємо кеш
        res.json({ message: 'Flight deleted successfully!' });
    } else {
        res.status(404).json({ message: 'Flight not found.' });
    }
});

// ================= ЗАПУСК =================
async function startServer() {
    await redisClient.connect();
    app.listen(3000, () => {
        console.log(`🚀 Server running on http://localhost:3000`);
        console.log(`📚 Swagger Docs available at http://localhost:3000/api-docs`);
    });
}

startServer();