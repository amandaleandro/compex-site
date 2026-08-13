const fs = require('fs');
const { dataFile, initialData } = require('./constants');

function readData() {
  try { return { ...initialData, ...JSON.parse(fs.readFileSync(dataFile, 'utf8')) }; }
  catch { fs.writeFileSync(dataFile, JSON.stringify(initialData, null, 2), 'utf8'); return { ...initialData }; }
}
function writeData(data) { fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8'); }
function send(res, status, body, type = 'application/json; charset=utf-8') { res.writeHead(status, { 'Content-Type': type }); res.end(type.startsWith('application/json') ? JSON.stringify(body) : body); }
function body(req) { return new Promise((resolve, reject) => { let value = ''; req.on('data', chunk => value += chunk); req.on('end', () => { try { resolve(value ? JSON.parse(value) : {}); } catch (error) { reject(error); } }); }); }

module.exports = { readData, writeData, send, body };
