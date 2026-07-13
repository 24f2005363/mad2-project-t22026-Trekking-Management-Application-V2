from datetime import date, datetime
from flask import Flask, jsonify, request, render_template, make_response
from flask_security import Security, SQLAlchemyUserDatastore, roles_required, current_user
from flask_security.utils import hash_password, verify_password, login_user, logout_user
from models import db, User, Role, Trek, Booking, StaffInfo
from sqlalchemy import or_
from config import Config
from redis_helper import cache
from celery_setup import make_celery
from celery.result import AsyncResult

app = Flask(__name__)
app.config.from_object(Config)

db.init_app(app)
cache.init_app(app)

celery = make_celery(app)

# Flask security datastore
user_store = SQLAlchemyUserDatastore(db, User, Role)
security = Security(app, user_store)

# Validate current session user from database
def load_current_account():
    if not current_user.is_authenticated:
        return None
    record = User.query.filter_by(id=current_user.id).first()
    if record is None:
        logout_user()
        return None
    return record

@app.before_request
def guard_inactive_sessions():
    if current_user.is_authenticated:
        record = User.query.filter_by(id=current_user.id).first()
        if record is None:
            logout_user()
            return make_response(jsonify({"error": "invalid user session"}), 401)
        if record.blacklisted or not record.active:
            logout_user()
            return make_response(jsonify({"error": "account disabled"}), 403)

@app.after_request
def auto_clear_cache(response):
    if request.method in ("POST", "PUT", "DELETE"):
        try:
            cache.clear()
        except Exception:
            pass
    return response

@app.route("/")
def index_view():
    return render_template("index.html")

@app.route("/db-status")
def check_database_stats():
    return jsonify({
        "users": User.query.count(),
        "roles": Role.query.count(),
        "treks": Trek.query.count(),
        "bookings": Booking.query.count()
    })

@app.route("/api/join-trekker", methods=["POST"])
def signup_user():
    form_data = request.get_json()
    if not form_data:
        return jsonify({"error": "No body provided"}), 400

    u_name = form_data.get("name")
    u_email = form_data.get("email")
    u_pwd = form_data.get("password")
    u_mobile = form_data.get("mobile")

    if not u_name or not u_email or not u_pwd:
        return jsonify({"error": "missing name, email or password"}), 400

    old = user_store.find_user(email=u_email)
    if old:
        return jsonify({"error": "User email already in use"}), 400

    new_u = user_store.create_user(
        email=u_email,
        password=hash_password(u_pwd),
        name=u_name,
        mobile=u_mobile,
        active=True
    )
    trekker_r = user_store.find_role("trekker")
    user_store.add_role_to_user(new_u, trekker_r)
    db.session.commit()

    return jsonify({"message": "Registration successful"}), 201

@app.route("/api/sign-in", methods=["POST"])
def authenticate_user():
    form_data = request.get_json()
    if not form_data:
        return jsonify({"error": "No body provided"}), 400

    u_email = form_data.get("email")
    u_pwd = form_data.get("password")

    u = user_store.find_user(email=u_email)
    if not u:
        return jsonify({"error": "Invalid email or password"}), 401

    if u.blacklisted or not u.active:
        return jsonify({"error": "Your account has been deactivated"}), 403

    valid = verify_password(u_pwd, u.password)
    if not valid:
        return jsonify({"error": "Invalid email or password"}), 401

    login_user(u)
    user_roles = [role.name for role in u.roles]

    return jsonify({
        "message": "Login successful",
        "user_id": u.id,
        "name": u.name,
        "roles": user_roles
    })

@app.route("/api/sign-out")
def end_session():
    logout_user()
    return jsonify({"message": "Logged out successfully"})

@app.route("/api/current-user")
def get_active_profile():
    u = load_current_account()
    if not u:
        return jsonify({"error": "Not authenticated"}), 401

    user_roles = [role.name for role in u.roles]
    return jsonify({
        "user_id": u.id,
        "name": u.name,
        "email": u.email,
        "roles": user_roles
    })

@app.route("/api/admin-stats")
@roles_required("admin")
@cache.cached(timeout=30)
def get_admin_panel_stats():
    # count users with trekker and staff role
    clients_count = User.query.join(User.roles).filter(Role.name == "trekker").count()
    guides_count = User.query.join(User.roles).filter(Role.name == "staff").count()
    routes_count = Trek.query.count()
    bookings_count = Booking.query.count()

    return jsonify({
        "total_treks": routes_count,
        "total_users": clients_count,
        "total_staff": guides_count,
        "total_bookings": bookings_count
    })

@app.route("/api/adm-treks/list", methods=["GET"])
@roles_required("admin")
@cache.cached(timeout=30)
def get_trek_routes():
    all_treks = Trek.query.all()
    out = []
    for t in all_treks:
        staff_name = None
        if t.guide and t.guide.staff_account:
            staff_name = t.guide.staff_account.name
        
        out.append({
            "id": t.id,
            "title": t.title,
            "place": t.place,
            "level": t.level,
            "duration": t.duration,
            "max_slots": t.max_slots,
            "left_slots": t.left_slots,
            "status": t.status,
            "start_date": str(t.start_date),
            "end_date": str(t.end_date),
            "staff_id": t.staff_id,
            "guide_name": staff_name
        })
    return jsonify(out)

