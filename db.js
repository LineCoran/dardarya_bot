import * as dotenv from 'dotenv';
import pg from 'pg';
const { Pool } = pg;

dotenv.config();

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL + "?sslmode=require",
})

const CHAT_SESSION_TABLE = `
    CREATE TABLE IF NOT EXISTS user_sessions (
        chat_id BIGINT PRIMARY KEY,
        is_create_order_process BOOLEAN DEFAULT FALSE,
        last_message_id BIGINT DEFAULT NULL,
        is_send_photo BOOLEAN DEFAULT FALSE,
        is_admin BOOLEAN DEFAULT FALSE,
        second_name VARCHAR(32),
        first_name VARCHAR(32),
        is_owner BOOLEAN DEFAULT FALSE,
        is_set_admin_process BOOLEAN DEFAULT FALSE,
        timestamp timestamp default current_timestamp,
        username VARCHAR(32)
    );
`

// const CHAT_SESSION_TABLE = `
//     DROP TABLE user_sessions
// `

const ADMINS = `
    CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(32) UNIQUE NOT NULL
    );
`

const CHAT_WITH_ADMINS = `
    CREATE TABLE IF NOT EXISTS admins_chats (
        id SERIAL PRIMARY KEY,
        admin_username VARCHAR(32) UNIQUE,
        chat_id BIGINT NOT NULL
    );
`

const MESSAGE_LOGS = `
    CREATE TABLE IF NOT EXISTS message_logs (
        id SERIAL PRIMARY KEY,
        chat_id BIGINT NOT NULL,
        username VARCHAR(32) DEFAULT NULL,
        message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
    );
`

const ALL_TABLES = [
    CHAT_SESSION_TABLE,
    ADMINS,
    MESSAGE_LOGS,
    CHAT_WITH_ADMINS
];

let successFully = 0;

pool.connect((err) => {
    if (err) throw err

    const createTable = (sqlText) => {
        pool.query(sqlText, (err, data) => {
            if (err) {
                console.log(err)
                return
            }
            successFully += 1;
            console.log(`Tables created: ${successFully} / ${ALL_TABLES.length} success!`)
        })
    }

    ALL_TABLES.forEach(tableText => createTable(tableText))
})

export default pool