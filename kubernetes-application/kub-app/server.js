'use strict';

const express = require('express');

// Constants
const PORT = 8080;
const HOST = '0.0.0.0';

const HELLOWORLDTEXT = process.env.HELLO_WORLD_TEXT || "No hello world text found. WTH"

// App
const app = express();
app.get('/', (req, res) => {
  res.send('Hello World '+HELLOWORLDTEXT);
});

app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);