import 'dotenv/config';
import type { FastifyInstance } from 'fastify';
import type { Server } from 'http';

import * as app from './app/server'

let server: FastifyInstance<Server> = app.fastifyInstance;

process.on('unhandledRejection', (error: any) => {
  console.error(
    'unhandledRejection',
    {
      error: String(error),
      message: error?.message,
      stack: error?.stack,
    },
  );
})
const PORT = process.env.PORT ?? '3000'
const HOST = process.env.HOST ?? '0.0.0.0';

server.listen(PORT, HOST).catch(console.error);

console.info(`🌏 Server listening the port ${PORT}`);

if (module.hot) {
  console.info('✅  Server-side HMR Enabled!');
  module.hot.accept('./app/server', () => {
    console.info('🔁  HMR Reloading `./app/server`...');

    try {
      server.close(() => {
        server = require('./app/server').fastifyInstance;
        server.listen(PORT, HOST).catch(console.error);
      });
    } catch (error) {
      console.error(error as any);
    }
  });
}
