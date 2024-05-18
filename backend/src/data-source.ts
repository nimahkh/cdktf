import "reflect-metadata"
import { DataSource } from "typeorm"
import { Greetings } from "./entity/Greetings"
import "dotenv/config"

export const AppDataSource = new DataSource({
    type: "mysql",
    host: process.env.DB_HOST,
    port: process.env.DB_PORT? parseInt(process.env.DB_PORT, 10) : 3306,
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    synchronize: true,
    logging: false,
    entities: [Greetings],
    migrations: [],
    subscribers: [],
})
