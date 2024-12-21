import TelegramBot from 'node-telegram-bot-api';
import { KEYBOARDS } from './constants/constants.js';
import fs from 'fs';
import { dbService } from './service.js';

const token = process.env.TG_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const MAIN_ADMIN = 'alexeiiiii';
const SUB_MAIN_ADMIN = ['Mazhako'];
const DELETE_ADMIN_UNIQ_PREFIX = '/delete_admin--'


bot.setMyCommands([{ command: '/start', description: 'Начать' }]);


const createCategoryOptions = (inline_keyboard, options = { isBack: false, isMain: false, isCancel: false }) => {

    if (options.isBack) inline_keyboard = [...inline_keyboard, ...KEYBOARDS.BACK ]
    if (options.isMain) inline_keyboard = [...inline_keyboard, ...KEYBOARDS.MAIN ]
    if (options.isCancel) inline_keyboard = [...inline_keyboard, ...KEYBOARDS.CANCEL ]

    return {
        reply_markup: JSON.stringify({ inline_keyboard })
    };
};


const getStartMsg = (isAdmin) => {
    let buttons = [...KEYBOARDS.START]
    if (isAdmin) buttons = [...buttons, ...KEYBOARDS.ADMIN]
    return {
        text: 'Вы находитесь в главном меню. Выберите действие!',
        options: createCategoryOptions(buttons),
    }
}

const sendOrEditMessage = async (chatId, newText, options) => {
    const session = await dbService.getUserSession(chatId);
    const lastMessageId = session.last_message_id;
  try {
    if (lastMessageId) {
      await bot.editMessageText(newText, {
        chat_id: chatId,
        message_id: lastMessageId,
        ...options,
      });
    } else {
      const sentMessage = await bot.sendMessage(chatId, newText, options);
      session.last_message_id = sentMessage.message_id
    dbService.saveUserSession(chatId, session);
    }
  } catch (error) {
    console.error('Ошибка редактирования/отправки сообщения:', error);
    const sentMessage = await bot.sendMessage(chatId, newText, options);
    session.last_message_id = sentMessage.message_id
    dbService.saveUserSession(chatId, session);
  }
};

const sendMessage = async (chatId, text, options) => {
    const session = await dbService.getUserSession(chatId);
  try {
      const sentMessage = await bot.sendMessage(chatId, text, options);
      session.last_message_id = sentMessage.message_id;
      await dbService.saveUserSession(chatId, session);
  } catch (error) {
    const sentMessage = await bot.sendMessage(chatId, text, options);
    session.last_message_id = sentMessage.message_id
    await dbService.saveUserSession(chatId, session);
  }
};

bot.on('message', async (msg) => {

    try {
        const chatId = msg.chat.id;
        const text = msg.text;
            
        const session = await dbService.getUserSession(chatId);

        if (session.is_set_admin_process) {
            const isValidUser = text.includes('@') && text.length > 1;

            if (!isValidUser) return sendMessage(chatId, `Отсутствует специальный символ '@' или длина меньше 2 символов! Повторите попытку`, createCategoryOptions([], { isMain: true }));
            const justName = text.replaceAll('@', '')

            try {
                await dbService.addAdmin(justName)
                return sendMessage(chatId, `Пользователь ${text} успешно добавлен!`, createCategoryOptions([], { isMain: true }));
            } catch(error) {
                return sendMessage(chatId, `Не удалось сохранить пользователя ${text}. Попробуйте еще раз.`, createCategoryOptions([], { isMain: true }));
            }
            
        }

        if (session.is_create_order_process) {

            if (!msg.photo) return sendMessage(chatId, 'Вы не отправили скриншот с товаром! Повторите отправку.', createCategoryOptions([], { isMain: true }))
            if (!msg.caption) return sendMessage(chatId, 'Вы не отправили описание заказа! Повторите отправку.', createCategoryOptions([], { isMain: true }));
            sendMessage(chatId, 'Оформляем ваш заказ');

            setTimeout(async () => {
                await sendOrEditMessage(chatId, 'Заказ успешно оформлен!', createCategoryOptions(KEYBOARDS.NEW_ORDER, { isMain: true }));
                const admins = await getChatsWithAdmins();

                admins.forEach(adminChatId => {
                    sendMessage(adminChatId, `Новый заказ!`)
                    bot.forwardMessage(adminChatId, chatId, msg.message_id)
                })
                session.is_create_order_process = false;
                dbService.saveUserSession(chatId, session)
            }, 3000)
            return
        }


        switch (text) {
            case '/start':
                const admins =  await getAdmins()
                if (admins.includes(msg.chat.username)) {
                    try {
                        session.is_admin = true;
                        await dbService.addChatWithAdmin(msg.chat.username, chatId);
                        await bot.sendMessage(chatId, `Привет ${msg.chat.first_name} ${msg.chat.last_name}! Ты идентифицирован как администратор!`);
                        await bot.sendMessage(chatId, `Я буду отправлять тебе все заказы которые будут приходить!`);
                    } catch (error) {
                        await bot.sendMessage(chatId, `Что-то пошло не так... Ошибка ${error.message}`);
                    }
                }

                const { text, options } = getStartMsg(session.is_admin);
                const sentMessage = await bot.sendMessage(chatId, text, options );
                session.last_message_id = sentMessage.message_id;
                session.first_name = msg.chat.first_name || 'unkwon first_name';
                session.second_name = msg.chat.last_name || 'unkwon last_name';
                dbService.saveUserSession(chatId, session);
            default:
                return;
        }
    } catch (error) {
        console.error('Ошибка обработки сообщения:', error);
    }
});

