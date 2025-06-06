const express = require('express');
const cors = require('cors');
const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- Datos de usuarios ---
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

  res.json({ status: 'ok' });
});

app.get('/api/locations', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(userLocations);
});

// --- Rutas para manejar intersecciones ---

// Almacenamos intersecciones aquí:
let intersections = [];
let idCounter = 1;

// Crear una intersección (semáforo)
app.post('/intersections', (req, res) => {
  const { latitude, longitude } = req.body;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return res.status(400).json({ error: 'Faltan latitud o longitud válidas' });
  }

  const newIntersection = {
    id: idCounter++,
    latitude,
    longitude,
    createdAt: Date.now(),
  };
  intersections.push(newIntersection);
  res.json(newIntersection);
});

// Obtener todas las intersecciones activas
app.get('/intersections', (req, res) => {
  res.json(intersections);
});

// Eliminar una intersección por id
app.delete('/intersections/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  intersections = intersections.filter((i) => i.id !== id);
  res.json({ ok: true });
});

// --- Ruta test para login ---
app.get('/login', (req, res) => {
  res.json({ status: 'ok', message: 'Login OK - servidor activo' });
});

// Escucha en todas las interfaces para funcionar bien en Heroku y local
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor escuchando en el puerto ${PORT}`);
});