@app.route("/api/adm-treks/search", methods=["GET"])
@roles_required("admin")
def search_trek_routes():
    word = request.args.get("word", "")
    if not word:
        return jsonify([])
    
    matches = Trek.query.filter(
        or_(
            Trek.title.ilike("%" + word + "%"),
            Trek.place.ilike("%" + word + "%")
        )
    ).all()
    
    out = []
    for t in matches:
        staff_name = None
        if t.guide and t.guide.staff_account:
            staff_name = t.guide.staff_account.name
        
        out.append({
            "id": t.id,
            "title": t.title,
            "place": t.place,
            "level": t.level,
            "duration": t.duration,
            "max_slots": t.max_slots,
            "left_slots": t.left_slots,
            "status": t.status,
            "start_date": str(t.start_date),
            "end_date": str(t.end_date),
            "staff_id": t.staff_id,
            "guide_name": staff_name
        })
    return jsonify(out)

@app.route("/api/adm-treks/add", methods=["POST"])
@roles_required("admin")
def new_trek_route():
    data = request.get_json()
    if not data:
        return jsonify({"error": "json body is required"}), 400

    title = data.get("title")
    place = data.get("place")
    level = data.get("level")
    duration = data.get("duration")
    max_slots = data.get("max_slots")
    start_date = data.get("start_date")
    end_date = data.get("end_date")

    if not title or not place or not level or not duration or not max_slots or not start_date or not end_date:
        return jsonify({"error": "Missing required fields"}), 400

    try:
        parsed_start = date.fromisoformat(start_date)
        parsed_end = date.fromisoformat(end_date)
        duration = int(duration)
        max_slots = int(max_slots)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid date format or numeric fields."}), 400
    new_t = Trek(
        title=title,
        place=place,
        level=level,
        duration=duration,
        max_slots=max_slots,
        left_slots=max_slots,
        status="Pending",
        start_date=parsed_start,
        end_date=parsed_end,
        about=data.get("about", "")
    )
    db.session.add(new_t)
    db.session.commit()
    return jsonify({"message": "Trek created", "id": new_t.id}), 201

@app.route("/api/adm-treks/edit/<int:route_id>", methods=["PUT"])
@roles_required("admin")
def edit_trek_route(route_id):
    t = db.session.get(Trek, route_id)
    if not t:
        return jsonify({"error": "Trek not found"}), 404
    data = request.get_json()
    if not data:
        return jsonify({"error": "json body is required"}), 400
    if "title" in data: t.title = data["title"]
    if "place" in data: t.place = data["place"]
    if "level" in data: t.level = data["level"]
    if "duration" in data:
        try:
            t.duration = int(data["duration"])
        except (ValueError, TypeError):
            return jsonify({"error": "Duration must be a number"}), 400
    if "max_slots" in data:
        try:
            new_max = int(data["max_slots"])
        except (ValueError, TypeError):
            return jsonify({"error": "Max slots must be a number"}), 400
        booked = t.max_slots - t.left_slots
        if new_max < booked:
            return jsonify({"error": "Cannot reduce max slots below " + str(booked) + " (already booked)"}), 400
        diff = new_max - t.max_slots
        t.max_slots = new_max
        t.left_slots = max(0, t.left_slots + diff)
    if "start_date" in data:
        try:
            t.start_date = date.fromisoformat(data["start_date"])
        except ValueError:
            return jsonify({"error": "Invalid start date format"}), 400
    if "end_date" in data:
        try:
            t.end_date = date.fromisoformat(data["end_date"])
        except ValueError:
            return jsonify({"error": "Invalid end date format"}), 400
    if "about" in data: t.about = data["about"]
    db.session.commit()
    return jsonify({"message": "Trek updated", "id": t.id})

@app.route("/api/adm-treks/update-state/<int:route_id>", methods=["POST"])
@roles_required("admin")
def change_trek_state(route_id):
    t = db.session.get(Trek, route_id)
    if not t:
        return jsonify({"error": "Trek not found"}), 404

    data = request.get_json()
    if not data:
        return jsonify({"error": "json body required"}), 400

    new_status = data.get("status")
    if new_status not in ["Pending", "Open", "Closed", "Cancelled", "Ongoing", "Completed"]:
        return jsonify({"error": "Invalid status value"}), 400

    t.status = new_status
    db.session.commit()
    return jsonify({"message": "Trek status updated", "status": t.status})

@app.route("/api/adm-treks/remove/<int:route_id>", methods=["DELETE"])
@roles_required("admin")
def delete_trek_route(route_id):
    t = db.session.get(Trek, route_id)
    if not t:
        return jsonify({"error": "Trek not found"}), 404

    db.session.delete(t)
    db.session.commit()
    return jsonify({"message": "Trek deleted"})

