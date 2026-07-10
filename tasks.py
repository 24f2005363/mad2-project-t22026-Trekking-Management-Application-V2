from celery import shared_task
from datetime import date, timedelta
from calendar import month_name
from models import Trek, Booking, User, Role
from sqlalchemy import func
import csv
import os
import json


@shared_task(ignore_result=False)
def notify_upcoming_treks():
    tomorrow = date.today() + timedelta(days=1)
    upcoming = Booking.query.filter_by(status="Booked").all()
    count = 0
    logs = []
    for b in upcoming:
        t = b.trek
        u = b.user
        if t and u and t.start_date == tomorrow:
            msg = "Reminder: " + t.title + " starts tomorrow for " + u.name
            logs.append(msg)
            count = count + 1
    return {
        "status": "done",
        "reminders_sent": count,
        "details": logs
    }


@shared_task(ignore_result=False)
def generate_monthly_summary():
    today = date.today()
    month = today.month
    year = today.year

    treks_this_month = Trek.query.filter(
        func.extract("month", Trek.start_date) == month,
        func.extract("year", Trek.start_date) == year
    ).all()

    total_treks = len(treks_this_month)
    trek_ids = [t.id for t in treks_this_month]
    total_participants = 0
    popular = []

    if trek_ids:
        total_participants = Booking.query.filter(
            Booking.trek_id.in_(trek_ids),
            Booking.status.in_(["Booked", "Completed"])
        ).count()

        for t in treks_this_month:
            cnt = Booking.query.filter_by(trek_id=t.id).filter(
                Booking.status.in_(["Booked", "Completed"])
            ).count()
            popular.append((t.title, cnt))

        popular.sort(key=lambda x: x[1], reverse=True)

    admin_user = User.query.join(User.roles).filter(Role.name == "admin").first()

    return {
        "status": "done",
        "month": month_name[month],
        "year": year,
        "total_treks": total_treks,
        "total_participants": total_participants,
        "popular_treks": [{"name": n, "count": c} for n, c in popular],
        "admin_email": admin_user.email if admin_user else "No admin found"
    }


@shared_task(ignore_result=False)
def write_bookings_csv(person_id):
    from flask import current_app
    user = db.session.get(User, person_id)
    if not user:
        return {"status": "failed", "message": "User not found"}

    bookings = Booking.query.filter_by(user_id=person_id).all()
    app_root = current_app.root_path
    folder = os.path.join(app_root, "static", "exports")
    os.makedirs(folder, exist_ok=True)

    file_name = "history_user_" + str(person_id) + ".csv"
    file_path = os.path.join(folder, file_name)

    with open(file_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["User ID", "Trek Name", "Location", "Status", "Start Date", "End Date"])
        for b in bookings:
            writer.writerow([
                b.user_id,
                b.trek.title if b.trek else "",
                b.trek.place if b.trek else "",
                b.status,
                str(b.trek.start_date) if b.trek else "",
                str(b.trek.end_date) if b.trek else ""
            ])

    return {
        "status": "success",
        "message": "CSV ready",
        "file_url": "/static/exports/" + file_name
    }


# Need db import for write_bookings_csv
from models import db