bot.on('callback_query', async (query) => {
    try {


    const chatId = query.message.chat.id;
    const callback_query = query.data;
    const session = await dbService.getUserSession(chatId);

    if (callback_query.includes(DELETE_ADMIN_UNIQ_PREFIX)) {
        const adminUserNameToDelete = callback_query.replaceAll(DELETE_ADMIN_UNIQ_PREFIX, '')

        if ([...MAIN_ADMIN, ...SUB_MAIN_ADMIN].includes(adminUserNameToDelete)) {
            return sendOrEditMessage(chatId, `Пользователя @${adminUserNameToDelete} невозможно удалить из списка администраторов!`, createCategoryOptions([], { isMain: true }));
        }

        try {
            await dbService.deleteAdmin(adminUserNameToDelete);
            return sendOrEditMessage(chatId, `Пользователь @${adminUserNameToDelete} успешно удален из списка администраторов!`, createCategoryOptions([], { isMain: true }))    
        } catch(error) {
            console.log(error)
            return sendOrEditMessage(chatId, `Не удалось удалить пользователя @${adminUserNameToDelete}. Попробуйте позже! ${error.message}`, createCategoryOptions([], { isMain: true }))    
        }

    }

    switch (callback_query) {
        case '/about':
            return  sendOrEditMessage(chatId, '\n' +
                'Привет 👋 \n' +
                '\n' +
                'Меня зовут Даша! Я занимаюсь выкупом и доставкой товаров из Китая под ключ 🔑 \n' +
                '\n' +
                'Занимаюсь я этим более 3 лет. Поэтому с вашим грузом точно всё будет в порядке!\n' +
                '\n' +
                'Я привезла более 10 тонн, различных категорий, товара.\n' +
                '\n' +
                'С отзывами моих клиентов вы можете ознакомиться на моей страничке в «Instagram». Ссылка на нее есть в разделе «Контакты»\n' +
                '\n' +
                'Если вы еще не скачали все приложения - у меня есть бесплатный Гайд. А если хотите научиться заказывать сами - обучение.\n' +
                '\n' +
                'Жду ваш заказ 😉', createCategoryOptions([], { isBack: true })
            )
        case '/back':
            const { text, options } = getStartMsg(session.is_admin)
            session.is_create_order_process = false;
            session.is_set_admin_process = false;
            await dbService.saveUserSession(chatId, session);
            return sendOrEditMessage(chatId, text, options );
        case '/contacts':
            return sendOrEditMessage(chatId, 'Наши контакты:', createCategoryOptions(KEYBOARDS.LINKS.CONTACTS, { isBack: true }))
        case '/conditions':
            return sendOrEditMessage(chatId, 'Условия:', createCategoryOptions(KEYBOARDS.LINKS.CONDITIONS, { isBack: true }))
        case '/agreements':
            return sendOrEditMessage(chatId, 'Договора:', createCategoryOptions(KEYBOARDS.LINKS.AGREEMENTS, { isBack: true }))
        case '/education':
            return sendOrEditMessage(chatId, `База WeChat - 50 BYN\nДоставка - 150 BYN\nВыкуп - 200 BYN\nВыкуп и доставка - 300 BYN\nКонсультация по официальному ввозу - 500 BYN`, createCategoryOptions([], { isBack: true }))
        case '/order':            
            const photoPath = './assets/order_form.jpg';
            if (!session.is_send_photo) {
                session.is_send_photo = true;
                dbService.saveUserSession(chatId, session);
                await bot.sendPhoto(chatId, fs.createReadStream(photoPath), { caption: 'Пример оформления' });
                await sendMessage(chatId, 'Выберите действие в меню ниже:', createCategoryOptions(KEYBOARDS.ORDER, { isBack: true }))
            } else {
                return sendOrEditMessage(chatId, 'Выберите действие в меню ниже:', createCategoryOptions(KEYBOARDS.ORDER, { isBack: true }))
            }
            
        case '/credentials':
            return sendOrEditMessage(chatId, `Получатель: ИП Чуянова Дарья Александровна\nУНП : 491643105\nНомер счёта : BY74POIS30130163001701933001\nБанк : ОАО «Паритетбанк»\nБИК : POISBY2X\nКОД ПЛАТЕЖА (вводить только при необходимости) : 90401\nНазначение платежа : Оказание услуг`, createCategoryOptions([], { isBack: true }))    
        case '/create_order':
            session.is_create_order_process = true;
            dbService.saveUserSession(chatId, session);
            return sendOrEditMessage(chatId, 'Пришлите скрин с текстом:', createCategoryOptions([], { isCancel: true }))

        case '/admin':
            return sendOrEditMessage(chatId, 'Различные кнопочки:', createCategoryOptions(KEYBOARDS.ADMIN_BUTTONS, { isBack: true }))

        case '/admin_admins_list':
            let msg = ''
            const admins = await dbService.getAdmins();
            const filteredAdmins = admins.filter(admin => admin.username !== MAIN_ADMIN);
            filteredAdmins.forEach(admin => msg += `@${admin.username}\n`)
            return sendOrEditMessage(chatId, `Список администраторов:\n ${msg}`, createCategoryOptions([], { isBack: true } ))
        case '/admin_sessions':

        try {
            let msgForSession = ''
            const allSession = await dbService.getSessions();
            allSession.forEach(sessionItem => msgForSession += `Имя: ${sessionItem.first_name} ${sessionItem.second_name}\n Дата: ${sessionItem.timestamp}`)
            return sendOrEditMessage(chatId, `Список всех сессий:\n ${msgForSession}`, createCategoryOptions([], { isBack: true } ))

        } catch (error) {
            return sendOrEditMessage(chatId, `Не удалось получить список сессий. Попробуйте позже. Error: ${error.message}`, createCategoryOptions([], { isBack: true } ))
        }

        case '/admin_set_admin':
            session.is_set_admin_process = true;
            dbService.saveUserSession(chatId, session);
            return sendOrEditMessage(chatId, 'Пришлите id пользователя в формате @alexeiiiii:', createCategoryOptions([], { isCancel: true }))
        case '/admin_delete_admin':
            const adminsToDelete = await dbService.getAdmins();
            const filteredAdminsToDelete = adminsToDelete.filter(admin => admin.username !== MAIN_ADMIN);
            const buttonWithAdminsToDelete = createAdminsListToDelete(filteredAdminsToDelete);
            if (buttonWithAdminsToDelete.length === 0) return sendOrEditMessage(chatId, 'Список администраторов пуст. Удалять некого.', createCategoryOptions([], { isMain: true }))    
            return sendOrEditMessage(chatId, 'Выберите пользователя для удаления из списка администраторов', createCategoryOptions(buttonWithAdminsToDelete, { isCancel: true }))    
        default:
            return;
    }

} catch(e) {
    console.log(e)
}
});


const createAdminsListToDelete = (admins) => {

    const result = [];

    admins.forEach(({ username }) => {
        result.push(
            [
                {
                    text: `Удалить ${username}`,
                    callback_data: `${DELETE_ADMIN_UNIQ_PREFIX}${username}`,
                }
            ]
        )
    })

    return result;
}

const getAdmins = async () => {
    const result = [];

    try {
        const admins = await dbService.getAdmins();
        admins.forEach(row => result.push(row.username));
        
    } catch (error) {
        console.log(error)
        return [];
    }

    return result
}

const getChatsWithAdmins = async () => {
    const chats = [];

    try {

        const chatsFromDb = await dbService.getChatsWithAdmins();
        chatsFromDb.forEach(row => chats.push(row.chat_id));
        
    } catch (error) {
        console.log(error)
        return [];
    }

    return chats
}