@app.route("/api/adm-guides/list", methods=["GET"])
@roles_required("admin")
@cache.cached(timeout=30)
def get_guides_profiles():
    guides = StaffInfo.query.all()
    out = []
    for g in guides:
        out.append({
            "guide_profile_id": g.id,
            "user_id": g.user_id,
            "name": g.staff_account.name,
            "email": g.staff_account.email,
            "mobile": g.staff_account.mobile or "",
            "info": g.info,
            "exp_years": g.exp_years,
            "skills": g.skills,
            "state": g.state,
            "blacklisted": g.staff_account.blacklisted
        })
    return jsonify(out)

@app.route("/api/adm-guides/search", methods=["GET"])
@roles_required("admin")
def search_guides_profiles():
    word = request.args.get("word", "")
    if not word:
        return jsonify([])
    
    matches = StaffInfo.query.join(User).filter(
        or_(
            User.name.ilike("%" + word + "%"),
            User.email.ilike("%" + word + "%")
        )
    ).all()
    
    out = []
    for g in matches:
        out.append({
            "guide_profile_id": g.id,
            "user_id": g.user_id,
            "name": g.staff_account.name,
            "email": g.staff_account.email,
            "mobile": g.staff_account.mobile or "",
            "info": g.info,
            "exp_years": g.exp_years,
            "skills": g.skills,
            "state": g.state,
            "blacklisted": g.staff_account.blacklisted
        })
    return jsonify(out)

@app.route("/api/adm-guides/new", methods=["POST"])
@roles_required("admin")
def create_new_guide():
    data = request.get_json()
    if not data:
        return jsonify({"error": "json body required"}), 400

    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    mobile = data.get("mobile")
    exp_years = data.get("exp_years", "")
    skills = data.get("skills", "")
    info = data.get("info", "")

    if not name or not email or not password:
        return jsonify({"error": "Name, email and password are required"}), 400

    existing = user_store.find_user(email=email)
    if existing:
        return jsonify({"error": "Email is already registered"}), 400

    new_u = user_store.create_user(
        email=email,
        password=hash_password(password),
        name=name,
        mobile=mobile,
        active=True
    )
    staff_r = user_store.find_role("staff")
    user_store.add_role_to_user(new_u, staff_r)
    db.session.commit()

    profile = StaffInfo(
        user_id=new_u.id,
        info=info,
        exp_years=exp_years,
        skills=skills,
        state="Active"
    )
    db.session.add(profile)
    db.session.commit()

    return jsonify({"message": "Staff created", "user_id": new_u.id, "profile_id": profile.id}), 201

@app.route("/api/adm-guides/assign-route/<int:guide_id>/<int:route_id>", methods=["POST"])
@roles_required("admin")
def assign_guide_to_route(guide_id, route_id):
    g = db.session.get(StaffInfo, guide_id)
    t = db.session.get(Trek, route_id)

    if not g or not t:
        return jsonify({"error": "Guide or Trek not found"}), 404

    if g.staff_account.blacklisted or g.state != "Active":
        return jsonify({"error": "Selected guide is inactive or blocked"}), 400

    t.staff_id = g.id
    db.session.commit()
    return jsonify({"message": "Guide assigned to trek route"})

@app.route("/api/adm-guides/block/<int:guide_id>", methods=["POST"])
@roles_required("admin")
def restrict_guide_account(guide_id):
    g = db.session.get(StaffInfo, guide_id)
    if not g:
        return jsonify({"error": "Guide not found"}), 404

    g.staff_account.blacklisted = True
    g.state = "Inactive"
    db.session.commit()
    return jsonify({"message": "Guide has been blocked"})

@app.route("/api/adm-guides/unblock/<int:guide_id>", methods=["POST"])
@roles_required("admin")
def restore_guide_account(guide_id):
    g = db.session.get(StaffInfo, guide_id)
    if not g:
        return jsonify({"error": "Guide not found"}), 404

    g.staff_account.blacklisted = False
    g.state = "Active"
    db.session.commit()
    return jsonify({"message": "Guide reactivated"})

@app.route("/api/adm-clients/list", methods=["GET"])
@roles_required("admin")
@cache.cached(timeout=30)
def get_clients_profiles():
    clients = User.query.join(User.roles).filter(Role.name == "trekker").all()
    out = []
    for c in clients:
        out.append({
            "user_id": c.id,
            "name": c.name,
            "email": c.email,
            "mobile": c.mobile,
            "blacklisted": c.blacklisted
        })
    return jsonify(out)

@app.route("/api/adm-clients/search", methods=["GET"])
@roles_required("admin")
def search_clients_profiles():
    word = request.args.get("word", "")
    if not word:
        return jsonify([])
    
    matches = User.query.join(User.roles).filter(
        Role.name == "trekker"
    ).filter(
        or_(
            User.name.ilike("%" + word + "%"),
            User.email.ilike("%" + word + "%")
        )
    ).all()
    
    out = []
    for c in matches:
        out.append({
            "user_id": c.id,
            "name": c.name,
            "email": c.email,
            "mobile": c.mobile,
            "blacklisted": c.blacklisted
        })
    return jsonify(out)

