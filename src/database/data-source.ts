import { DataSource } from 'typeorm';
import { validateEnvironment } from '../config/env.validation';

const config = validateEnvironment(process.env);

export default new DataSource({
  type: 'postgres',
  host: config.DB_HOST as string,
  port: config.DB_PORT as number,
  username: config.DB_USERNAME as string,
  password: config.DB_PASSWORD as string,
  database: config.DB_NAME as string,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});
