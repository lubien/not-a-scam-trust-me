const http = require('http');

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  const body = JSON.stringify({
    status: 'ok',
    message: 'Hello, World!',
    path: req.url,
    timestamp: new Date().toISOString(),
  });

  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });

  res.end(body);
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
