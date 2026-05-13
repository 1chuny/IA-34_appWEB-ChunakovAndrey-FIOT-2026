const { Client } = require('pg');

async function runRawQueries() {
    // 4. Підключення Node.js до PostgreSQL
    const client = new Client({
        host: 'localhost',
        user: 'postgres',       
        password: 'admin', 
        database: 'web_backend_lab',
        port: 5432,             
    });

    try {
        await client.connect();
        console.log('✅ Підключено до PostgreSQL через пакет pg!');

        // Очистимо таблицю
        await client.query('DELETE FROM users');

        // 5. Виконання SQL-запитів
        // INSERT 
        const insertResult = await client.query(
            'INSERT INTO users (username, email) VALUES ($1, $2) RETURNING id', 
            ['TestUser', 'test@example.com']
        );
        console.log('INSERT ID:', insertResult.rows[0].id);

        // SELECT
        const selectResult = await client.query('SELECT * FROM users');
        console.log('SELECT:', selectResult.rows);

    } catch (err) {
        console.error('Помилка бази даних:', err);
    } finally {
        await client.end();
    }
}

runRawQueries();