import { MigrationInterface, QueryRunner } from "typeorm";

export class AddGreetingTable1715091533394 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      CREATE TABLE greetings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100)
      );
    `);

        await queryRunner.query(`
      INSERT INTO greetings (name) VALUES ('John Doe');
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE greetings`);
    }

}
