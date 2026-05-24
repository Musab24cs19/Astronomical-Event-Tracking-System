"""
seed_data.py  –  Parses all CSV files and seeds astronomy_db via SQLite
(Can be pointed at MySQL by swapping the connection in get_db())
Hidden Developer: 24cs019
"""

import sqlite3, csv, re, os
from datetime import datetime, date
from pathlib import Path

DB_PATH = Path(__file__).parent / "astronomy.db"

SOLAR_CSV     = Path(__file__).parent.parent / "data/solar.csv"
LUNAR_CSV     = Path(__file__).parent.parent / "data/lunar.csv"
METEORITE_CSV = Path(__file__).parent.parent / "data/meteorite.csv"
COMET_CSV     = Path(__file__).parent.parent / "data/comets.csv"
CONJUNCT_CSV  = Path(__file__).parent.parent / "data/conjunctions.csv"


def get_db():
    db = sqlite3.connect(str(DB_PATH))
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    return db


def init_db(db):
    db.executescript("""
    CREATE TABLE IF NOT EXISTS Event_Type (
        type_id   INTEGER PRIMARY KEY AUTOINCREMENT,
        type_name TEXT NOT NULL UNIQUE,
        description TEXT
    );
    CREATE TABLE IF NOT EXISTS Event (
        event_id   INTEGER PRIMARY KEY AUTOINCREMENT,
        event_name TEXT NOT NULL,
        event_date TEXT,
        type_id    INTEGER,
        description TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (type_id) REFERENCES Event_Type(type_id)
    );
    CREATE TABLE IF NOT EXISTS Eclipse (
        event_id     INTEGER PRIMARY KEY,
        eclipse_type TEXT,
        magnitude    REAL,
        gamma        REAL,
        eclipse_time TEXT,
        latitude     TEXT,
        longitude    TEXT,
        FOREIGN KEY (event_id) REFERENCES Event(event_id)
    );
    CREATE TABLE IF NOT EXISTS Meteorite (
        event_id  INTEGER PRIMARY KEY,
        name      TEXT,
        mass_g    REAL,
        year      INTEGER,
        latitude  TEXT,
        longitude TEXT,
        FOREIGN KEY (event_id) REFERENCES Event(event_id)
    );
    CREATE TABLE IF NOT EXISTS Planetary_Conjunction (
        event_id         INTEGER PRIMARY KEY,
        planet1          TEXT,
        planet2          TEXT,
        separation_angle REAL,
        event_time       TEXT,
        FOREIGN KEY (event_id) REFERENCES Event(event_id)
    );
    CREATE TABLE IF NOT EXISTS Comet_Approach (
        event_id           INTEGER PRIMARY KEY,
        perihelion_dist_au REAL,
        aphelion_dist_au   REAL,
        period_years       REAL,
        FOREIGN KEY (event_id) REFERENCES Event(event_id)
    );
    CREATE TABLE IF NOT EXISTS Location (
        location_id INTEGER PRIMARY KEY AUTOINCREMENT,
        country     TEXT,
        city        TEXT,
        latitude    REAL,
        longitude   REAL
    );
    CREATE TABLE IF NOT EXISTS Visibility (
        event_id          INTEGER,
        location_id       INTEGER,
        visibility_status TEXT,
        PRIMARY KEY (event_id, location_id),
        FOREIGN KEY (event_id)    REFERENCES Event(event_id),
        FOREIGN KEY (location_id) REFERENCES Location(location_id)
    );
    CREATE TABLE IF NOT EXISTS Observation_Record (
        observation_id   INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id         INTEGER,
        observer_name    TEXT,
        observation_date TEXT,
        notes            TEXT,
        FOREIGN KEY (event_id) REFERENCES Event(event_id)
    );
    """)

    # Seed event types
    types = [
        ("Solar Eclipse",        "Occurs when the Moon blocks the Sun."),
        ("Lunar Eclipse",        "Earth's shadow falls on the Moon."),
        ("Meteorite Impact",     "A meteorite reached Earth's surface."),
        ("Planetary Conjunction","Two planets appear close in the sky."),
        ("Comet Approach",       "A comet passing near Earth."),
    ]
    for tn, desc in types:
        db.execute("INSERT OR IGNORE INTO Event_Type(type_name,description) VALUES(?,?)", (tn, desc))

    # Seed locations
    locs = [
        ("Pakistan",       "Karachi",   24.8607,  67.0011),
        ("United States",  "New York",  40.7128, -74.0060),
        ("United Kingdom", "London",    51.5074,  -0.1278),
        ("Australia",      "Sydney",   -33.8688, 151.2093),
        ("Japan",          "Tokyo",     35.6762, 139.6503),
    ]
    for country, city, lat, lon in locs:
        db.execute("INSERT OR IGNORE INTO Location(country,city,latitude,longitude) VALUES(?,?,?,?)",
                   (country, city, lat, lon))
    db.commit()


