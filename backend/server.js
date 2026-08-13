const http = require('http');
require('dotenv/config');
const { port } = require('./lib/constants');
const { requestHandler } = require('./router');

const server = http.createServer(requestHandler);
server.listen(port, () => console.log(`COMPEX disponÃ­vel em http://localhost:${port}`));
