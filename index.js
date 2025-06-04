const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const userLocations = {};

app.post('/api/location', (req, res) => {
  const { name = 'Sin nombre', latitude, longitude, speed, timestamp } = req.body;
  const date = new Date(timestamp);

  userLocations[name] = {
    latitude,
    longitude,
    speed,
    timestamp: date.toISOString(),
  };

  console.log(`📍 Recibido de ${name}:`);
  console.log(`   Latitud: ${latitude}`);
  console.log(`   Longitud: ${longitude}`);
  console.log(`   Velocidad: ${speed} m/s`);
  console.log(`   Timestamp: ${isNaN(date) ? 'Fecha inválida' : date.toLocaleString()}`);
  console.log('--------------------------------');

  res.sendStatus(200);
});

app.get('/api/locations', (req, res) => {
  res.setHeader('Content-Type', 'application/json'); // Asegura que el navegador lo trate como JSON
  res.json(userLocations);
});

// 👇 Esta línea es clave para que funcione desde tu teléfono
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor escuchando en http://192.168.178.169:${PORT}`);
});
