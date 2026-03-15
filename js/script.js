const flightData = [
    { from: 'Warsaw', to: 'Cambodia', price: '500 $', timestart: '14:00', timeend: '00:00', img: 'assets/images/cambodia.jpg' },
    { from: 'Dubai', to: 'Hong Kong', price: '350 $', timestart: '09:30', timeend: '16:30', img: 'assets/images/hongkong.jpg' },
    { from: 'Kiev', to: 'Phuket', price: '550 $', timestart: '10:30', timeend: '20:30', img: 'assets/images/phuket.jpg' },
    { from: 'Milan', to: 'Osaka', price: '800 $', timestart: '08:00', timeend: '22:00', img: 'assets/images/osaka.jpg' },
    { from: 'New York', to: 'Tibet', price: '1200 $', timestart: '08:00', timeend: '16:00', img: 'assets/images/tibet.jpg' },
    { from: 'Bangkok', to: 'Ho Shi Min', price: '100 $', timestart: '12:00', timeend: '14:00', img: 'assets/images/hoshimin.jpg' },
];

function init() {
    const container = document.getElementById('flights-container');
    if (!container) return;

    container.innerHTML = '';

    flightData.forEach((flight, index) => {
        const card = document.createElement('div');
        card.className = 'ticket-card';
        
        card.innerHTML = `
            <div class="ticket-img-wrapper">
                <img src="${flight.img}" alt="${flight.to}" class="ticket-img" onerror="this.onerror=null; this.src='https://via.placeholder.com/320x170?text=No+Image'">
            </div>
            <div class="ticket-info">
                <h3>${flight.from} → ${flight.to}</h3>
                <p>Departure: <strong>${flight.timestart}</strong></p>
                <p>Arrival: <strong>${flight.timeend}</strong></p>
                <div class="price">${flight.price}</div>
                <button class="buy-btn">Choose Ticket</button>
            </div>
        `;
        
        container.appendChild(card);

        setTimeout(() => {
            card.classList.add('visible');
        }, index * 100); 
    });
}

document.addEventListener('DOMContentLoaded', init);