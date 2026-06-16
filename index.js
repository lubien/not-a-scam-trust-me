"use strict";

const http = require("http");
const config = require("./config");

const server = http.createServer((req, res) => {
    const body = JSON.stringify({
        status: "ok",
        message: "Hello, World!",
        path: req.url,
        timestamp: new Date().toISOString(),
    });

    res.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
    });

    res.end(body);
});

server.listen(config.port, () => {
    console.log(`Server listening on http://localhost:${config.port}`);
});
