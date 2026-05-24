"""
app.py  –  Astronomy Event Tracker Backend (Flask + SQLite)
Hidden Developer: 24cs019
Run: python app.py
"""

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import sqlite3
from pathlib import Path
import json

app = Flask(__name__, static_folder="../frontend", static_url_path="")
CORS(app)
app.config["HIDDEN_DEVELOPER"] = "24cs019"  # Hidden Developer: 24cs019

DB_PATH = Path(__file__).parent / "astronomy.db"


def get_db():
    db = sqlite3.connect(str(DB_PATH))
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    return db


def rows_to_list(rows):
    return [dict(r) for r in rows]


# ── Serve frontend ────────────────────────────────────────────
@app.route("/")
def index():
    return send_from_directory("../frontend", "index.html")


# ── Dashboard Stats ───────────────────────────────────────────
@app.route("/api/stats")
def stats():
    db = get_db()
    stats = {}
    type_counts = db.execute("""
        SELECT et.type_name, COUNT(e.event_id) as count
        FROM Event_Type et
        LEFT JOIN Event e ON e.type_id = et.type_id
        GROUP BY et.type_id
    """).fetchall()
    stats["by_type"] = rows_to_list(type_counts)
    stats["total"] = sum(r["count"] for r in type_counts)

    # Meteorite mass stats
    mass = db.execute("""
        SELECT AVG(mass_g) as avg_mass, MAX(mass_g) as max_mass, MIN(mass_g) as min_mass
        FROM Meteorite WHERE mass_g IS NOT NULL
    """).fetchone()
    stats["meteorite_mass"] = dict(mass) if mass else {}

    # Eclipse magnitude stats
    mag = db.execute("""
        SELECT AVG(magnitude) as avg_mag, MAX(magnitude) as max_mag
        FROM Eclipse WHERE magnitude IS NOT NULL
    """).fetchone()
    stats["eclipse_magnitude"] = dict(mag) if mag else {}

    # Events by decade
    decades = db.execute("""
        SELECT (CAST(substr(event_date,1,4) AS INTEGER)/10)*10 as decade, COUNT(*) as count
        FROM Event
        WHERE event_date IS NOT NULL AND event_date != ''
          AND CAST(substr(event_date,1,4) AS INTEGER) > 1000
        GROUP BY decade ORDER BY decade
    """).fetchall()
    stats["by_decade"] = rows_to_list(decades)

    db.close()
    return jsonify(stats)


# ── Events list with pagination & filter ─────────────────────
@app.route("/api/events")
def events():
    db = get_db()
    type_filter = request.args.get("type", "")
    search      = request.args.get("search", "")
    page        = max(1, int(request.args.get("page", 1)))
    per_page    = min(50, int(request.args.get("per_page", 20)))
    offset      = (page - 1) * per_page

    conditions = []
    params = []

    if type_filter:
        conditions.append("et.type_name = ?")
        params.append(type_filter)
    if search:
        conditions.append("e.event_name LIKE ?")
        params.append(f"%{search}%")

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    total = db.execute(f"""
        SELECT COUNT(*) as cnt FROM Event e
        JOIN Event_Type et ON e.type_id = et.type_id {where}
    """, params).fetchone()["cnt"]

    rows = db.execute(f"""
        SELECT e.event_id, e.event_name, e.event_date, et.type_name,
               ec.magnitude, ec.eclipse_type, ec.gamma,
               m.mass_g, m.latitude as met_lat, m.longitude as met_lon,
               p.planet1, p.planet2, p.separation_angle,
               ca.perihelion_dist_au, ca.period_years
        FROM Event e
        JOIN Event_Type et ON e.type_id = et.type_id
        LEFT JOIN Eclipse ec ON e.event_id = ec.event_id
        LEFT JOIN Meteorite m ON e.event_id = m.event_id
        LEFT JOIN Planetary_Conjunction p ON e.event_id = p.event_id
        LEFT JOIN Comet_Approach ca ON e.event_id = ca.event_id
        {where}
        ORDER BY e.event_date DESC NULLS LAST
        LIMIT ? OFFSET ?
    """, params + [per_page, offset]).fetchall()

    db.close()
    return jsonify({
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
        "events": rows_to_list(rows)
    })


