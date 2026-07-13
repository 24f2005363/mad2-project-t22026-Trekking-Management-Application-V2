import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from celery import shared_task
from datetime import date, timedelta
from calendar import month_name
from models import db, Trek, Booking, User, Role
from sqlalchemy import func
from config import Config
import csv
import os


def send_email(to_addr, subject, body, html_body=None):
    if html_body:
        msg = MIMEMultipart("alternative")
        msg.attach(MIMEText(body, "plain"))
        msg.attach(MIMEText(html_body, "html"))
    else:
        msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = Config.MAIL_USERNAME
    msg["To"] = to_addr
    server = smtplib.SMTP(Config.MAIL_SERVER, Config.MAIL_PORT)
    server.starttls()
    server.login(Config.MAIL_USERNAME, Config.MAIL_PASSWORD)
    server.send_message(msg)
    server.quit()


@shared_task(ignore_result=False)
def notify_upcoming_treks():
    tomorrow = date.today() + timedelta(days=1)
    upcoming = Booking.query.filter_by(status="Booked").all()
    sent = 0
    errors = []
    for b in upcoming:
        t = b.trip
        u = b.customer
        if t and u and t.start_date == tomorrow:
            body = ("Hi " + u.name + ",\n\n"
                    "This is a reminder that your trek '" + t.title + "' starts tomorrow.\n\n"
                    "Location: " + t.place + "\n"
                    "Date: " + str(t.start_date) + " to " + str(t.end_date) + "\n"
                    "Slots booked: " + str(b.qty) + "\n\n"
                    "Happy trekking!\nPeakVenture Team")
            try:
                send_email(u.email, "Trek Reminder: " + t.title, body)
                sent = sent + 1
            except Exception as e:
                errors.append(str(e))
    return {"status": "done", "reminders_sent": sent, "errors": errors}


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
    admin_email = admin_user.email if admin_user else Config.MAIL_USERNAME

    html_body = """<html><body style="font-family:Arial,sans-serif;padding:20px">
<h2 style="color:#2c3e50">Monthly Trek Summary - """ + month_name[month] + " " + str(year) + """</h2>
<table style="border-collapse:collapse;width:100%;max-width:500px">
<tr><td style="padding:10px;background:#3498db;color:#fff"><strong>Metric</strong></td><td style="padding:10px;background:#3498db;color:#fff"><strong>Value</strong></td></tr>
<tr><td style="padding:8px;border:1px solid #ddd">Total Treks Conducted</td><td style="padding:8px;border:1px solid #ddd;font-weight:bold">""" + str(total_treks) + """</td></tr>
<tr><td style="padding:8px;border:1px solid #ddd;background:#f9f9f9">Total Participants</td><td style="padding:8px;border:1px solid #ddd;background:#f9f9f9;font-weight:bold">""" + str(total_participants) + """</td></tr>
</table>
<h3 style="color:#2c3e50;margin-top:25px">Popular Treks</h3>
<table style="border-collapse:collapse;width:100%;max-width:500px">
<tr><td style="padding:10px;background:#2c3e50;color:#fff"><strong>Trek Name</strong></td><td style="padding:10px;background:#2c3e50;color:#fff"><strong>Bookings</strong></td></tr>"""
    for idx, (name, cnt) in enumerate(popular):
        bg = "#f9f9f9" if idx % 2 == 0 else "#fff"
        html_body += """<tr><td style="padding:8px;border:1px solid #ddd;background:""" + bg + """">""" + name + """</td><td style="padding:8px;border:1px solid #ddd;background:""" + bg + """">""" + str(cnt) + """</td></tr>"""
    html_body += """</table>
<p style="color:#7f8c8d;margin-top:20px">This report was generated automatically by PeakVenture Trekking System.</p>
</body></html>"""

    plain_body = ("Monthly Summary - " + month_name[month] + " " + str(year) + "\n\n"
                  "Total treks: " + str(total_treks) + "\n"
                  "Total participants: " + str(total_participants) + "\n\n"
                  "Popular treks:\n")
    for p in popular:
        plain_body = plain_body + "- " + p[0] + ": " + str(p[1]) + " bookings\n"

    try:
        send_email(admin_email, "Monthly Trek Summary - " + month_name[month] + " " + str(year), plain_body, html_body)
        email_status = "sent to " + admin_email
    except Exception as e:
        email_status = "failed: " + str(e)

    return {
        "status": "done",
        "month": month_name[month],
        "year": year,
        "total_treks": total_treks,
        "total_participants": total_participants,
        "popular_treks": [{"name": n, "count": c} for n, c in popular],
        "admin_email": admin_email,
        "email_delivery": email_status
    }


@shared_task(ignore_result=False)
def write_bookings_csv(person_id):
    from flask import current_app
    user = db.session.get(User, person_id)
    if not user:
        return {"status": "failed", "message": "User not found"}

    bookings = Booking.query.filter_by(user_id=person_id).all()
    app_root = current_app.root_path
    folder = os.path.join(app_root, "exports")
    os.makedirs(folder, exist_ok=True)

    file_name = "history_user_" + str(person_id) + ".csv"
    file_path = os.path.join(folder, file_name)

    with open(file_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["User ID", "Trek Name", "Location", "Status", "Start Date", "End Date"])
        for b in bookings:
            writer.writerow([
                b.user_id,
                b.trip.title if b.trip else "",
                b.trip.place if b.trip else "",
                b.status,
                str(b.trip.start_date) if b.trip else "",
                str(b.trip.end_date) if b.trip else ""
            ])

    return {
        "status": "success",
        "message": "CSV ready",
        "file_url": "/api/trekker/download-export/" + file_name
    }


@shared_task(ignore_result=False)
def send_async_test():
    send_email(Config.MAIL_USERNAME, "Async Test from Trekking App", "This email was sent through Celery async task.")
    return {"status": "sent"}


