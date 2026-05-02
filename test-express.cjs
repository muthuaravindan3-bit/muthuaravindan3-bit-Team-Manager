const express = require('express');
const app = express();
try {
  app.get('*', (req, res) => res.send('ok'));
  console.log("Success with *");
} catch(e) {
  console.error("Error with *:", e.message);
}