# ── Single event ──────────────────────────────────────────────
@app.route("/api/events/<int:event_id>")
def event_detail(event_id):
    db = get_db()
    row = db.execute("""
        SELECT e.*, et.type_name,
               ec.magnitude, ec.eclipse_type, ec.gamma, ec.eclipse_time, ec.latitude as ec_lat, ec.longitude as ec_lon,
               m.name as met_name, m.mass_g, m.year as met_year, m.latitude as met_lat, m.longitude as met_lon,
               p.planet1, p.planet2, p.separation_angle, p.event_time as conj_time,
               ca.perihelion_dist_au, ca.aphelion_dist_au, ca.period_years
        FROM Event e
        JOIN Event_Type et ON e.type_id = et.type_id
        LEFT JOIN Eclipse ec ON e.event_id = ec.event_id
        LEFT JOIN Meteorite m ON e.event_id = m.event_id
        LEFT JOIN Planetary_Conjunction p ON e.event_id = p.event_id
        LEFT JOIN Comet_Approach ca ON e.event_id = ca.event_id
        WHERE e.event_id = ?
    """, (event_id,)).fetchone()

    obs = db.execute("""
        SELECT * FROM Observation_Record WHERE event_id = ? ORDER BY observation_date DESC
    """, (event_id,)).fetchall()

    db.close()
    if not row:
        return jsonify({"error": "Not found"}), 404

    result = dict(row)
    result["observations"] = rows_to_list(obs)
    return jsonify(result)


# ── Create Event ──────────────────────────────────────────────
@app.route("/api/events", methods=["POST"])
def create_event():
    data = request.get_json()
    if not data or not data.get("event_name"):
        return jsonify({"error": "event_name is required"}), 400
    db = get_db()
    # Validate type_id if provided
    type_id = data.get("type_id")
    if type_id:
        t = db.execute("SELECT type_id FROM Event_Type WHERE type_id=?", (type_id,)).fetchone()
        if not t:
            db.close()
            return jsonify({"error": "Invalid type_id"}), 400
    cur = db.execute(
        "INSERT INTO Event(event_name, event_date, type_id, description) VALUES(?,?,?,?)",
        (data["event_name"], data.get("event_date"), type_id, data.get("description", ""))
    )
    db.commit()
    eid = cur.lastrowid
    db.close()
    return jsonify({"event_id": eid, "message": "Event created"}), 201


