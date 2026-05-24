-- ============================================================
--  ASTRONOMY EVENT TRACKER — FIXED & COMPLETE SCHEMA
--  Hidden Developer: 24cs019
-- ============================================================

CREATE DATABASE IF NOT EXISTS astronomy_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE astronomy_db;

SET FOREIGN_KEY_CHECKS = 0;

-- ── Event Type ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Event_Type (
    type_id   INT AUTO_INCREMENT PRIMARY KEY,
    type_name VARCHAR(50)  NOT NULL UNIQUE,
    description TEXT
);

-- ── Core Event ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Event (
    event_id   INT AUTO_INCREMENT PRIMARY KEY,
    event_name VARCHAR(150) NOT NULL,
    event_date DATE,
    type_id    INT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (type_id) REFERENCES Event_Type(type_id) ON DELETE SET NULL
);

-- ── Eclipse (Solar + Lunar) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS Eclipse (
    event_id     INT PRIMARY KEY,
    eclipse_type VARCHAR(20),
    magnitude    DECIMAL(8,4),
    gamma        DECIMAL(8,4),
    eclipse_time TIME,
    latitude     VARCHAR(12),
    longitude    VARCHAR(12),
    FOREIGN KEY (event_id) REFERENCES Event(event_id) ON DELETE CASCADE
);

-- ── Meteorite ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Meteorite (
    event_id  INT PRIMARY KEY,
    name      VARCHAR(255),
    mass_g    DECIMAL(14,3),
    year      INT,
    latitude  VARCHAR(12),
    longitude VARCHAR(12),
    FOREIGN KEY (event_id) REFERENCES Event(event_id) ON DELETE CASCADE
);

-- ── Planetary Conjunction ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS Planetary_Conjunction (
    event_id         INT PRIMARY KEY,
    planet1          VARCHAR(50),
    planet2          VARCHAR(50),
    separation_angle DECIMAL(8,4),
    event_time       TIME,
    FOREIGN KEY (event_id) REFERENCES Event(event_id) ON DELETE CASCADE
);

-- ── Comet Approach ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Comet_Approach (
    event_id           INT PRIMARY KEY,
    perihelion_dist_au DECIMAL(12,6),
    aphelion_dist_au   DECIMAL(12,3),
    period_years       DECIMAL(10,3),
    FOREIGN KEY (event_id) REFERENCES Event(event_id) ON DELETE CASCADE
);

-- ── Location ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Location (
    location_id INT AUTO_INCREMENT PRIMARY KEY,
    country     VARCHAR(100),
    city        VARCHAR(100),
    latitude    DECIMAL(9,6),
    longitude   DECIMAL(9,6)
);

-- ── Visibility ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Visibility (
    event_id          INT,
    location_id       INT,
    visibility_status VARCHAR(50),
    PRIMARY KEY (event_id, location_id),
    FOREIGN KEY (event_id)    REFERENCES Event(event_id)    ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES Location(location_id) ON DELETE CASCADE
);

-- ── Observation Record ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Observation_Record (
    observation_id   INT AUTO_INCREMENT PRIMARY KEY,
    event_id         INT,
    observer_name    VARCHAR(150),
    observation_date DATE,
    notes            TEXT,
    FOREIGN KEY (event_id) REFERENCES Event(event_id) ON DELETE CASCADE
);

SET FOREIGN_KEY_CHECKS = 1;

-- ── Seed: Event Types ─────────────────────────────────────────
INSERT IGNORE INTO Event_Type (type_name, description) VALUES
  ('Solar Eclipse',        'Occurs when the Moon passes between Earth and the Sun, blocking sunlight.'),
  ('Lunar Eclipse',        'Occurs when Earth''s shadow falls on the Moon.'),
  ('Meteorite Impact',     'A meteorite that survived passage through the atmosphere and reached Earth''s surface.'),
  ('Planetary Conjunction','Two or more planets appear very close together in the sky.'),
  ('Comet Approach',       'A comet passing through the inner solar system near Earth.');

-- ── Seed: Sample Locations ────────────────────────────────────
INSERT IGNORE INTO Location (location_id, country, city, latitude, longitude) VALUES
  (1, 'Pakistan',       'Karachi',      24.8607,  67.0011),
  (2, 'United States',  'New York',     40.7128, -74.0060),
  (3, 'United Kingdom', 'London',       51.5074,  -0.1278),
  (4, 'Australia',      'Sydney',      -33.8688, 151.2093),
  (5, 'Japan',          'Tokyo',        35.6762, 139.6503);

-- Hidden Developer: 24cs019
