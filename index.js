const express = require('express');
const cors = require('cors');
const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const userLocations = {};  // { nombre: {latitude, longitude, speed, timestamp} }
let intersections = [];    // [{ id, latitude, longitude }]

// --- API para usuarios y posiciones ---

app.post('/api/location', (req, res) => {
  const { name = 'Sin nombre', latitude, longitude, speed } = req.body;
  const timestamp = Date.now(); // ⏱️ Timestamp real
  userLocations[name] = {
    latitude,
    longitude,
    speed,
    timestamp,
  };
  console.log(`📍 Recibido de ${name}: lat ${latitude}, lon ${longitude}, speed ${speed} m/s, tiempo ${new Date(timestamp).toLocaleString()}`);
  res.json({ status: 'ok' });
});

app.get('/api/locations', (req, res) => {
  res.json(userLocations);
});

// ✅ Nueva ruta para borrar usuario manualmente (ej. al cerrar sesión)
app.delete('/api/location/:name', (req, res) => {
  const { name } = req.params;
  if (userLocations[name]) {
    delete userLocations[name];
    console.log(`🗑️ Usuario eliminado: ${name}`);
    return res.json({ status: 'deleted' });
  } else {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }
});

// --- Limpieza automática cada 30 segundos de usuarios inactivos (> 60s sin actualizar) ---
setInterval(() => {
  const now = Date.now();
  const INACTIVITY_LIMIT = 60 * 1000; // 60 segundos
  for (const [name, data] of Object.entries(userLocations)) {
    if (now - data.timestamp > INACTIVITY_LIMIT) {
      console.log(`⏳ Usuario inactivo eliminado: ${name}`);
      delete userLocations[name];
    }
  }
}, 30000);

// --- CRUD de intersecciones ---

app.post('/intersections', (req, res) => {
  const { latitude, longitude } = req.body;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return res.status(400).json({ error: 'Latitude y longitude requeridos y deben ser números' });
  }
  const id = Date.now().toString();
  const intersection = { id, latitude, longitude };
  intersections.push(intersection);
  console.log(`➕ Intersección creada: ${id}`);
  res.json(intersection);
});

app.get('/intersections', (req, res) => {
  res.json(intersections);
});

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

// --- Lógica semáforo ---

const PROXIMITY_RADIUS = 50;

function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => deg * Math.PI / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function isUserNearIntersection(userLoc, intersection) {
  const dist = getDistanceFromLatLonInMeters(userLoc.latitude, userLoc.longitude, intersection.latitude, intersection.longitude);
  return dist <= PROXIMITY_RADIUS;
}

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

function trajectoriesCross(bearing1, bearing2) {
  const diff = Math.abs(bearing1 - bearing2);
  return (diff > 45 && diff < 135) || (diff > 225 && diff < 315);
}

app.get('/semaphore/:name', (req, res) => {
  const { name } = req.params;
  const userLoc = userLocations[name];
  if (!userLoc) return res.status(404).json({ error: 'Usuario no encontrado o sin ubicación' });

  const nearbyIntersections = intersections.filter(i => isUserNearIntersection(userLoc, i));
  if (nearbyIntersections.length === 0) {
    return res.json({ color: null });
  }

  const intersection = nearbyIntersections[0];
  const othersNearby = Object.entries(userLocations)
    .filter(([otherName, loc]) => otherName !== name && isUserNearIntersection(loc, intersection));

  if (othersNearby.length === 0) {
    return res.json({ color: 'green' });
  }

  const userBearing = getBearing(userLoc.latitude, userLoc.longitude, intersection.latitude, intersection.longitude);

  for (const [, otherLoc] of othersNearby) {
    const otherBearing = getBearing(otherLoc.latitude, otherLoc.longitude, intersection.latitude, intersection.longitude);
    if (trajectoriesCross(userBearing, otherBearing)) {
      return res.json({ color: 'red' });
    }
  }

  return res.json({ color: 'green' });
});

// --- Consulta conjunta de semáforos y usuarios ---

app.get('/semaphores', (req, res) => {
  const results = {};
  for (const [name, loc] of Object.entries(userLocations)) {
    const nearbyIntersections = intersections.filter(i => isUserNearIntersection(loc, i));
    if (nearbyIntersections.length === 0) {
      results[name] = { color: null };
      continue;
    }
    const intersection = nearbyIntersections[0];
    const othersNearby = Object.entries(userLocations)
      .filter(([otherName, otherLoc]) => otherName !== name && isUserNearIntersection(otherLoc, intersection));
    
    if (othersNearby.length === 0) {
      results[name] = { color: 'green' };
      continue;
    }

    const userBearing = getBearing(loc.latitude, loc.longitude, intersection.latitude, intersection.longitude);
    let color = 'green';
    for (const [, otherLoc] of othersNearby) {
      const otherBearing = getBearing(otherLoc.latitude, otherLoc.longitude, intersection.latitude, intersection.longitude);
      if (trajectoriesCross(userBearing, otherBearing)) {
        color = 'red';
        break;
      }
    }
    results[name] = { color };
  }
  res.json(results);
});

app.delete('/api/location/:name', (req, res) => {
  const { name } = req.params;
  if (userLocations[name]) {
    delete userLocations[name];
    console.log(`🧹 Usuario eliminado del mapa: ${name}`);
    return res.json({ status: 'deleted' });
  } else {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }
});


// --- Inicio del servidor ---

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor escuchando en puerto ${PORT}`);
});
