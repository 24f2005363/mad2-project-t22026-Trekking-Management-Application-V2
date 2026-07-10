from celery.schedules import crontab

class Config:
    SECRET_KEY = "private_trekker_portal_key"
    SQLALCHEMY_DATABASE_URI = "sqlite:///trek.db"
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    SECURITY_PASSWORD_SALT = "private_trekker_portal_salt"
    SECURITY_PASSWORD_HASH = "bcrypt"
    SECURITY_REGISTERABLE = False
    SECURITY_SEND_REGISTER_EMAIL = False
    SECURITY_UNAUTHORIZED_VIEW = None

    WTF_CSRF_ENABLED = False

    CELERY_BROKER_URL = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND = "redis://localhost:6379/0"
    CELERY_TIMEZONE = "Asia/Kolkata"

    CELERY_BEAT_SCHEDULE = {
        "daily-reminder-job": {
            "task": "tasks.notify_upcoming_treks",
            "schedule": crontab(hour=9, minute=0)
        },
        "monthly-report-job": {
            "task": "tasks.generate_monthly_summary",
            "schedule": crontab(day_of_month=1, hour=7, minute=0)
        }
    }
