import "reflect-metadata"
import { DataSource } from "typeorm"
import { Greetings } from "./entity/Greetings"

export const AppDataSource = new DataSource({
    type: "mysql",
    host: "localhost",
    port: 3306,
    username: "root",
    password: "root",
    database: "test_back",
    synchronize: true,
    logging: false,
    entities: [Greetings],
    migrations: [],
    subscribers: [],
})
