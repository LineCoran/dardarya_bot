import TelegramBot from 'node-telegram-bot-api';

const token = '8109563932:AAF2UdGE3-0FR8O2USCaTQwML3aEinWZkIY';
const bot = new TelegramBot(token, { polling: true });
const userSessions = {};

// Создаем базовую структуру данных для нового чата
const initializeChatSession = () => ({
    categories: ['Штаны'],
    isAddingExpense: false,
    isAddingCategory: false,
    expenseAmount: 0,
    totalExpenses: 0,
});

// Устанавливаем команды бота
bot.setMyCommands([
    { command: '/set', description: 'Внести трату' },
    { command: '/show_categories', description: 'Посмотреть мои категории' },
    { command: '/start', description: 'Начать' }
]);

// Формируем список категорий в формате инлайн-клавиатуры
const createCategoryOptions = (chatId) => {
    const inlineKeyboard = userSessions[chatId].categories.map(category => [{
        text: category,
        callback_data: category
    }]);

    return {
        reply_markup: JSON.stringify({ inline_keyboard: inlineKeyboard })
    };
};

// Обработчик входящих текстовых сообщений
bot.on('message', async (msg) => {
    try {
        const chatId = msg.chat.id;
        const text = msg.text;

        // Инициализируем сессию пользователя
        if (!userSessions[chatId]) userSessions[chatId] = initializeChatSession();

        const session = userSessions[chatId];

        // Обработка ввода суммы
        if (session.isAddingExpense) {
            session.expenseAmount = parseFloat(text);
            session.isAddingCategory = true;
            session.isAddingExpense = false;

            const categoriesMarkup = createCategoryOptions(chatId);
            const responseMessage = session.categories.length > 0
                ? 'Выберите категорию или добавьте новую:'
                : 'Введите новую категорию:';
            return bot.sendMessage(chatId, responseMessage, categoriesMarkup);
        }

        // Добавление новой категории
        if (session.isAddingCategory) {
            if (session.categories.includes(text)) {
                return bot.sendMessage(chatId, 'Такая категория уже есть, напишите новую.');
            }

            session.categories.push(text);
            session.totalExpenses += session.expenseAmount;
            session.isAddingCategory = false;
            session.expenseAmount = 0;

            return bot.sendMessage(chatId, 'Сумма успешно добавлена!');
        }

        // Команды
        switch (text) {
            case '/start':
                return bot.sendMessage(chatId, 'Привет! Это бот для учета финансов. Начните с настройки категорий.');
            case '/set':
                session.isAddingExpense = true;
                return bot.sendMessage(chatId, 'Введите сумму расхода:');
            case '/show_categories':
                const categoriesList = session.categories.join(', ');
                return bot.sendMessage(chatId, categoriesList ? `Ваши категории: ${categoriesList}` : 'Категорий пока нет.');
            default:
                return; // Игнорируем нераспознанные команды
        }
    } catch (error) {
        console.error('Ошибка обработки сообщения:', error);
    }
});

// Обработчик инлайн-кнопок
bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const category = query.data;

    if (!userSessions[chatId]) return;

    const session = userSessions[chatId];

    if (session.categories.includes(category)) {
        session.totalExpenses += session.expenseAmount;
        session.isAddingExpense = false;
        session.isAddingCategory = false;
        session.expenseAmount = 0;

        return bot.sendMessage(chatId, 'Сумма успешно добавлена!');
    }
});
