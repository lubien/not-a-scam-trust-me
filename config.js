"use strict";

require("./lib/telemetry");

module.exports = {
    port: Number(process.env.PORT) || 8080,
    env: process.env.NODE_ENV || "development",
};
