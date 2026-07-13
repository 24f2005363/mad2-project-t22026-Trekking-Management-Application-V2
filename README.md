# Trekking Management Application - V2

A full-stack role-based web application for managing trekking activities, trek staff, trekkers, bookings, status tracking, background jobs, and caching. Built with a **Flask backend** and a **Vue 3 frontend**, supporting **Admin**, **Staff**, and **Trekker** workflows.

## Tech Stack

- **Backend:** Flask, Flask-SQLAlchemy, Flask-Security, Celery, Redis, Flask-Caching, SQLite
- **Frontend:** Vue 3 (Options API), Vue Router 4, Bootstrap 5, Fetch API
- **Background Tasks:** Celery with Redis broker
- **Caching:** Redis (30s TTL on GET routes, auto-cleared on writes)
- **Email:** smtplib via Gmail SMTP (credentials in `config.py` only)

## Three Main Roles

| Role | Responsibilities |
|------|-----------------|
| **Admin** | Manage trek routes, create/assign staff, manage users, view bookings, search, block/unblock users, trigger monthly report |
| **Staff** | View assigned treks, manage slots/status, view participant list, mark trek as completed, manage own profile and password |
| **Trekker** | Register, login, browse/explore open treks, filter by difficulty/location/duration, book seats, cancel bookings, view booking history, export CSV, update profile and password |

## Seeded Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `head@peakventure.com` | `peak@2026` |
| **Staff** | `guide@peakventure.com` | `guide@2026` |

*Sample trek "Valley of Flowers Expedition" is auto-created on first run.*

## Core Features

### 1. Authentication & Role Management
- Trekker self-registration and login
- Admin and Staff login only (no registration)
- Single admin auto-seeded on first run
- Flask-Security session-based auth with role-based access (`@roles_required`)
- Unified `User` model with role assignments
- Login guard for blacklisted/inactive accounts

### 2. Admin Module
- **Dashboard** — total treks, users, staff, and bookings (OverviewStats)
- **Trek Routes** — create, edit, search, delete, assign staff, update status (Pending/Open/Closed/Cancelled/Ongoing/Completed)
- **Staff Management** — create new staff, list/search, block/unblock
- **Client Management** — list/search trekkers, block/unblock, delete
- **Booking Overview** — view all bookings with status badges
- **Reports** — trigger monthly summary email (HTML report via Celery)

### 3. Staff Module
- **Dashboard** — assigned treks count, total participants, active treks
- **Trek Detail** — view trek info + participant list (name, email, phone, slots, status)
- **Status Updates** — Open / Closed / Ongoing
- **Mark Complete** — marks trek + all booked bookings as Completed
- **Slot Adjustment** — update available slots
- **Profile & Password** — view/edit name, mobile, experience, skills, info; change password

### 4. Trekker Module
- **Home** — summary of available treks and my bookings
- **Explore** — browse open treks, filter by difficulty/location/duration
- **Trek Detail** — view full info, book seats
- **My Trips** — view active bookings, cancel bookings, export CSV
- **History** — view completed and cancelled treks
- **Account** — update name/mobile, change password

### 5. Backend Jobs (Celery)
| Task | Schedule | Description |
|------|----------|-------------|
| Daily Reminder | Every day 9:00 AM | Sends email to trekkers about treks starting tomorrow |
| Monthly Report | 1st of month 7:00 AM | Generates HTML summary (treks, participants, popular treks) and emails admin |
| CSV Export | On-demand | Exports user's booking history as CSV, polls for status, shows download |
| Async Test | On-demand | Sends test email via Celery to verify async pipeline |

### 6. Caching
- Redis caching with 30-second TTL on frequently accessed GET routes:
  - Admin stats, trek list, guide list, client list, bookings
  - Trekker treks-by-id
