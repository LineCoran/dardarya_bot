import pool from "./db.js";

const initializeChatSession = () => ({
    is_create_order_process: false,
    last_messageId: null,
    is_send_photo: false,
    is_admin: false,
    is_set_admin_process: false,
    first_name: '',
    second_name: '',
});

export const dbService = {

    getSessions: async () => {
        const res = await pool.query('SELECT * FROM user_sessions');
        return res.rows;
    },

    getUserSession: async (chatId) => {
        const res = await pool.query('SELECT * FROM user_sessions WHERE chat_id = $1', [chatId]);

        if (!res.rows[0]) {
            const newSession = initializeChatSession()
            dbService.saveUserSession(chatId, newSession);
            return newSession;
        }
        return res.rows[0];
    },

    saveUserSession: async (chatId, session) => {
        console.log(session)
        await pool.query(
          `INSERT INTO user_sessions (chat_id, is_create_order_process, last_message_id, is_send_photo, is_admin, is_set_admin_process, first_name, second_name)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (chat_id) 
           DO UPDATE SET 
             is_create_order_process = $2,
             last_message_id = $3,
             is_send_photo = $4,
             is_admin = $5,
             is_set_admin_process = $6,
             first_name = $7,
             second_name = $8
             `,
          [
            chatId,
            session.is_create_order_process,
            session.last_message_id,
            session.is_send_photo,
            session.is_admin,
            session.is_set_admin_process,
            session.first_name,
            session.second_name,
        ]
        );
      },

    addAdmin: async (username) => {
        await pool.query('INSERT INTO admins (username) VALUES ($1) ON CONFLICT DO NOTHING', [username]);
    },

    deleteAdmin: async (username) => {
        await pool.query('DELETE FROM admins WHERE username = $1;', [username]);
    },

    addChatWithAdmin: async (admin_username, chat_id) => {
        await pool.query('INSERT INTO admins_chats (admin_username, chat_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [admin_username, chat_id]);
    },

    getAdmins: async() => {
        const res = await pool.query('SELECT * FROM admins');
        return res.rows
    },

    getChatsWithAdmins: async() => {
        const res = await pool.query('SELECT * FROM admins_chats');
        return res.rows
    },


    saveMesageLog: async (msg) => {
        const chatId = msg.chat.id;
        const username = msg.chat.username || null;
        const text = msg.text;          
        await pool.query(
            'INSERT INTO message_logs (chat_id, username, message) VALUES ($1, $2, $3)',
            [chatId, username, text]
        );
    }
}