@app.route("/api/adm-clients/block/<int:client_id>", methods=["POST"])
@roles_required("admin")
def restrict_client_account(client_id):
    c = db.session.get(User, client_id)
    if not c:
        return jsonify({"error": "Client not found"}), 404

    c.blacklisted = True
    db.session.commit()
    return jsonify({"message": "Client has been blocked"})

@app.route("/api/adm-clients/unblock/<int:client_id>", methods=["POST"])
@roles_required("admin")
def restore_client_account(client_id):
    c = db.session.get(User, client_id)
    if not c:
        return jsonify({"error": "Client not found"}), 404

    c.blacklisted = False
    db.session.commit()
    return jsonify({"message": "Client unblocked"})

@app.route("/api/adm-clients/remove/<int:client_id>", methods=["DELETE"])
@roles_required("admin")
def delete_client_account(client_id):
    c = db.session.get(User, client_id)
    if not c:
        return jsonify({"error": "Client not found"}), 404

    if any(role.name == "admin" for role in c.roles):
        return jsonify({"error": "Admin cannot be deleted"}), 400

    db.session.delete(c)
    db.session.commit()
    return jsonify({"message": "Client deleted"})

# Staff module endpoints
@app.route("/api/staff-panel/summary")
@roles_required("staff")
def staff_home_data():
    u = load_current_account()
    if not u:
        return jsonify({"error": "Not authenticated"}), 401
    staff_prof = StaffInfo.query.filter_by(user_id=u.id).first()
    if not staff_prof:
        return jsonify({"error": "No staff profile"}), 404
    my_treks = Trek.query.filter_by(staff_id=staff_prof.id).all()
    total_treks = len(my_treks)
    total_parts = 0
    live_count = 0
    for t in my_treks:
        cnt = Booking.query.filter_by(trek_id=t.id).count()
        total_parts = total_parts + cnt
        if t.status == "Ongoing":
            live_count = live_count + 1
    return jsonify({
        "assigned_count": total_treks,
        "participant_count": total_parts,
        "active_treks": live_count,
        "staff_name": u.name
    })

@app.route("/api/staff-panel/routes")
@roles_required("staff")
def staff_route_list():
    u = load_current_account()
    if not u:
        return jsonify({"error": "Not authenticated"}), 401
    staff_prof = StaffInfo.query.filter_by(user_id=u.id).first()
    if not staff_prof:
        return jsonify({"error": "No staff profile"}), 404
    my_treks = Trek.query.filter_by(staff_id=staff_prof.id).all()
    out = []
    for t in my_treks:
        reg_count = Booking.query.filter_by(trek_id=t.id).count()
        out.append({
            "id": t.id,
            "title": t.title,
            "place": t.place,
            "level": t.level,
            "duration": t.duration,
            "max_slots": t.max_slots,
            "left_slots": t.left_slots,
            "status": t.status,
            "start_date": str(t.start_date),
            "end_date": str(t.end_date),
            "registered": reg_count
        })
    return jsonify(out)

@app.route("/api/staff-panel/routes/<int:route_id>")
@roles_required("staff")
def staff_route_detail(route_id):
    u = load_current_account()
    if not u:
        return jsonify({"error": "Not authenticated"}), 401
    staff_prof = StaffInfo.query.filter_by(user_id=u.id).first()
    if not staff_prof:
        return jsonify({"error": "No staff profile"}), 404
    t = Trek.query.filter_by(id=route_id, staff_id=staff_prof.id).first()
    if not t:
        return jsonify({"error": "Trek not found or not assigned to you"}), 404
    part_list = []
    all_bookings = Booking.query.filter_by(trek_id=t.id).all()
    for b in all_bookings:
        part_list.append({
            "book_id": b.id,
            "user_name": b.customer.name if b.customer else "Unknown",
            "email": b.customer.email if b.customer else "",
            "phone": b.customer.mobile if b.customer else "",
            "slots": b.qty,
            "book_status": b.status,
            "pay_status": b.pay_status
        })
    return jsonify({
        "id": t.id,
        "title": t.title,
        "place": t.place,
        "level": t.level,
        "duration": t.duration,
        "max_slots": t.max_slots,
        "left_slots": t.left_slots,
        "status": t.status,
        "start_date": str(t.start_date),
        "end_date": str(t.end_date),
        "about": t.about,
        "participants": part_list
    })

