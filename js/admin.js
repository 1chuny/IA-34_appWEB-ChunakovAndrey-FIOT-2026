const API_URL = 'http://localhost:3000';
const token = localStorage.getItem('accessToken');

// Захист сторінки: перевіряємо, чи є юзер адміном
async function checkAdminAccess() {
    if (!token) {
        window.location.href = 'index.html';
        return;
    }
    try {
        const res = await fetch(`${API_URL}/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.role !== 'admin') {
            window.location.href = 'index.html'; // Якщо не адмін - викидаємо на головну
        } else {
            loadTable(); // Якщо адмін - вантажимо таблицю
        }
    } catch (err) {
        window.location.href = 'index.html';
    }
}

// Завантаження квитків у таблицю (Read)
async function loadTable() {
    const tbody = document.getElementById('admin-table-body');
    try {
        const res = await fetch(`${API_URL}/flights`);
        const flights = await res.json();
        
        tbody.innerHTML = '';
        flights.forEach(f => {
            tbody.innerHTML += `
                <tr>
                    <td>${f.id}</td>
                    <td><strong>${f.from}</strong> → <strong>${f.to}</strong></td>
                    <td>${f.timestart} - ${f.timeend}</td>
                    <td style="color: #c0392b; font-weight: bold;">${f.price}</td>
                    <td>
                        <button class="btn-edit" onclick="openEditModal(${f.id}, '${f.from}', '${f.to}', '${f.price}', '${f.timestart}', '${f.timeend}', '${f.img}')">Edit</button>
                        <button class="btn-delete" onclick="deleteFlight(${f.id})">Delete</button>
                    </td>
                </tr>
            `;
        });
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5">Error loading flights.</td></tr>`;
    }
}

// Додавання рейсу (Create)
document.getElementById('admin-add-form').onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
        from: document.getElementById('add-from').value,
        to: document.getElementById('add-to').value,
        price: document.getElementById('add-price').value,
        timestart: document.getElementById('add-start').value,
        timeend: document.getElementById('add-end').value,
        img: document.getElementById('add-img').value || 'https://via.placeholder.com/320x170?text=Flight'
    };

    await fetch(`${API_URL}/admin/flights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
    });
    
    document.getElementById('admin-add-form').reset();
    loadTable();
};

// Видалення рейсу (Delete)
async function deleteFlight(id) {
    if (!confirm('Are you sure you want to delete this flight?')) return;

    await fetch(`${API_URL}/admin/flights/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    loadTable();
}

// ================= РЕДАГУВАННЯ (Update) =================

function openEditModal(id, from, to, price, start, end, img) {
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-from').value = from;
    document.getElementById('edit-to').value = to;
    document.getElementById('edit-price').value = price;
    document.getElementById('edit-start').value = start;
    document.getElementById('edit-end').value = end;
    document.getElementById('edit-img').value = img !== 'undefined' ? img : '';
    
    document.getElementById('modal-edit').classList.add('active');
}

function closeEditModal() {
    document.getElementById('modal-edit').classList.remove('active');
}

document.getElementById('admin-edit-form').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const payload = {
        from: document.getElementById('edit-from').value,
        to: document.getElementById('edit-to').value,
        price: document.getElementById('edit-price').value,
        timestart: document.getElementById('edit-start').value,
        timeend: document.getElementById('edit-end').value,
        img: document.getElementById('edit-img').value
    };

    await fetch(`${API_URL}/admin/flights/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
    });
    
    closeEditModal();
    loadTable();
};

// Запуск перевірки при старті
checkAdminAccess();