# 🌌 Astra-Logica  — Space Event Tracking System

A full-stack database-driven application for storing, managing, and visualising astronomical events.

## 🗂 Project Structure

```
space_tracker/
├── backend/
│   ├── app.py          ← Flask REST API (all endpoints)
│   └── astronomy.db    ← SQLite database (pre-seeded, 3,180 events)
├── data/
│   ├── solar.csv       ← 500 solar eclipse records
│   ├── lunar.csv       ← 500 lunar eclipse records
│   ├── meteorite.csv   ← 2,000 meteorite impact records
│   ├── comets.csv      ← 160 comet approach records
│   └── conjunctions.csv← 20 planetary conjunction records
├── frontend/
│   ├── index.html
│   └── static/
│       ├── css/style.css
│       └── js/main.js
├── schema.sql          ← MySQL DDL reference schema
├── requirements.txt
└── README.md
```

## ⚡ Quick Start

```bash
pip install flask flask-cors
cd backend
python app.py          # http://localhost:5000
```
Then open http://localhost:5000 in your browser.

## 🌐 API Reference

### Events
- GET/POST  /api/events
- GET/PUT/DELETE  /api/events/<id>

### Specialised
- GET  /api/eclipses          (filter: ?type=Solar|Lunar)
- GET  /api/comets
- GET  /api/conjunctions
- GET  /api/meteorites        (search, pagination)
- GET  /api/meteorites/map

### Admin (NEW)
- POST  /api/admin/eclipse      — creates Event + Eclipse row
- POST  /api/admin/meteorite    — creates Event + Meteorite row
- POST  /api/admin/conjunction  — creates Event + Conjunction row
- POST  /api/admin/comet        — creates Event + Comet_Approach row

### Visibility (NEW)
- GET/POST  /api/visibility
- PUT/DELETE  /api/visibility/<event_id>/<location_id>
- GET  /api/visibility/stats

### Other
- GET  /api/event-types, POST, PUT/<id>, DELETE/<id>
- GET  /api/observations, POST, PUT/<id>, DELETE/<id>
- GET  /api/locations, POST, PUT/<id>, DELETE/<id>
- GET  /api/stats
- GET  /api/search?q=

## ✅ Requirements Checklist

| Requirement                        | Status |
|------------------------------------|--------|
| Normalised relational DB schema    | ✅     |
| All 9 tables implemented           | ✅     |
| 3,180 real-world records seeded    | ✅     |
| CRUD for Events                    | ✅     |
| CRUD for Event Types               | ✅     |
| CRUD for Observations              | ✅     |
| CRUD for Locations                 | ✅     |
| CRUD for Visibility                | ✅ NEW |
| Filter / search / pagination       | ✅     |
| Dashboard with Chart.js charts     | ✅     |
| Location-based visibility tracking | ✅     |
| Map visualisation                  | ✅     |
| Admin Panel with quick-add forms   | ✅ NEW |
| Referential integrity & cascades   | ✅     |
| Global search                      | ✅     |
