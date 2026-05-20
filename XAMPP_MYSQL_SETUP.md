# XAMPP MySQL setup

Use this when you want the booking system to save data in XAMPP MySQL instead of Firebase.

## 1. Start XAMPP

Start:
- Apache
- MySQL

If MySQL shows `shutdown unexpectedly`, fix XAMPP MySQL first. This website cannot connect to MySQL until MySQL is running.

## 2. Import the database

Open phpMyAdmin:

```txt
http://localhost/phpmyadmin
```

Then:

1. Click `Import`.
2. Choose `database/elite_study_room.sql`.
3. Click `Go`.

This creates:
- `elite_study_room`
- `rooms`
- `slots`
- `bookings`

It also inserts:
- 10 Switch System desks
- 10 PC desks
- 10 Group Table seats
- 2 Board Rooms
- default time slots

## 3. Serve this project through XAMPP Apache

The PHP API only works through Apache/PHP, not through the Python preview server.

Recommended folder:

```txt
C:\xampp\htdocs\elite-study-room
```

Copy this project folder there, then open:

```txt
http://localhost/elite-study-room/userportal.html
```

Admin login:

```txt
http://localhost/elite-study-room/adminpass.html
```

## 4. Database settings

The database connection file is:

```txt
api/db.php
```

Default XAMPP values are already set:

```txt
host: 127.0.0.1
database: elite_study_room
user: root
password: blank
```

When connected, the user page badge shows:

```txt
XAMPP MySQL connected
```
