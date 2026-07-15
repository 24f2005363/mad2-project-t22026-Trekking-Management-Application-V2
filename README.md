# Trekking Management Application - V2

A full-stack web application for managing trekking activities. It is built using **Flask** for the backend and **Vue 3** for the frontend. The system has three types of users: **Admin, Staff, and Trekker**.

## Tech Stack

### Backend

* Flask
* Flask-SQLAlchemy
* Flask-Security
* SQLite
* Celery
* Redis
* Flask-Caching

### Frontend

* Vue 3
* Vue Router
* Bootstrap 5
* Fetch API

## User Roles

### Admin

* Manage treks
* Create and assign staff
* View all users and bookings
* Block or unblock users
* Generate monthly reports

### Staff

* View assigned treks
* Update trek status
* Manage available slots
* View participant list
* Update profile and password

### Trekker

* Register and login
* Explore available treks
* Book or cancel treks
* View booking history
* Export booking history as CSV
* Update profile and password

## Demo Login

| Role    | Email                                                 | Password      |
| ------- | ----------------------------------------------------- | ------------- |
| Admin   | [head@peakventure.com](mailto:head@peakventure.com)   | peak@2026     |
| Staff   | [guide@peakventure.com](mailto:guide@peakventure.com) | guide@2026    |
| Trekker | Register a new account                                | Your password |

## Main Features

### Authentication

* Trekker registration
* Secure login and logout
* Role-based access
* Password encryption

### Admin Features

* Dashboard with overall statistics
* Add, edit and delete treks
* Assign staff to treks
* Manage staff and trekkers
* View all bookings
* Send monthly reports

### Staff Features

* View assigned treks
* Change trek status
* Update available slots
* Mark treks as completed
* Manage personal profile

### Trekker Features

* Browse available treks
* Filter treks by location, difficulty and duration
* Book and cancel treks
* View booking history
* Download booking history as CSV
* Update account details

## Background Tasks

* Daily reminder emails for upcoming treks
* Monthly report email for the admin
* CSV export of booking history
* Test email through Celery

## Caching

* Frequently used data is cached using Redis.
* Cache is cleared automatically whenever data is updated.

## Security

* Secure login using Flask-Security
* Role-based authorization
* Passwords stored in encrypted form
* Users who are blocked cannot access the system
* Users can only access their own data

## Project Structure

```text
project-root/
│── app.py
│── config.py
│── models.py
│── tasks.py
│── celery_setup.py
│── redis_helper.py
│── db_init.py
│── requirements.txt
│
├── instance/
│   └── trek.db
│
├── exports/
│
├── templates/
│   └── index.html
│
└── static/
    ├── app.js
    └── components/
```

## Setup Steps

1. Clone the repository.
2. Create a virtual environment.
3. Install dependencies using `pip install -r requirements.txt`.
4. Start the Redis server.
5. Start the Celery worker.
6. Run the Flask application.
7. Open `http://127.0.0.1:5000` in your browser.

## Gmail Configuration

Update the email settings in `config.py` with your Gmail App Password before sending emails.

## Demo Accounts

| Role    | Email                                                 | Password      |
| ------- | ----------------------------------------------------- | ------------- |
| Admin   | [head@peakventure.com](mailto:head@peakventure.com)   | peak@2026     |
| Staff   | [guide@peakventure.com](mailto:guide@peakventure.com) | guide@2026    |
| Trekker | Create a new account                                  | Your password |