@app.route("/api/staff-panel/routes/<int:route_id>/change-status", methods=["POST"])
@roles_required("staff")
def staff_update_route_state(route_id):
    u = load_current_account()
    if not u:
        return jsonify({"error": "Not authenticated"}), 401
    staff_prof = StaffInfo.query.filter_by(user_id=u.id).first()
    if not staff_prof:
        return jsonify({"error": "No staff profile"}), 404
    t = Trek.query.filter_by(id=route_id, staff_id=staff_prof.id).first()
    if not t:
        return jsonify({"error": "Trek not found or not assigned"}), 404
    data = request.get_json()
    if not data:
        return jsonify({"error": "json body needed"}), 400
    new_st = data.get("status")
    allowed_list = ["Open", "Closed", "Ongoing"]
    if new_st not in allowed_list:
        return jsonify({"error": "Status not allowed"}), 400
    t.status = new_st
    db.session.commit()
    return jsonify({"message": "Status changed", "new_status": t.status})

@app.route("/api/staff-panel/routes/<int:route_id>/adjust-slots", methods=["POST"])
@roles_required("staff")
def staff_update_slots(route_id):
    u = load_current_account()
    if not u:
        return jsonify({"error": "Not authenticated"}), 401
    staff_prof = StaffInfo.query.filter_by(user_id=u.id).first()
    if not staff_prof:
        return jsonify({"error": "No staff profile"}), 404
    t = Trek.query.filter_by(id=route_id, staff_id=staff_prof.id).first()
    if not t:
        return jsonify({"error": "Trek not found or not assigned"}), 404
    data = request.get_json()
    if not data:
        return jsonify({"error": "json body needed"}), 400
    new_slots = data.get("slots")
    if new_slots is None:
        return jsonify({"error": "Send slots value"}), 400
    try:
        new_slots = int(new_slots)
    except (ValueError, TypeError):
        return jsonify({"error": "Slots must be a number"}), 400
    if new_slots > t.max_slots:
        return jsonify({"error": "Cannot exceed max slots"}), 400
    if new_slots < 0:
        return jsonify({"error": "Slots cannot be negative"}), 400
    t.left_slots = new_slots
    db.session.commit()
    return jsonify({"message": "Slots updated", "left_slots": t.left_slots})

@app.route("/api/staff-panel/routes/<int:route_id>/mark-done", methods=["POST"])
@roles_required("staff")
def staff_finish_trek(route_id):
    u = load_current_account()
    if not u:
        return jsonify({"error": "Not authenticated"}), 401
    staff_prof = StaffInfo.query.filter_by(user_id=u.id).first()
    if not staff_prof:
        return jsonify({"error": "No staff profile"}), 404
    t = Trek.query.filter_by(id=route_id, staff_id=staff_prof.id).first()
    if not t:
        return jsonify({"error": "Trek not found or not assigned"}), 404
    t.status = "Completed"
    active_bookings = Booking.query.filter_by(trek_id=t.id, status="Booked").all()
    for b in active_bookings:
        b.status = "Completed"
    db.session.commit()
    return jsonify({"message": "Trek completed", "bookings_updated": len(active_bookings)})

# Trekker module endpoints
@app.route("/api/trekker/home")
@roles_required("trekker")
def trekker_home():
    u = load_current_account()
    if not u:
        return jsonify({"error": "Not authenticated"}), 401
    open_treks = Trek.query.filter(Trek.status == "Open", Trek.left_slots > 0).all()
    route_list = []
    for t in open_treks:
        route_list.append({
            "id": t.id,
            "title": t.title,
            "place": t.place,
            "level": t.level,
            "duration": t.duration,
            "left_slots": t.left_slots,
            "max_slots": t.max_slots,
            "start_date": str(t.start_date),
            "end_date": str(t.end_date)
        })
    my_reservations = Booking.query.filter_by(user_id=u.id).all()
    trip_list = []
    for b in my_reservations:
        trip_list.append({
            "book_id": b.id,
            "trek_title": b.trip.title if b.trip else "",
            "start_date": str(b.trip.start_date) if b.trip else "",
            "end_date": str(b.trip.end_date) if b.trip else "",
            "slots_booked": b.qty,
            "status": b.status,
            "pay_status": b.pay_status
        })
    return jsonify({
        "open_routes": route_list,
        "my_trips": trip_list,
        "user_name": u.name
    })

@app.route("/api/trekker/explore")
@roles_required("trekker")
def trekker_explore():
    q = Trek.query.filter(Trek.status == "Open", Trek.left_slots > 0)
    diff_filter = request.args.get("difficulty")
    place_filter = request.args.get("location")
    dur_filter = request.args.get("duration")
    if diff_filter and diff_filter != "All":
        q = q.filter(Trek.level == diff_filter)
    if place_filter and place_filter != "All":
        q = q.filter(Trek.place.ilike("%" + place_filter + "%"))
    if dur_filter and dur_filter != "All":
        try:
            dur_filter = int(dur_filter)
        except (ValueError, TypeError):
            return jsonify({"error": "Duration filter must be a number"}), 400
        q = q.filter(Trek.duration == dur_filter)
    results = q.all()
    out = []
    for t in results:
        out.append({
            "id": t.id,
            "title": t.title,
            "place": t.place,
            "level": t.level,
            "duration": t.duration,
            "left_slots": t.left_slots,
            "max_slots": t.max_slots,
            "start_date": str(t.start_date),
            "end_date": str(t.end_date),
            "about": t.about
        })
    return jsonify(out)

