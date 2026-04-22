const API_URL = 'http://localhost:3000';
let globalFlights = []; // Сюди збережемо квитки з сервера

// Завантаження квитків з бекенду
async function loadFlights() {
    try {
        const res = await fetch(`${API_URL}/flights`);
        globalFlights = await res.json();
        render(globalFlights);
    } catch (err) {
        console.error("Не вдалося завантажити квитки", err);
    }
}

// Відображення карток
function render(data) {
    const container = document.getElementById('flights-container');
    if (!container) return;
    container.innerHTML = '';

    data.forEach((flight, index) => {
        const card = document.createElement('div');
        card.className = 'ticket-card';
        card.innerHTML = `
            <div class="ticket-img-wrapper">
                <img src="${flight.img}" class="ticket-img" onerror="this.onerror=null; this.src='https://via.placeholder.com/320x170?text=No+Image'">
            </div>
            <div class="ticket-info">
                <h3>${flight.from} → ${flight.to}</h3>
                <p>Departure: <strong>${flight.timestart}</strong></p>
                <p>Arrival: <strong>${flight.timeend}</strong></p>
                <div class="price">${flight.price}</div>
                <button class="buy-btn" onclick="buyTicket(${flight.id}, '${flight.to}')">Choose Ticket</button>
            </div>
        `;
        container.appendChild(card);
        setTimeout(() => card.classList.add('visible'), index * 100);
    });
}

// Купівля квитка (звернення до сервера)
async function buyTicket(flightId, destination) {
    const token = localStorage.getItem('accessToken');
    if (!token) {
        alert('You must be logged in to book tickets.');
        document.getElementById('modal-login').classList.add('active');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/buy`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ flightId, destination })
        });
        const data = await res.json();
        alert(data.message);
    } catch (err) {
        alert("Server error.");
    }
}

// Оновлення UI шапки сайту
async function updateAuthUI() {
    const authGroup = document.getElementById('auth-group');
    const token = localStorage.getItem('accessToken');

    if (token) {
        // Запитуємо роль користувача
        const res = await fetch(`${API_URL}/profile`, { headers: { 'Authorization': `Bearer ${token}` } });
        const userData = await res.json();

        let buttonsHTML = `<button class="btn-login" id="btn-profile" style="margin-right: 5px; color: #feba02; border-color: #feba02;">Profile</button>`;
        
        // Якщо це АДМІН, додаємо кнопку переходу на admin.html
        if (userData.role === 'admin') {
            buttonsHTML += `<button class="btn-register" id="btn-admin" style="margin-right: 5px; background: red; color: white;">Admin</button>`;
        }
        
        buttonsHTML += `<button class="btn-login" id="btn-logout">Log out</button>`;
        authGroup.innerHTML = buttonsHTML;
        
        // Логаут
        document.getElementById('btn-logout').onclick = () => {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            updateAuthUI();
        };

        // Відкрити профіль
        document.getElementById('btn-profile').onclick = () => {
            document.getElementById('modal-profile').classList.add('active');
            loadProfileData(); // Завантажуємо свіжі дані
        };

        // Перехід в адмінку
        const btnAdmin = document.getElementById('btn-admin');
        if (btnAdmin) {
            btnAdmin.onclick = () => {
                window.location.href = 'admin.html'; // ПЕРЕХІД НА НОВУ СТОРІНКУ!
            };
        }
    } else {
        authGroup.innerHTML = `
            <button class="btn-login" id="open-login">Log in</button>
            <button class="btn-register" id="open-register">Register</button>
        `;
        setupModals(); 
    }
}

// Завантаження даних профілю
async function loadProfileData() {
    const token = localStorage.getItem('accessToken');
    try {
        const res = await fetch(`${API_URL}/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (res.ok) {
            document.getElementById('prof-email').innerText = data.email;
            document.getElementById('prof-role').innerText = data.role.toUpperCase();
        }
    } catch (err) {
        console.error('Error fetching profile:', err);
    }
}

// Зміна пароля (Особистий кабінет)
const formPassword = document.getElementById('form-password');
if (formPassword) {
    formPassword.onsubmit = async (e) => {
        e.preventDefault();
        const oldPassword = document.getElementById('old-password').value;
        const newPassword = document.getElementById('new-password').value;
        const token = localStorage.getItem('accessToken');

        const res = await fetch(`${API_URL}/profile/password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ oldPassword, newPassword })
        });
        const data = await res.json();
        alert(data.message);
        if (res.ok) formPassword.reset();
    };
}

// Видалення акаунта
const btnDeleteAccount = document.getElementById('btn-delete-account');
if (btnDeleteAccount) {
    btnDeleteAccount.onclick = async () => {
        if (!confirm('Are you sure you want to delete your account?')) return;
        
        const token = localStorage.getItem('accessToken');
        const res = await fetch(`${API_URL}/profile`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        alert(data.message);
        
        if (res.ok) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            document.getElementById('modal-profile').classList.remove('active');
            updateAuthUI();
        }
    };
}

// Реєстрація
document.getElementById('form-register').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm').value;

    const res = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, confirmPassword })
    });
    const data = await res.json();
    if (res.ok) {
        alert('Registered! Now log in.');
        document.getElementById('modal-register').classList.remove('active');
        document.getElementById('modal-login').classList.add('active');
    } else alert(data.message);
};

// Вхід
document.getElementById('form-login').onsubmit = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: document.getElementById('login-email').value,
            password: document.getElementById('login-password').value
        })
    });
    const data = await res.json();
    if (res.ok) {
        localStorage.setItem('accessToken', data.accessToken);
        document.getElementById('modal-login').classList.remove('active');
        updateAuthUI();
    } else alert(data.message);
};

// Налаштування кнопок модальних вікон
function setupModals() {
    const loginModal = document.getElementById('modal-login');
    const registerModal = document.getElementById('modal-register');
    
    if(document.getElementById('open-login')) document.getElementById('open-login').onclick = () => loginModal.classList.add('active');
    if(document.getElementById('open-register')) document.getElementById('open-register').onclick = () => registerModal.classList.add('active');
}

// Глобальний обробник для закриття ВСІХ модальних вікон
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal-close')) {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.classList.remove('active');
        });
    }
});

// Запуск при завантаженні сторінки
document.addEventListener('DOMContentLoaded', () => {
    loadFlights();
    updateAuthUI();
});