- Cache auto-cleared on POST/PUT/DELETE operations via `after_request` hook
- Graceful degradation if Redis is unreachable: cached routes fall back to computing
  the response directly instead of erroring (`safe_cached` wrapper in `app.py`), and
  cache-clear failures are swallowed the same way

### 7. Security
- Session-based authentication via Flask-Security
- Role-based access control on all routes
- Blacklisted/inactive users blocked at login, and mid-session via a `before_request` guard
- Only assigned staff can manage a trek
- Password hashing with bcrypt
- CSRF disabled (session-based API)
- CSV exports are private: served through an authenticated, ownership-checked route
  instead of a public static file
- Every error response (400/401/403/404/405/415/500, including unhandled exceptions)
  is returned as JSON, never a raw HTML/traceback page

## API Endpoints

### Authentication
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/join-trekker` | Public | Trekker registration |
| POST | `/api/sign-in` | Public | Login |
| GET | `/api/sign-out` | Any | Logout |
| GET | `/api/current-user` | Any | Current user session info |

### Admin
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/admin-stats` | Admin | Dashboard stats |
| GET | `/api/adm-treks/list` | Admin | List all treks |
| GET | `/api/adm-treks/search` | Admin | Search treks |
| POST | `/api/adm-treks/add` | Admin | Create trek |
| PUT | `/api/adm-treks/edit/<id>` | Admin | Edit trek details |
| POST | `/api/adm-treks/update-state/<id>` | Admin | Change trek status |
| DELETE | `/api/adm-treks/remove/<id>` | Admin | Delete trek |
| GET | `/api/adm-guides/list` | Admin | List all staff |
| GET | `/api/adm-guides/search` | Admin | Search staff |
| POST | `/api/adm-guides/new` | Admin | Create staff |
| POST | `/api/adm-guides/assign-route/<guide_id>/<route_id>` | Admin | Assign staff to trek |
| POST | `/api/adm-guides/block/<guide_id>` | Admin | Block staff |
| POST | `/api/adm-guides/unblock/<guide_id>` | Admin | Unblock staff |
| GET | `/api/adm-clients/list` | Admin | List all trekkers |
| GET | `/api/adm-clients/search` | Admin | Search trekkers |
| POST | `/api/adm-clients/block/<client_id>` | Admin | Block trekker |
| POST | `/api/adm-clients/unblock/<client_id>` | Admin | Unblock trekker |
| DELETE | `/api/adm-clients/remove/<client_id>` | Admin | Delete trekker |
| GET | `/api/adm-bookings/all` | Admin | View all bookings |
| GET | `/api/probe-mail` | Public | Test email (sync) |
| GET | `/api/async-probe-mail` | Public | Test email (async via Celery) |
| GET | `/api/tasks/trigger-reminder` | Admin | Trigger daily trek reminder job |
| GET | `/api/tasks/trigger-report` | Admin | Trigger monthly report job |

### Staff
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/staff-panel/summary` | Staff | Dashboard stats |
| GET | `/api/staff-panel/routes` | Staff | List assigned treks |
| GET | `/api/staff-panel/routes/<id>` | Staff | Trek detail + participants |
| POST | `/api/staff-panel/routes/<id>/change-status` | Staff | Update trek status |
| POST | `/api/staff-panel/routes/<id>/adjust-slots` | Staff | Adjust available slots |
| POST | `/api/staff-panel/routes/<id>/mark-done` | Staff | Mark trek as completed |
| GET, PUT | `/api/staff-detail` | Staff | View/update own profile |
| POST | `/api/staff-change-key` | Staff | Change password |

### Trekker
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/trekker/home` | Trekker | Dashboard summary |
| GET | `/api/trekker/explore` | Trekker | Browse open treks (filterable) |
| GET | `/api/trekker/treks/<id>` | Trekker | Trek detail |
| POST | `/api/trekker/reserve` | Trekker | Book trek seats |
| POST | `/api/trekker/cancel/<book_id>` | Trekker | Cancel booking |
| GET | `/api/trekker/my-trips` | Trekker | Active bookings |
| GET | `/api/trekker/history` | Trekker | Completed/cancelled history |
| GET, PUT | `/api/trekker/account` | Trekker | View/update name and mobile |
| POST | `/api/trekker/change-passcode` | Trekker | Change password |
| GET | `/api/tasks/export-csv` | Trekker | Trigger CSV export |
| GET | `/api/trekker/download-export/<file_name>` | Trekker | Download own CSV export (ownership-checked) |
| GET | `/api/tasks/status/<task_id>` | Any authenticated user | Check Celery task status |