@app.route("/api/trekker/treks/<int:route_id>")
@roles_required("trekker")
@cache.cached(timeout=30)
def trekker_route_view(route_id):
    t = db.session.get(Trek, route_id)
    if not t:
        return jsonify({"error": "Not found"}), 404
    return jsonify({
        "id": t.id,
        "title": t.title,
        "place": t.place,
        "level": t.level,
        "duration": t.duration,
        "left_slots": t.left_slots,
        "max_slots": t.max_slots,
        "status": t.status,
        "start_date": str(t.start_date),
        "end_date": str(t.end_date),
        "about": t.about
    })

@app.route("/api/trekker/reserve", methods=["POST"])
@roles_required("trekker")
def trekker_make_reservation():
    u = load_current_account()
    if not u:
        return jsonify({"error": "Not authenticated"}), 401
    data = request.get_json()
    if not data:
        return jsonify({"error": "json body required"}), 400
    route_id = data.get("trek_id")
    seat_count = data.get("seats", 1)
    if not route_id:
        return jsonify({"error": "trek_id needed"}), 400
    try:
        seat_count = int(seat_count)
    except (ValueError, TypeError):
        return jsonify({"error": "seats must be a number"}), 400
    if seat_count < 1:
        return jsonify({"error": "At least 1 seat"}), 400
    t = db.session.get(Trek, route_id)
    if not t:
        return jsonify({"error": "Trek not found"}), 404
    if t.status != "Open":
        return jsonify({"error": "Trek is not open for booking"}), 400
    if t.left_slots < seat_count:
        return jsonify({"error": "Not enough seats available"}), 400
    existing = Booking.query.filter_by(user_id=u.id, trek_id=route_id).first()
    if existing:
        if existing.status == "Booked":
            new_qty = existing.qty + seat_count
            if new_qty > t.left_slots + existing.qty:
                return jsonify({"error": "Not enough seats available"}), 400
            existing.qty = new_qty
            existing.book_time = datetime.utcnow()
            t.left_slots = t.left_slots - seat_count
            if t.left_slots == 0:
                t.status = "Closed"
            db.session.commit()
            return jsonify({"message": "Extra seats added", "book_id": existing.id, "slots": new_qty}), 200
        if existing.status == "Completed":
            return jsonify({"error": "This trek is already completed"}), 400
        if existing.status == "Cancelled":
            existing.status = "Booked"
            existing.qty = seat_count
            existing.book_time = datetime.utcnow()
            existing.cancel_time = None
            existing.pay_status = "Paid"
            t.left_slots = t.left_slots - seat_count
            if t.left_slots == 0:
                t.status = "Closed"
            db.session.commit()
            return jsonify({"message": "Re-booking successful", "book_id": existing.id, "slots": seat_count}), 201
    booking = Booking(
        user_id=u.id,
        trek_id=route_id,
        qty=seat_count,
        status="Booked",
        pay_status="Paid"
    )
    db.session.add(booking)
    t.left_slots = t.left_slots - seat_count
    if t.left_slots == 0:
        t.status = "Closed"
    db.session.commit()
    return jsonify({"message": "Booking confirmed", "book_id": booking.id, "slots": seat_count}), 201

@app.route("/api/trekker/my-trips")
@roles_required("trekker")
def trekker_my_trips():
    u = load_current_account()
    if not u:
        return jsonify({"error": "Not authenticated"}), 401
    bookings = Booking.query.filter_by(user_id=u.id).order_by(Booking.book_time.desc()).all()
    out = []
    for b in bookings:
        out.append({
            "book_id": b.id,
            "trek_id": b.trek_id,
            "trek_title": b.trip.title if b.trip else "",
            "place": b.trip.place if b.trip else "",
            "start_date": str(b.trip.start_date) if b.trip else "",
            "end_date": str(b.trip.end_date) if b.trip else "",
            "slots": b.qty,
            "book_time": str(b.book_time),
            "status": b.status,
            "pay_status": b.pay_status,
            "cancel_time": str(b.cancel_time) if b.cancel_time else None
        })
    return jsonify(out)

@app.route("/api/trekker/cancel/<int:book_id>", methods=["POST"])
@roles_required("trekker")
def trekker_withdraw(book_id):
    u = load_current_account()
    if not u:
        return jsonify({"error": "Not authenticated"}), 401
    b = Booking.query.filter_by(id=book_id, user_id=u.id).first()
    if not b:
        return jsonify({"error": "Booking not found"}), 404
    if b.status != "Booked":
        return jsonify({"error": "Only active bookings can be cancelled"}), 400
    b.status = "Cancelled"
    b.cancel_time = datetime.utcnow()
    t = db.session.get(Trek, b.trek_id)
    if t:
        t.left_slots = t.left_slots + b.qty
        if t.status == "Closed" and t.left_slots > 0:
            t.status = "Open"
    db.session.commit()
    return jsonify({"message": "Booking cancelled"})

