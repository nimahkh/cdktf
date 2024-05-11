import { Entity, PrimaryGeneratedColumn, Column } from "typeorm"

@Entity()
export class Greetings {

    @PrimaryGeneratedColumn()
    id!: number

    @Column()
    name!: string
}
