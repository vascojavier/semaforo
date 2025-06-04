const express = require('express');
const app = express();

app.use(express.json());

app.get('/api/location', (req, res) => {
  res.json({ message: 'Servidor funcionando!' });
});

app.listen(3000, () => console.log('Servidor corriendo en puerto 3000'));