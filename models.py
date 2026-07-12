import uuid
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from flask_security import UserMixin, RoleMixin

db = SQLAlchemy()

# Junction linking users to their roles
role_assignments = db.Table(
    "role_assignments",
    db.Column("user_id", db.Integer(), db.ForeignKey("user.id", ondelete="CASCADE"), primary_key=True),
    db.Column("role_id", db.Integer(), db.ForeignKey("role.id", ondelete="CASCADE"), primary_key=True)
)

class Role(db.Model, RoleMixin):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)
    desc = db.Column(db.String(255))

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    fs_uniquifier = db.Column(db.String(255), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    mobile = db.Column(db.String(20))
    active = db.Column(db.Boolean, default=True)
    blacklisted = db.Column(db.Boolean, default=False)
    created = db.Column(db.DateTime, default=datetime.utcnow)

    roles = db.relationship(
        "Role",
        secondary=role_assignments,
        backref=db.backref("team_members", lazy="dynamic")
    )

    staff_profile = db.relationship(
        "StaffInfo",
        backref="staff_account",
        uselist=False,
        cascade="save-update, merge, delete",
        passive_deletes=False
    )

    booking_records = db.relationship(
        "Booking",
        backref="customer",
        lazy="select",
        cascade="save-update, merge, delete",
        passive_deletes=False
    )

class StaffInfo(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="CASCADE"), unique=True, nullable=False)
    info = db.Column(db.String(200))
    exp_years = db.Column(db.String(100))
    skills = db.Column(db.String(100))
    state = db.Column(db.String(50), default="Active")
    created = db.Column(db.DateTime, default=datetime.utcnow)

    managed_treks = db.relationship(
        "Trek",
        backref="guide",
        lazy="subquery",
        passive_deletes=False
    )

class Trek(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    place = db.Column(db.String(120), nullable=False)
    level = db.Column(db.String(50), nullable=False)
    duration = db.Column(db.Integer, nullable=False)
    max_slots = db.Column(db.Integer, nullable=False)
    left_slots = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(50), default="Pending")
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    about = db.Column(db.Text)
    staff_id = db.Column(db.Integer, db.ForeignKey("staff_info.id", ondelete="SET NULL"), nullable=True)
    created = db.Column(db.DateTime, default=datetime.utcnow)

    reservations = db.relationship(
        "Booking",
        backref="trip",
        lazy="select",
        cascade="save-update, merge, delete",
        passive_deletes=False
    )

class Booking(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="CASCADE"), nullable=False)
    trek_id = db.Column(db.Integer, db.ForeignKey("trek.id", ondelete="CASCADE"), nullable=False)
    book_time = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(50), default="Booked")
    pay_status = db.Column(db.String(50), default="Pending")
    qty = db.Column(db.Integer, nullable=False, default=1)
    cancel_time = db.Column(db.DateTime, nullable=True)

    __table_args__ = (
        db.UniqueConstraint("user_id", "trek_id", name="uq_participant_trip"),
    )
