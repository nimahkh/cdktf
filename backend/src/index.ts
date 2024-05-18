import type { Express, Request, Response } from "express";
import express from 'express';
// import { AppDataSource } from "./data-source";
// import { Greetings } from "./entity/Greetings";
import cors from 'cors';

const app: Express = express();
const port = process.env.PORT || 5001;
const whitelist = ['http://localhost:5173']; 

// AppDataSource.initialize()
//     .then(async () => {
        app.use(cors({
            origin: function (origin, callback) {
                if (!origin || whitelist.indexOf(origin) !== -1) {
                    callback(null, true);
                } else {
                    callback(new Error('Not allowed by CORSSSS'));
                }
            },
            credentials: true  // reflecting the requested withCredentials
        }));

        app.get("/hello", async (_: Request, res: Response) => {
            try {
                // const greetingRepo = AppDataSource.getRepository(Greetings);
                // const greeting = await greetingRepo.findOne({ where: { id: 1 } });
                // console.log(greeting)
                // if (greeting) {
                //     res.send(`Hello, ${greeting.name}`);
                // } else {
                    res.status(200).send("Hello everyone");
                // }
            } catch (err) {
                res.status(500).send("Error retrieving greeting");
            }
        });

        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
        
    // })
    // .catch((error) => console.log("Error: ", error));