# ── Update Event ──────────────────────────────────────────────
@app.route("/api/events/<int:event_id>", methods=["PUT"])
def update_event(event_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    db = get_db()
    ev = db.execute("SELECT * FROM Event WHERE event_id=?", (event_id,)).fetchone()
    if not ev:
        db.close()
        return jsonify({"error": "Event not found"}), 404
    db.execute(
        "UPDATE Event SET event_name=?, event_date=?, type_id=?, description=? WHERE event_id=?",
        (
            data.get("event_name", ev["event_name"]),
            data.get("event_date", ev["event_date"]),
            data.get("type_id", ev["type_id"]),
            data.get("description", ev["description"]),
            event_id
        )
    )
    db.commit()
    db.close()
    return jsonify({"message": "Event updated"})


# ── Delete Event ──────────────────────────────────────────────
@app.route("/api/events/<int:event_id>", methods=["DELETE"])
def delete_event(event_id):
    db = get_db()
    ev = db.execute("SELECT event_id FROM Event WHERE event_id=?", (event_id,)).fetchone()
    if not ev:
        db.close()
        return jsonify({"error": "Event not found"}), 404
    # Cascade: delete from child tables
    for table in ["Eclipse", "Meteorite", "Planetary_Conjunction", "Comet_Approach",
                  "Observation_Record", "Visibility"]:
        db.execute(f"DELETE FROM {table} WHERE event_id=?", (event_id,))
    db.execute("DELETE FROM Event WHERE event_id=?", (event_id,))
    db.commit()
    db.close()
    return jsonify({"message": "Event deleted"})


# ── Meteorites (for map) ──────────────────────────────────────
@app.route("/api/meteorites/map")
def meteorites_map():
    db = get_db()
    limit = min(500, int(request.args.get("limit", 200)))
    rows = db.execute("""
        SELECT m.name, m.mass_g, m.year, m.latitude, m.longitude
        FROM Meteorite m
        WHERE m.latitude IS NOT NULL AND m.latitude != ''
          AND m.longitude IS NOT NULL AND m.longitude != ''
        LIMIT ?
    """, (limit,)).fetchall()
    db.close()
    return jsonify(rows_to_list(rows))


# ── Eclipses ──────────────────────────────────────────────────
@app.route("/api/eclipses")
def eclipses():
    db = get_db()
    etype = request.args.get("type", "")  # Solar or Lunar
    page = max(1, int(request.args.get("page", 1)))
    per_page = 30
    offset = (page - 1) * per_page

    cond = ""
    params = []
    if etype:
        cond = "WHERE e.event_name = ?"
        params.append(f"{etype} Eclipse")

    total = db.execute(f"SELECT COUNT(*) as c FROM Event e {cond}", params).fetchone()["c"]
    rows = db.execute(f"""
        SELECT e.event_id, e.event_name, e.event_date,
               ec.eclipse_type, ec.magnitude, ec.gamma, ec.eclipse_time, ec.latitude, ec.longitude
        FROM Event e JOIN Eclipse ec ON e.event_id = ec.event_id
        {cond}
        ORDER BY e.event_date DESC NULLS LAST LIMIT ? OFFSET ?
    """, params + [per_page, offset]).fetchall()
    db.close()
    return jsonify({"total": total, "page": page, "pages": (total+per_page-1)//per_page, "data": rows_to_list(rows)})


# ── Comets ────────────────────────────────────────────────────
@app.route("/api/comets")
def comets():
    db = get_db()
    rows = db.execute("""
        SELECT e.event_id, e.event_name, e.event_date,
               ca.perihelion_dist_au, ca.aphelion_dist_au, ca.period_years
        FROM Event e JOIN Comet_Approach ca ON e.event_id = ca.event_id
        ORDER BY ca.perihelion_dist_au ASC
    """).fetchall()
    db.close()
    return jsonify(rows_to_list(rows))


# ── Conjunctions ──────────────────────────────────────────────
@app.route("/api/conjunctions")
def conjunctions():
    db = get_db()
    rows = db.execute("""
        SELECT e.event_id, e.event_name, e.event_date,
               p.planet1, p.planet2, p.separation_angle, p.event_time
        FROM Event e JOIN Planetary_Conjunction p ON e.event_id = p.event_id
        ORDER BY e.event_date DESC
    """).fetchall()
    db.close()
    return jsonify(rows_to_list(rows))


# ── Observations CRUD ─────────────────────────────────────────
@app.route("/api/observations", methods=["GET"])
def get_observations():
    db = get_db()
    rows = db.execute("""
        SELECT o.*, e.event_name FROM Observation_Record o
        JOIN Event e ON o.event_id = e.event_id
        ORDER BY o.observation_date DESC LIMIT 50
    """).fetchall()
    db.close()
    return jsonify(rows_to_list(rows))


@app.route("/api/observations", methods=["POST"])
def add_observation():
    data = request.get_json()
    required = ["event_id", "observer_name", "observation_date"]
    if not all(k in data for k in required):
        return jsonify({"error": "Missing fields"}), 400
    db = get_db()
    # Verify event exists
    ev = db.execute("SELECT event_id FROM Event WHERE event_id=?", (data["event_id"],)).fetchone()
    if not ev:
        db.close()
        return jsonify({"error": "Event not found"}), 404
    cur = db.execute("""
        INSERT INTO Observation_Record(event_id, observer_name, observation_date, notes)
        VALUES(?,?,?,?)
    """, (data["event_id"], data["observer_name"], data["observation_date"], data.get("notes","")))
    db.commit()
    oid = cur.lastrowid
    db.close()
    return jsonify({"observation_id": oid, "message": "Observation recorded"}), 201


@app.route("/api/observations/<int:obs_id>", methods=["PUT"])
def update_observation(obs_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    db = get_db()
    obs = db.execute("SELECT * FROM Observation_Record WHERE observation_id=?", (obs_id,)).fetchone()
    if not obs:
        db.close()
        return jsonify({"error": "Observation not found"}), 404
    db.execute(
        "UPDATE Observation_Record SET event_id=?, observer_name=?, observation_date=?, notes=? WHERE observation_id=?",
        (
            data.get("event_id", obs["event_id"]),
            data.get("observer_name", obs["observer_name"]),
            data.get("observation_date", obs["observation_date"]),
            data.get("notes", obs["notes"]),
            obs_id
        )
    )
    db.commit()
    db.close()
    return jsonify({"message": "Observation updated"})


@app.route("/api/observations/<int:obs_id>", methods=["DELETE"])
def delete_observation(obs_id):
    db = get_db()
    db.execute("DELETE FROM Observation_Record WHERE observation_id=?", (obs_id,))
    db.commit()
    db.close()
    return jsonify({"message": "Deleted"})


# ── Locations ─────────────────────────────────────────────────
@app.route("/api/locations")
def locations():
    db = get_db()
    rows = db.execute("SELECT * FROM Location ORDER BY country").fetchall()
    db.close()
    return jsonify(rows_to_list(rows))


@app.route("/api/locations", methods=["POST"])
def create_location():
    data = request.get_json()
    if not data or not data.get("country") or not data.get("city"):
        return jsonify({"error": "country and city are required"}), 400
    db = get_db()
    cur = db.execute(
        "INSERT INTO Location(country, city, latitude, longitude) VALUES(?,?,?,?)",
        (data["country"], data["city"], data.get("latitude"), data.get("longitude"))
    )
    db.commit()
    lid = cur.lastrowid
    db.close()
    return jsonify({"location_id": lid, "message": "Location created"}), 201


@app.route("/api/locations/<int:loc_id>", methods=["PUT"])
def update_location(loc_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    db = get_db()
    loc = db.execute("SELECT * FROM Location WHERE location_id=?", (loc_id,)).fetchone()
    if not loc:
        db.close()
        return jsonify({"error": "Location not found"}), 404
    db.execute(
        "UPDATE Location SET country=?, city=?, latitude=?, longitude=? WHERE location_id=?",
        (
            data.get("country", loc["country"]),
            data.get("city", loc["city"]),
            data.get("latitude", loc["latitude"]),
            data.get("longitude", loc["longitude"]),
            loc_id
        )
    )
    db.commit()
    db.close()
    return jsonify({"message": "Location updated"})


@app.route("/api/locations/<int:loc_id>", methods=["DELETE"])
def delete_location(loc_id):
    db = get_db()
    loc = db.execute("SELECT location_id FROM Location WHERE location_id=?", (loc_id,)).fetchone()
    if not loc:
        db.close()
        return jsonify({"error": "Location not found"}), 404
    db.execute("DELETE FROM Visibility WHERE location_id=?", (loc_id,))
    db.execute("DELETE FROM Location WHERE location_id=?", (loc_id,))
    db.commit()
    db.close()
    return jsonify({"message": "Location deleted"})


# ── Event Types CRUD ──────────────────────────────────────────
@app.route("/api/event-types")
def event_types():
    db = get_db()
    rows = db.execute("SELECT * FROM Event_Type ORDER BY type_id").fetchall()
    db.close()
    return jsonify(rows_to_list(rows))


@app.route("/api/event-types", methods=["POST"])
def create_event_type():
    data = request.get_json()
    if not data or not data.get("type_name"):
        return jsonify({"error": "type_name is required"}), 400
    db = get_db()
    try:
        cur = db.execute(
            "INSERT INTO Event_Type(type_name, description) VALUES(?,?)",
            (data["type_name"], data.get("description", ""))
        )
        db.commit()
        tid = cur.lastrowid
    except Exception as e:
        db.close()
        return jsonify({"error": str(e)}), 400
    db.close()
    return jsonify({"type_id": tid, "message": "Event type created"}), 201


@app.route("/api/event-types/<int:type_id>", methods=["PUT"])
def update_event_type(type_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    db = get_db()
    t = db.execute("SELECT * FROM Event_Type WHERE type_id=?", (type_id,)).fetchone()
    if not t:
        db.close()
        return jsonify({"error": "Event type not found"}), 404
    db.execute(
        "UPDATE Event_Type SET type_name=?, description=? WHERE type_id=?",
        (data.get("type_name", t["type_name"]), data.get("description", t["description"]), type_id)
    )
    db.commit()
    db.close()
    return jsonify({"message": "Event type updated"})


@app.route("/api/event-types/<int:type_id>", methods=["DELETE"])
def delete_event_type(type_id):
    db = get_db()
    t = db.execute("SELECT type_id FROM Event_Type WHERE type_id=?", (type_id,)).fetchone()
    if not t:
        db.close()
        return jsonify({"error": "Event type not found"}), 404
    # Set events with this type to NULL
    db.execute("UPDATE Event SET type_id=NULL WHERE type_id=?", (type_id,))
    db.execute("DELETE FROM Event_Type WHERE type_id=?", (type_id,))
    db.commit()
    db.close()
    return jsonify({"message": "Event type deleted"})


# ── Search ────────────────────────────────────────────────────
@app.route("/api/search")
def search():
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify([])
    db = get_db()
    rows = db.execute("""
        SELECT e.event_id, e.event_name, e.event_date, et.type_name
        FROM Event e JOIN Event_Type et ON e.type_id = et.type_id
        WHERE e.event_name LIKE ?
        ORDER BY e.event_date DESC LIMIT 20
    """, (f"%{q}%",)).fetchall()
    db.close()
    return jsonify(rows_to_list(rows))


# ── Hidden Developer Credit ──────────────────────────────────
@app.route("/api/credits")
def hidden_credits():
    return jsonify({"hidden_developer": "24cs019", "role": "Hidden Developer"})


if __name__ == "__main__":
    # Hidden Developer: 24cs019
    app.run(debug=True, port=5000)


# ── Visibility CRUD ───────────────────────────────────────────
@app.route("/api/visibility")
def get_visibility():
    db = get_db()
    event_id = request.args.get("event_id")
    location_id = request.args.get("location_id")
    conditions, params = [], []
    if event_id:
        conditions.append("v.event_id = ?")
        params.append(event_id)
    if location_id:
        conditions.append("v.location_id = ?")
        params.append(location_id)
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    rows = db.execute(f"""
        SELECT v.event_id, v.location_id, v.visibility_status,
               e.event_name, l.city, l.country
        FROM Visibility v
        JOIN Event e ON v.event_id = e.event_id
        JOIN Location l ON v.location_id = l.location_id
        {where}
        ORDER BY e.event_name LIMIT 200
    """, params).fetchall()
    db.close()
    return jsonify(rows_to_list(rows))


@app.route("/api/visibility", methods=["POST"])
def create_visibility():
    data = request.get_json()
    if not data or not data.get("event_id") or not data.get("location_id"):
        return jsonify({"error": "event_id and location_id required"}), 400
    db = get_db()
    try:
        db.execute(
            "INSERT OR REPLACE INTO Visibility(event_id, location_id, visibility_status) VALUES(?,?,?)",
            (data["event_id"], data["location_id"], data.get("visibility_status", "Visible"))
        )
        db.commit()
    except Exception as e:
        db.close()
        return jsonify({"error": str(e)}), 400
    db.close()
    return jsonify({"message": "Visibility record created"}), 201


@app.route("/api/visibility/<int:event_id>/<int:location_id>", methods=["PUT"])
def update_visibility(event_id, location_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data"}), 400
    db = get_db()
    db.execute(
        "UPDATE Visibility SET visibility_status=? WHERE event_id=? AND location_id=?",
        (data.get("visibility_status", "Visible"), event_id, location_id)
    )
    db.commit()
    db.close()
    return jsonify({"message": "Updated"})


@app.route("/api/visibility/<int:event_id>/<int:location_id>", methods=["DELETE"])
def delete_visibility(event_id, location_id):
    db = get_db()
    db.execute("DELETE FROM Visibility WHERE event_id=? AND location_id=?", (event_id, location_id))
    db.commit()
    db.close()
    return jsonify({"message": "Deleted"})


# ── Visibility stats ──────────────────────────────────────────
@app.route("/api/visibility/stats")
def visibility_stats():
    db = get_db()
    rows = db.execute("""
        SELECT l.city, l.country, COUNT(*) as visible_events
        FROM Visibility v
        JOIN Location l ON v.location_id = l.location_id
        WHERE v.visibility_status = 'Visible'
        GROUP BY v.location_id ORDER BY visible_events DESC
    """).fetchall()
    db.close()
    return jsonify(rows_to_list(rows))


# ── Meteorites with pagination & search ──────────────────────
@app.route("/api/meteorites")
def meteorites():
    db = get_db()
    search = request.args.get("search", "")
    page = max(1, int(request.args.get("page", 1)))
    per_page = min(50, int(request.args.get("per_page", 30)))
    offset = (page - 1) * per_page
    cond = "WHERE m.name LIKE ?" if search else ""
    params = [f"%{search}%"] if search else []
    total = db.execute(f"SELECT COUNT(*) as c FROM Meteorite m {cond}", params).fetchone()["c"]
    rows = db.execute(f"""
        SELECT m.name, m.mass_g, m.year, m.latitude, m.longitude
        FROM Meteorite m {cond}
        ORDER BY m.year DESC NULLS LAST LIMIT ? OFFSET ?
    """, params + [per_page, offset]).fetchall()
    db.close()
    return jsonify({"total": total, "page": page, "pages": (total+per_page-1)//per_page, "data": rows_to_list(rows)})


# ── Admin: Add Eclipse with full details ─────────────────────
@app.route("/api/admin/eclipse", methods=["POST"])
def admin_add_eclipse():
    data = request.get_json()
    if not data or not data.get("event_name"):
        return jsonify({"error": "event_name required"}), 400
    db = get_db()
    try:
        cur = db.execute(
            "INSERT INTO Event(event_name, event_date, type_id, description) VALUES(?,?,?,?)",
            (data["event_name"], data.get("event_date"), data.get("type_id"), data.get("description", ""))
        )
        eid = cur.lastrowid
        db.execute("""
            INSERT INTO Eclipse(event_id, eclipse_type, magnitude, gamma, eclipse_time, latitude, longitude)
            VALUES(?,?,?,?,?,?,?)
        """, (eid, data.get("eclipse_type"), data.get("magnitude"),
              data.get("gamma"), data.get("eclipse_time"),
              data.get("latitude"), data.get("longitude")))
        db.commit()
    except Exception as e:
        db.close()
        return jsonify({"error": str(e)}), 400
    db.close()
    return jsonify({"event_id": eid, "message": "Eclipse event created"}), 201


# ── Admin: Add Meteorite with full details ─────────────────────
@app.route("/api/admin/meteorite", methods=["POST"])
def admin_add_meteorite():
    data = request.get_json()
    if not data or not data.get("event_name"):
        return jsonify({"error": "event_name required"}), 400
    db = get_db()
    try:
        cur = db.execute(
            "INSERT INTO Event(event_name, event_date, type_id, description) VALUES(?,?,?,?)",
            (data["event_name"], data.get("event_date"), data.get("type_id"), "")
        )
        eid = cur.lastrowid
        db.execute("""
            INSERT INTO Meteorite(event_id, name, mass_g, year, latitude, longitude)
            VALUES(?,?,?,?,?,?)
        """, (eid, data.get("met_name", data["event_name"]),
              data.get("mass_g"), data.get("year"),
              data.get("latitude"), data.get("longitude")))
        db.commit()
    except Exception as e:
        db.close()
        return jsonify({"error": str(e)}), 400
    db.close()
    return jsonify({"event_id": eid, "message": "Meteorite event created"}), 201


# ── Admin: Add Conjunction with full details ───────────────────
@app.route("/api/admin/conjunction", methods=["POST"])
def admin_add_conjunction():
    data = request.get_json()
    if not data or not data.get("event_name"):
        return jsonify({"error": "event_name required"}), 400
    db = get_db()
    try:
        cur = db.execute(
            "INSERT INTO Event(event_name, event_date, type_id, description) VALUES(?,?,?,?)",
            (data["event_name"], data.get("event_date"), data.get("type_id"), "")
        )
        eid = cur.lastrowid
        db.execute("""
            INSERT INTO Planetary_Conjunction(event_id, planet1, planet2, separation_angle, event_time)
            VALUES(?,?,?,?,?)
        """, (eid, data.get("planet1"), data.get("planet2"),
              data.get("separation_angle"), data.get("event_time")))
        db.commit()
    except Exception as e:
        db.close()
        return jsonify({"error": str(e)}), 400
    db.close()
    return jsonify({"event_id": eid, "message": "Conjunction event created"}), 201


# ── Admin: Add Comet with full details ────────────────────────
@app.route("/api/admin/comet", methods=["POST"])
def admin_add_comet():
    data = request.get_json()
    if not data or not data.get("event_name"):
        return jsonify({"error": "event_name required"}), 400
    db = get_db()
    try:
        cur = db.execute(
            "INSERT INTO Event(event_name, event_date, type_id, description) VALUES(?,?,?,?)",
            (data["event_name"], data.get("event_date"), data.get("type_id"), "")
        )
        eid = cur.lastrowid
        db.execute("""
            INSERT INTO Comet_Approach(event_id, perihelion_dist_au, aphelion_dist_au, period_years)
            VALUES(?,?,?,?)
        """, (eid, data.get("perihelion_dist_au"), data.get("aphelion_dist_au"),
              data.get("period_years")))
        db.commit()
    except Exception as e:
        db.close()
        return jsonify({"error": str(e)}), 400
    db.close()
    return jsonify({"event_id": eid, "message": "Comet event created"}), 201
