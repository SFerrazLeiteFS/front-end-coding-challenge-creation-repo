import { createServer } from 'node:http';
import { configFromEnv } from './config.ts';
import { createMockServer } from './server.ts';

const mock = createMockServer({ config: configFromEnv() });
const { port, chaos, seed } = mock.config;

createServer(mock.requestListener).listen(port, () => {
  console.log(`Mock server running at http://localhost:${port}/graphql (seed ${seed}, chaos ${chaos ? 'on' : 'off'})`);
});