### Health
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/health-pulse` | Any | Server health check |
| GET | `/api/db-audit` | Any | Database connection check |
| GET | `/db-status` | Any | Row counts for users/roles/treks/bookings |

## Project Structure

```
project-root/
├── app.py                  # Flask app, API routes, DB creation + seeding (runs on import)
├── config.py               # Configuration (DB, Redis, Celery, Email)
├── models.py               # SQLAlchemy models (User, Role, Trek, Booking, StaffInfo)
├── tasks.py                # Celery tasks (reminder, report, CSV, test)
├── celery_setup.py         # Celery app factory (make_celery) - real instance lives at app.celery
├── redis_helper.py         # Cache helper utilities
├── db_init.py              # Standalone DB seeding script
├── requirements.txt        # (create from pip freeze)
├── instance/
│   └── trek.db             # SQLite database (auto-created)
├── exports/                # Generated CSV exports (private - served through an
│                            # authenticated route, not exposed under static/)
├── templates/
│   └── index.html          # Vue SPA entry point (Jinja2)
├── static/
│   ├── app.js              # Vue Router + app initialization
│   └── components/         # 18 Vue 3 components
│       ├── NavBar.js
│       ├── Login.js
│       ├── Register.js
│       ├── AdminDashboard.js
│       ├── OverviewStats.js
│       ├── RoutePanel.js
│       ├── StaffPanel.js
│       ├── ClientPanel.js
│       ├── BookingOverview.js
│       ├── StaffDashboard.js
│       ├── StaffSettings.js
│       ├── TrekkerDashboard.js
│       ├── TrekkerHome.js
│       ├── ExploreView.js
│       ├── TrekDetailView.js
│       ├── TripListView.js
│       ├── HistoryView.js
│       └── AccountView.js
```

## Setup Instructions

### Prerequisites
- Python 3.10+
- Redis server (for Celery + caching)
- Git

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd trekking-app-v2
```

### 2. Create and Activate Virtual Environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux/Mac
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Start Redis
```bash
# Windows (WSL)
wsl sudo service redis-server start

# Linux
sudo service redis-server start

# Verify
redis-cli ping
# Should return: PONG
```

### 5. Start Celery Worker
```bash
celery -A app.celery worker --loglevel=info
# Windows may need the solo pool:
celery -A app.celery worker --loglevel=info --pool=solo
```

### 6. Run the Application
```bash
python app.py
```

### 7. Open the App
Navigate to [http://127.0.0.1:5000](http://127.0.0.1:5000)

## Gmail SMTP Configuration

Edit `config.py` to set your Gmail credentials:

```python
MAIL_SERVER = "smtp.gmail.com"
MAIL_PORT = 587
MAIL_USE_TLS = True
MAIL_USERNAME = "your.email@gmail.com"
MAIL_PASSWORD = "your-16-char-app-password"
MAIL_DEFAULT_SENDER = "your.email@gmail.com"
```

**Note:** You must use a Gmail App Password (not your regular password). Generate one at https://myaccount.google.com/apppasswords

## Login Credentials (Demo)

| Role | Email | Password |
|------|-------|----------|
| Admin | `head@peakventure.com` | `peak@2026` |
| Staff | `guide@peakventure.com` | `guide@2026` |
| Trekker | *(self-register)* | *(self-register)* |