@app.route("/api/trekker/history")
@roles_required("trekker")
def trekker_past_trips():
    u = load_current_account()
    if not u:
        return jsonify({"error": "Not authenticated"}), 401
    bookings = Booking.query.filter_by(user_id=u.id).filter(
        Booking.status.in_(["Completed", "Cancelled"])
    ).order_by(Booking.book_time.desc()).all()
    out = []
    for b in bookings:
        out.append({
            "book_id": b.id,
            "trek_title": b.trip.title if b.trip else "",
            "place": b.trip.place if b.trip else "",
            "start_date": str(b.trip.start_date) if b.trip else "",
            "end_date": str(b.trip.end_date) if b.trip else "",
            "slots": b.qty,
            "status": b.status,
            "book_time": str(b.book_time)
        })
    return jsonify(out)

@app.route("/api/trekker/account", methods=["GET", "PUT"])
@roles_required("trekker")
def trekker_account():
    u = load_current_account()
    if not u:
        return jsonify({"error": "Not authenticated"}), 401
    if request.method == "GET":
        return jsonify({
            "name": u.name,
            "email": u.email,
            "mobile": u.mobile or ""
        })
    data = request.get_json()
    if not data:
        return jsonify({"error": "json body required"}), 400
    new_name = data.get("name", "").strip()
    new_mobile = data.get("mobile", "").strip()
    if not new_name:
        return jsonify({"error": "Name cannot be empty"}), 400
    u.name = new_name
    u.mobile = new_mobile
    db.session.commit()
    return jsonify({"message": "Profile updated", "name": u.name, "mobile": u.mobile})

@app.route("/api/adm-bookings/all")
@roles_required("admin")
@cache.cached(timeout=30)
def get_all_client_bookings():
    bookings = Booking.query.all()
    out = []
    for b in bookings:
        out.append({
            "id": b.id,
            "user_id": b.user_id,
            "client_name": b.customer.name if b.customer else None,
            "trek_id": b.trek_id,
            "trek_title": b.trip.title if b.trip else None,
            "book_time": str(b.book_time),
            "status": b.status,
            "pay_status": b.pay_status,
            "qty": b.qty
        })
    return jsonify(out)

# Health check endpoints
@app.route("/api/health-pulse")
def health_check():
    return jsonify({"status": "alive", "service": "Trekking App V2"})


@app.route("/api/db-audit")
def db_audit():
    user_count = User.query.count()
    role_count = Role.query.count()
    staff_count = StaffInfo.query.count()
    trek_count = Trek.query.count()
    book_count = Booking.query.count()
    return jsonify({
        "users": user_count,
        "roles": role_count,
        "staff_profiles": staff_count,
        "treks": trek_count,
        "bookings": book_count
    })


# Staff profile and password
@app.route("/api/staff-detail", methods=["GET", "PUT"])
@roles_required("staff")
def staff_detail():
    u = load_current_account()
    if not u:
        return jsonify({"error": "Not authenticated"}), 401
    prof = StaffInfo.query.filter_by(user_id=u.id).first()
    if request.method == "GET":
        if not prof:
            return jsonify({"error": "Staff profile not found"}), 404
        return jsonify({
            "name": u.name,
            "email": u.email,
            "mobile": u.mobile or "",
            "experience": prof.exp_years or "",
            "skills": prof.skills or "",
            "information": prof.info or ""
        })
    data = request.get_json()
    if not data:
        return jsonify({"error": "json body required"}), 400
    u.name = data.get("name", u.name)
    u.mobile = data.get("mobile", u.mobile or "")
    if prof:
        prof.exp_years = data.get("experience", prof.exp_years or "")
        prof.skills = data.get("skills", prof.skills or "")
        prof.info = data.get("information", prof.info or "")
    db.session.commit()
    return jsonify({"message": "Profile updated"})


@app.route("/api/staff-change-key", methods=["POST"])
@roles_required("staff")
def staff_change_key():
    u = load_current_account()
    if not u:
        return jsonify({"error": "Not authenticated"}), 401
    data = request.get_json()
    if not data:
        return jsonify({"error": "json body required"}), 400
    old_pass = data.get("old_password", "")
    new_pass = data.get("new_password", "")
    if not old_pass or not new_pass:
        return jsonify({"error": "Both old and new password required"}), 400
    if len(new_pass) < 4:
        return jsonify({"error": "New password must be at least 4 characters"}), 400
    if not verify_password(old_pass, u.password):
        return jsonify({"error": "Old password is incorrect"}), 403
    u.password = hash_password(new_pass)
    db.session.commit()
    return jsonify({"message": "Password changed successfully"})


