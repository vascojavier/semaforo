const express = require('express');
const cors = require('cors');
const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Datos en memoria
const userLocations = {};  // { nombre: {latitude, longitude, speed, timestamp} }
let intersections = [];    // [{ id, latitude, longitude }]

// --- API para usuarios y posiciones ---

app.post('/api/location', (req, res) => {
  const { name = 'Sin nombre', latitude, longitude, speed, timestamp } = req.body;
  const date = new Date(timestamp);

  userLocations[name] = {
    latitude,
    longitude,
    speed,
    timestamp: date.toISOString(),
  };

  console.log(`📍 Recibido de ${name}: lat ${latitude}, lon ${longitude}, speed ${speed} m/s, tiempo ${date.toLocaleString()}`);
  res.json({ status: 'ok' });
});

app.get('/api/locations', (req, res) => {
  res.json(userLocations);
});

// --- CRUD de intersecciones ---

// Crear
app.post('/intersections', (req, res) => {
  const { latitude, longitude } = req.body;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return res.status(400).json({ error: 'Latitude y longitude requeridos y deben ser números' });
  }
  const id = Date.now().toString(); // id simple timestamp string
  const intersection = { id, latitude, longitude };
  intersections.push(intersection);
  console.log(`➕ Intersección creada: ${id}`);
  res.json(intersection);
});

// Leer todas
app.get('/intersections', (req, res) => {
  res.json(intersections);
});

// Borrar por id
app.delete('/intersections/:id', (req, res) => {
  const { id } = req.params;
  const beforeLength = intersections.length;
  intersections = intersections.filter(i => i.id !== id);
  if (intersections.length === beforeLength) {
    return res.status(404).json({ error: 'Intersección no encontrada' });
  }
  console.log(`🗑️ Intersección eliminada: ${id}`);
  res.json({ status: 'deleted' });
});

// --- Lógica semáforo: GET /semaphore/:name ---

// Parámetros configurables para proximidad (en metros)
const PROXIMITY_RADIUS = 50; // qué tan cerca debe estar el usuario de la intersección para considerarlo "en ella"

// Función para calcular distancia entre dos puntos GPS en metros (Haversine)
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => deg * Math.PI / 180;
  const R = 6371000; // Radio Tierra en metros
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Función para detectar si usuario está dentro de proximidad a una intersección
function isUserNearIntersection(userLoc, intersection) {
  const dist = getDistanceFromLatLonInMeters(userLoc.latitude, userLoc.longitude, intersection.latitude, intersection.longitude);
  return dist <= PROXIMITY_RADIUS;
}

// Aquí definimos una lógica simplificada:
//  - Si el usuario está cerca de alguna intersección,
//  - Si hay otro usuario cerca de la misma intersección con trayectoria "cruzada", da rojo,
//  - Sino da verde.

// Para la trayectoria cruzada, vamos a suponer que si dos usuarios están acercándose a la misma intersección pero desde direcciones que se cruzan, el semáforo cambia.

// Función auxiliar para obtener dirección del usuario hacia la intersección en grados
function getBearing(lat1, lon1, lat2, lon2) {
  const toRad = deg => deg * Math.PI / 180;
  const toDeg = rad => rad * 180 / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  let brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

// Función para determinar si dos trayectorias se cruzan aproximadamente (diferencia > 45° y < 135°)
function trajectoriesCross(bearing1, bearing2) {
  const diff = Math.abs(bearing1 - bearing2);
  return (diff > 45 && diff < 135) || (diff > 225 && diff < 315);
}

app.get('/semaphore/:name', (req, res) => {
  const { name } = req.params;
  const userLoc = userLocations[name];
  if (!userLoc) return res.status(404).json({ error: 'Usuario no encontrado o sin ubicación' });

  // Buscar intersección cercana
  const nearbyIntersections = intersections.filter(i => isUserNearIntersection(userLoc, i));
  if (nearbyIntersections.length === 0) {
    return res.json({ color: null }); // No está cerca de semáforo
  }

  // Por simplicidad, tomamos la primera intersección cercana
  const intersection = nearbyIntersections[0];

  // Obtener usuarios cerca de la misma intersección (excepto este usuario)
  const othersNearby = Object.entries(userLocations)
    .filter(([otherName, loc]) => otherName !== name && isUserNearIntersection(loc, intersection));

  // Si no hay nadie más, semáforo verde
  if (othersNearby.length === 0) {
    return res.json({ color: 'green' });
  }

  // Calculamos el rumbo (bearing) del usuario hacia la intersección
  const userBearing = getBearing(userLoc.latitude, userLoc.longitude, intersection.latitude, intersection.longitude);

  // Revisamos si algún otro usuario tiene trayectoria "cruzada"
  for (const [otherName, otherLoc] of othersNearby) {
    const otherBearing = getBearing(otherLoc.latitude, otherLoc.longitude, intersection.latitude, intersection.longitude);
    if (trajectoriesCross(userBearing, otherBearing)) {
      // Semáforo rojo si hay alguien cruzado
      return res.json({ color: 'red' });
    }
  }

  // Si ninguno cruza, semáforo verde
  return res.json({ color: 'green' });
});


// Inicio del servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor escuchando en puerto ${PORT}`);
});
