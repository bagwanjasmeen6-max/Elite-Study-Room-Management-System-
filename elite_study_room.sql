CREATE DATABASE IF NOT EXISTS elite_study_room
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE elite_study_room;

CREATE TABLE IF NOT EXISTS rooms (
  id VARCHAR(80) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  type VARCHAR(160) NOT NULL,
  capacity INT NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  seat_prefix VARCHAR(20) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS slots (
  id VARCHAR(80) PRIMARY KEY,
  label VARCHAR(120) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
  id VARCHAR(100) PRIMARY KEY,
  user_name VARCHAR(160) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(180),
  room_id VARCHAR(80) NOT NULL,
  room_name VARCHAR(160) NOT NULL,
  slot_id VARCHAR(80) NOT NULL,
  slot_label VARCHAR(120) NOT NULL,
  seat_id VARCHAR(30) NOT NULL,
  seat_label VARCHAR(30) NOT NULL,
  booking_date DATE NOT NULL,
  notes TEXT,
  status ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  source VARCHAR(40) NOT NULL DEFAULT 'online',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_booking_lookup (room_id, slot_id, booking_date, seat_id),
  INDEX idx_booking_phone (phone)
);

INSERT INTO rooms (id, name, type, capacity, price, seat_prefix, active) VALUES
('switch-desk', 'Switch System Desk', 'Individual Desk', 10, 120, 'S', 1),
('pc-desk', 'PC Desk', 'Computer Desk', 10, 180, 'PC', 1),
('group-table', 'Group Table', 'Student Group Seat', 10, 150, 'G', 1),
('board-room', 'Board Room', 'Private Room', 2, 500, 'BR', 1)
ON DUPLICATE KEY UPDATE
name = VALUES(name),
type = VALUES(type),
capacity = VALUES(capacity),
price = VALUES(price),
seat_prefix = VALUES(seat_prefix),
active = VALUES(active);

INSERT INTO slots (id, label, start_time, end_time, active) VALUES
('morning', 'Morning', '06:00:00', '10:00:00', 1),
('midday', 'Midday', '10:00:00', '14:00:00', 1),
('evening', 'Evening', '14:00:00', '18:00:00', 1),
('night', 'Night', '18:00:00', '22:00:00', 1),
('full-day', 'Full Day', '06:00:00', '22:00:00', 1)
ON DUPLICATE KEY UPDATE
label = VALUES(label),
start_time = VALUES(start_time),
end_time = VALUES(end_time),
active = VALUES(active);