# Trekker password change
@app.route("/api/trekker/change-passcode", methods=["POST"])
@roles_required("trekker")
def trekker_change_passcode():
    u = load_current_account()
    if not u:
        return jsonify({"error": "Not authenticated"}), 401
    data = request.get_json()
    if not data:
        return jsonify({"error": "json body required"}), 400
    old_pass = data.get("old_password", "")
    new_pass = data.get("new_password", "")
    if not old_pass or not new_pass:
        return jsonify({"error": "Both old and new password required"}), 400
    if len(new_pass) < 4:
        return jsonify({"error": "New password must be at least 4 characters"}), 400
    if not verify_password(old_pass, u.password):
        return jsonify({"error": "Old password is incorrect"}), 403
    u.password = hash_password(new_pass)
    db.session.commit()
    return jsonify({"message": "Password changed successfully"})


# Test email endpoints
@app.route("/api/probe-mail")
def probe_mail():
    from tasks import send_email
    try:
        admin_user = User.query.join(User.roles).filter(Role.name == "admin").first()
        to_addr = admin_user.email if admin_user else Config.MAIL_USERNAME
        send_email(to_addr, "Test from Trekking App", "This is a test email from the trekking application.")
        return jsonify({"message": "Test email sent to " + to_addr})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/async-probe-mail")
def async_probe_mail():
    from tasks import send_async_test
    job = send_async_test.delay()
    return jsonify({"message": "Async test email queued", "task_id": job.id})


# Task trigger endpoints
@app.route("/api/tasks/trigger-reminder")
@roles_required("admin")
def trigger_daily_reminder():
    from tasks import notify_upcoming_treks
    job = notify_upcoming_treks.delay()
    return jsonify({"message": "Reminder task started", "task_id": job.id})

@app.route("/api/tasks/trigger-report")
@roles_required("admin")
def trigger_monthly_report():
    from tasks import generate_monthly_summary
    job = generate_monthly_summary.delay()
    return jsonify({"message": "Report task started", "task_id": job.id})

@app.route("/api/tasks/export-csv")
@roles_required("trekker")
def trigger_csv_export():
    u = load_current_account()
    if not u:
        return jsonify({"error": "Not authenticated"}), 401
    from tasks import write_bookings_csv
    job = write_bookings_csv.delay(u.id)
    return jsonify({"message": "CSV export started", "task_id": job.id}), 202

@app.route("/api/tasks/status/<task_id>")
def task_progress(task_id):
    job = AsyncResult(task_id, app=celery)
    result = job.result
    if not isinstance(result, (dict, list, str, int, float, bool, type(None))):
        try:
            result = str(result)
        except Exception:
            result = "unreadable result"
    return jsonify({
        "task_id": job.id,
        "state": job.state,
        "result": result
    })

if __name__ == "__main__":
    with app.app_context():
        db.create_all()

        roles_list = ["admin", "staff", "trekker"]
        for role_name in roles_list:
            existing_role = user_store.find_role(role_name)
            if not existing_role:
                user_store.create_role(name=role_name, desc=role_name + " role")
        db.session.commit()

        admin_email = "head@peakventure.com"
        existing_admin = user_store.find_user(email=admin_email)
        if not existing_admin:
            admin_user = user_store.create_user(
                email=admin_email,
                password=hash_password("peak@2026"),
                name="Head Admin",
                mobile="9876543210",
                active=True
            )
            admin_role = user_store.find_role("admin")
            user_store.add_role_to_user(admin_user, admin_role)
            db.session.commit()
            print("Default admin seeded: head@peakventure.com / peak@2026")

        sample_staff_email = "guide@peakventure.com"
        existing_guide = user_store.find_user(email=sample_staff_email)
        if not existing_guide:
            guide_user = user_store.create_user(
                email=sample_staff_email,
                password=hash_password("guide@2026"),
                name="Arjun Rawat",
                mobile="9988776655",
                active=True
            )
            staff_role = user_store.find_role("staff")
            user_store.add_role_to_user(guide_user, staff_role)
            db.session.commit()

            guide_profile = StaffInfo(
                user_id=guide_user.id,
                info="Experienced mountain guide from Uttarakhand",
                exp_years="5",
                skills="Rock Climbing, Navigation, First Aid"
            )
            db.session.add(guide_profile)
            db.session.commit()
            print("Demo guide seeded: guide@peakventure.com / guide@2026")

        if Trek.query.count() == 0:
            from datetime import timedelta
            sample_trek = Trek(
                title="Valley of Flowers Expedition",
                place="Uttarakhand",
                level="Moderate",
                duration=6,
                max_slots=15,
                left_slots=15,
                status="Open",
                start_date=date.today() + timedelta(days=14),
                end_date=date.today() + timedelta(days=20),
                about="A breathtaking trek through the famous Valley of Flowers, a UNESCO World Heritage site. Experience alpine flowers, glaciers, and panoramic mountain views."
            )
            db.session.add(sample_trek)
            db.session.commit()
            print("Demo trek seeded: Valley of Flowers Expedition (Open, starting in 14 days)")
    app.run(debug=True)