def parse_eclipse_date(raw: str):
    """Handle dates like '-1999 June 12' or '2024 April 8'"""
    raw = raw.strip()
    negative = raw.startswith('-')
    raw = raw.lstrip('-').strip()
    try:
        dt = datetime.strptime(raw, "%Y %B %d")
        if negative:
            return None  # BCE dates — skip
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return None


def safe_float(val):
    try:
        return float(str(val).strip())
    except Exception:
        return None


def safe_int(val):
    try:
        return int(str(val).strip())
    except Exception:
        return None


def load_solar(db, path, limit=None):
    type_id = db.execute("SELECT type_id FROM Event_Type WHERE type_name='Solar Eclipse'").fetchone()[0]
    count = 0
    with open(path, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if limit and count >= limit: break
            d = parse_eclipse_date(row.get("Calendar Date", ""))
            if not d: continue
            cur = db.execute(
                "INSERT INTO Event(event_name,event_date,type_id) VALUES(?,?,?)",
                ("Solar Eclipse", d, type_id)
            )
            eid = cur.lastrowid
            db.execute(
                "INSERT OR IGNORE INTO Eclipse(event_id,eclipse_type,magnitude,gamma,eclipse_time,latitude,longitude) VALUES(?,?,?,?,?,?,?)",
                (eid,
                 row.get("Eclipse Type","").strip(),
                 safe_float(row.get("Eclipse Magnitude","")),
                 safe_float(row.get("Gamma","")),
                 row.get("Eclipse Time","").strip(),
                 row.get("Latitude","").strip(),
                 row.get("Longitude","").strip())
            )
            count += 1
    db.commit()
    print(f"  Solar eclipses loaded: {count}")


def load_lunar(db, path, limit=None):
    type_id = db.execute("SELECT type_id FROM Event_Type WHERE type_name='Lunar Eclipse'").fetchone()[0]
    count = 0
    with open(path, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if limit and count >= limit: break
            d = parse_eclipse_date(row.get("Calendar Date", ""))
            if not d: continue
            cur = db.execute(
                "INSERT INTO Event(event_name,event_date,type_id) VALUES(?,?,?)",
                ("Lunar Eclipse", d, type_id)
            )
            eid = cur.lastrowid
            db.execute(
                "INSERT OR IGNORE INTO Eclipse(event_id,eclipse_type,magnitude,gamma,eclipse_time,latitude,longitude) VALUES(?,?,?,?,?,?,?)",
                (eid,
                 row.get("Eclipse Type","").strip(),
                 safe_float(row.get("Umbral Magnitude","")),
                 safe_float(row.get("Gamma","")),
                 row.get("Eclipse Time","").strip(),
                 row.get("Latitude","").strip(),
                 row.get("Longitude","").strip())
            )
            count += 1
    db.commit()
    print(f"  Lunar eclipses loaded: {count}")


def load_meteorites(db, path, limit=2000):
    type_id = db.execute("SELECT type_id FROM Event_Type WHERE type_name='Meteorite Impact'").fetchone()[0]
    count = 0
    with open(path, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if count >= limit: break
            name = row.get("name","").strip()
            year = safe_int(row.get("year",""))
            mass = safe_float(row.get("mass (g)",""))
            lat  = row.get("reclat","").strip()
            lon  = row.get("reclong","").strip()
            if not name: continue
            d = f"{year:04d}-01-01" if year and year > 0 else None
            cur = db.execute(
                "INSERT INTO Event(event_name,event_date,type_id) VALUES(?,?,?)",
                (name, d, type_id)
            )
            eid = cur.lastrowid
            db.execute(
                "INSERT OR IGNORE INTO Meteorite(event_id,name,mass_g,year,latitude,longitude) VALUES(?,?,?,?,?,?)",
                (eid, name, mass, year, lat, lon)
            )
            count += 1
    db.commit()
    print(f"  Meteorites loaded: {count}")


def load_comets(db, path, limit=161):
    type_id = db.execute("SELECT type_id FROM Event_Type WHERE type_name='Comet Approach'").fetchone()[0]
    count = 0
    # Julian date epoch for reference
    with open(path, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if count >= limit: break
            name = row.get("Object_name","").strip()
            if not name: continue
            # Convert Julian day to approximate calendar date
            tp = safe_float(row.get("TP",""))
            approx_date = None
            if tp:
                # JD 2451545.0 = J2000.0 = 2000-01-01
                days_from_j2000 = tp - 2451545.0
                from datetime import timedelta
                approx_date = (date(2000,1,1) + timedelta(days=days_from_j2000)).strftime("%Y-%m-%d")
            cur = db.execute(
                "INSERT INTO Event(event_name,event_date,type_id) VALUES(?,?,?)",
                (name, approx_date, type_id)
            )
            eid = cur.lastrowid
            db.execute(
                "INSERT OR IGNORE INTO Comet_Approach(event_id,perihelion_dist_au,aphelion_dist_au,period_years) VALUES(?,?,?,?)",
                (eid,
                 safe_float(row.get("q","")),
                 safe_float(row.get("Q","")),
                 safe_float(row.get("P","")))
            )
            count += 1
    db.commit()
    print(f"  Comets loaded: {count}")


def load_conjunctions(db, path):
    type_id = db.execute("SELECT type_id FROM Event_Type WHERE type_name='Planetary Conjunction'").fetchone()[0]
    count = 0
    with open(path, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            raw_name = row.get("event_name","").strip()
            # Normalize separators and replacement characters that appear in the CSV
            clean_name = raw_name.replace(" Conjunction", "").replace("\ufffd", "-").strip()
            # Split by any dash-like character: hyphen, en-dash, em-dash, replacement mark, and other unicode dash variants
            parts = re.split('[-–—\ufffd\u2010\u2011\u2012\u2013\u2014]', clean_name)
            # Fallback: split on any non-alphanumeric sequence if dash splitting still fails
            if len(parts) < 2:
                parts = re.split(r'[^A-Za-z0-9]+', clean_name)
            # Filter out empty parts and strip whitespace
            parts = [p.strip() for p in parts if p.strip()]
            p1 = parts[0] if len(parts) > 0 else "Unknown"
            p2 = parts[1] if len(parts) > 1 else "Unknown"
            raw_date = row.get("event_date","").strip()
            try:
                d = datetime.strptime(raw_date, "%m/%d/%Y").strftime("%Y-%m-%d")
            except Exception:
                d = None
            raw_time = row.get("event_time","").strip()
            try:
                t = datetime.strptime(raw_time, "%I:%M:%S %p").strftime("%H:%M:%S")
            except Exception:
                t = None
            sep = safe_float(row.get("separation_deg ","") or row.get("separation_deg",""))
            event_name = f"{p1}–{p2} Conjunction"
            cur = db.execute(
                "INSERT INTO Event(event_name,event_date,type_id) VALUES(?,?,?)",
                (event_name, d, type_id)
            )
            eid = cur.lastrowid
            db.execute(
                "INSERT OR IGNORE INTO Planetary_Conjunction(event_id,planet1,planet2,separation_angle,event_time) VALUES(?,?,?,?,?)",
                (eid, p1, p2, sep, t)
            )
            count += 1
    db.commit()
    print(f"  Conjunctions loaded: {count}")


if __name__ == "__main__":
    data_dir = Path(__file__).parent.parent / "data"
    data_dir.mkdir(exist_ok=True)

    # Verify CSV files exist
    required_csvs = ["solar.csv", "lunar.csv", "meteorite.csv", "comets.csv", "conjunctions.csv"]
    missing = [f for f in required_csvs if not (data_dir / f).exists()]
    if missing:
        print(f"ERROR: Missing CSV files in {data_dir}: {missing}")
        print("Please place the required CSV files in the data/ directory.")
        exit(1)

    db = get_db()
    init_db(db)

    # Check if data already exists to prevent duplicates
    existing = db.execute("SELECT COUNT(*) as cnt FROM Event").fetchone()["cnt"]
    if existing > 0:
        print(f"Database already contains {existing} events.")
        resp = input("Re-seed? This will DELETE all existing data. (y/N): ").strip().lower()
        if resp != "y":
            print("Skipped. Database unchanged.")
            db.close()
            exit(0)
        # Clear all tables for re-seed
        for table in ["Visibility", "Observation_Record", "Eclipse", "Meteorite",
                       "Planetary_Conjunction", "Comet_Approach", "Event", "Location", "Event_Type"]:
            db.execute(f"DELETE FROM {table}")
        db.commit()
        init_db(db)

    print("Loading data...")
    load_solar(db,        data_dir / "solar.csv")
    load_lunar(db,        data_dir / "lunar.csv")
    load_meteorites(db,   data_dir / "meteorite.csv")
    load_comets(db,       data_dir / "comets.csv")
    load_conjunctions(db, data_dir / "conjunctions.csv")
    print("Done!")
    # Hidden Developer: 24cs019
    db.close()
