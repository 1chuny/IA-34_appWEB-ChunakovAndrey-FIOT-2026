const { Sequelize, DataTypes } = require('sequelize');

// Підключення через Sequelize ORM до твоєї бази PostgreSQL
const sequelize = new Sequelize('web_backend_lab', 'postgres', 'admin', {
    host: 'localhost',
    dialect: 'postgres', 
    logging: false
});

// Створення моделей (Таблиць)
const User = sequelize.define('User', {
    username: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true }
});

const Post = sequelize.define('Post', {
    title: { type: DataTypes.STRING, allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false }
});

// Реалізація зв'язку One-to-Many (Один до багатьох)
User.hasMany(Post, { foreignKey: 'userId', onDelete: 'CASCADE' });
Post.belongsTo(User, { foreignKey: 'userId' });

// Запуск коду
async function runSequelize() {
    try {
        await sequelize.authenticate();
        console.log('✅ Успішно підключено до PostgreSQL через Sequelize!');

        // Створюємо таблиці в базі
        await sequelize.sync({ force: true });
        console.log('✅ Таблиці створено!');

        // Додаємо тестового користувача
        const user1 = await User.create({
            username: 'Andrey',
            email: 'andrey@kpi.ua'
        });

        // Додаємо пост для цього користувача
        await Post.create({
            title: 'Мій перший пост через ORM',
            content: 'Sequelize працює відмінно!',
            userId: user1.id
        });

        // Дістаємо дані з бази, щоб перевірити
        const usersWithPosts = await User.findAll({ include: Post });
        
        console.log('\n--- РЕЗУЛЬТАТ З БАЗИ ДАНИХ ---');
        console.log(JSON.stringify(usersWithPosts, null, 2));

    } catch (error) {
        console.error('❌ Помилка ORM:', error);
    } finally {
        await sequelize.close();
    }
}

runSequelize();