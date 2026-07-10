from datetime import date, datetime
from flask import Flask, jsonify, request, render_template, make_response
from flask_security import Security, SQLAlchemyUserDatastore, roles_required, current_user
from flask_security.utils import hash_password, verify_password, login_user, logout_user
from models import db, User, Role, Trek, Booking, StaffInfo
from sqlalchemy import or_
from config import Config
from celery_setup import make_celery
from celery.result import AsyncResult

app = Flask(__name__)
app.config.from_object(Config)

db.init_app(app)

celery = make_celery(app)

# Flask security datastore
user_store = SQLAlchemyUserDatastore(db, User, Role)
security = Security(app, user_store)

# Helper to verify logged-in user
def check_user_session():
    if not current_user.is_authenticated:
        return None
    db_user = db.session.get(User, current_user.id)
    if not db_user:
        logout_user()
        return None
    if db_user.blacklisted or not db_user.active:
        logout_user()
        return None
    return db_user

@app.before_request
def check_active_user():
    if current_user.is_authenticated:
        db_user = db.session.get(User, current_user.id)
        if not db_user or db_user.blacklisted or not db_user.active:
            logout_user()
            return make_response(jsonify({"error": "invalid user session"}), 401)

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
    u = check_user_session()
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
def get_trek_routes():
    all_treks = Trek.query.all()
    out = []
    for t in all_treks:
        staff_name = None
        if t.assigned_staff and t.assigned_staff.user:
            staff_name = t.assigned_staff.user.name
        
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
            "assigned_staff_name": staff_name
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
        if t.assigned_staff and t.assigned_staff.user:
            staff_name = t.assigned_staff.user.name
        
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
            "assigned_staff_name": staff_name
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

    new_t = Trek(
        title=title,
        place=place,
        level=level,
        duration=int(duration),
        max_slots=int(max_slots),
        left_slots=int(max_slots),
        status="Pending",
        start_date=date.fromisoformat(start_date),
        end_date=date.fromisoformat(end_date),
        about=data.get("about", "")
    )
    db.session.add(new_t)
    db.session.commit()
    return jsonify({"message": "Trek created", "id": new_t.id}), 201

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
def get_guides_profiles():
    guides = StaffInfo.query.all()
    out = []
    for g in guides:
        out.append({
            "guide_profile_id": g.id,
            "user_id": g.user_id,
            "name": g.user.name,
            "email": g.user.email,
            "info": g.info,
            "exp_years": g.exp_years,
            "skills": g.skills,
            "state": g.state,
            "blacklisted": g.user.blacklisted
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
            "name": g.user.name,
            "email": g.user.email,
            "info": g.info,
            "exp_years": g.exp_years,
            "skills": g.skills,
            "state": g.state,
            "blacklisted": g.user.blacklisted
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

    if g.user.blacklisted or g.state != "Active":
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

    g.user.blacklisted = True
    g.state = "Inactive"
    db.session.commit()
    return jsonify({"message": "Guide has been blocked"})

@app.route("/api/adm-guides/unblock/<int:guide_id>", methods=["POST"])
@roles_required("admin")
def restore_guide_account(guide_id):
    g = db.session.get(StaffInfo, guide_id)
    if not g:
        return jsonify({"error": "Guide not found"}), 404

    g.user.blacklisted = False
    g.state = "Active"
    db.session.commit()
    return jsonify({"message": "Guide reactivated"})

@app.route("/api/adm-clients/list", methods=["GET"])
@roles_required("admin")
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
    u = check_user_session()
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
    u = check_user_session()
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
    u = check_user_session()
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
            "user_name": b.user.name if b.user else "Unknown",
            "email": b.user.email if b.user else "",
            "phone": b.user.mobile if b.user else "",
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
    u = check_user_session()
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
    u = check_user_session()
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
    if int(new_slots) > t.max_slots:
        return jsonify({"error": "Cannot exceed max slots"}), 400
    if int(new_slots) < 0:
        return jsonify({"error": "Slots cannot be negative"}), 400
    t.left_slots = int(new_slots)
    db.session.commit()
    return jsonify({"message": "Slots updated", "left_slots": t.left_slots})

@app.route("/api/staff-panel/routes/<int:route_id>/mark-done", methods=["POST"])
@roles_required("staff")
def staff_finish_trek(route_id):
    u = check_user_session()
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
    u = check_user_session()
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
            "trek_title": b.trek.title if b.trek else "",
            "start_date": str(b.trek.start_date) if b.trek else "",
            "end_date": str(b.trek.end_date) if b.trek else "",
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
        q = q.filter(Trek.duration == int(dur_filter))
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
    u = check_user_session()
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
    except:
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
            return jsonify({"error": "You already have a booking for this trek"}), 400
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
    u = check_user_session()
    if not u:
        return jsonify({"error": "Not authenticated"}), 401
    bookings = Booking.query.filter_by(user_id=u.id).order_by(Booking.book_time.desc()).all()
    out = []
    for b in bookings:
        out.append({
            "book_id": b.id,
            "trek_id": b.trek_id,
            "trek_title": b.trek.title if b.trek else "",
            "place": b.trek.place if b.trek else "",
            "start_date": str(b.trek.start_date) if b.trek else "",
            "end_date": str(b.trek.end_date) if b.trek else "",
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
    u = check_user_session()
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
    u = check_user_session()
    if not u:
        return jsonify({"error": "Not authenticated"}), 401
    bookings = Booking.query.filter_by(user_id=u.id).filter(
        Booking.status.in_(["Completed", "Cancelled"])
    ).order_by(Booking.book_time.desc()).all()
    out = []
    for b in bookings:
        out.append({
            "book_id": b.id,
            "trek_title": b.trek.title if b.trek else "",
            "place": b.trek.place if b.trek else "",
            "start_date": str(b.trek.start_date) if b.trek else "",
            "end_date": str(b.trek.end_date) if b.trek else "",
            "slots": b.qty,
            "status": b.status,
            "book_time": str(b.book_time)
        })
    return jsonify(out)

@app.route("/api/trekker/account", methods=["GET", "PUT"])
@roles_required("trekker")
def trekker_account():
    u = check_user_session()
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
def get_all_client_bookings():
    bookings = Booking.query.all()
    out = []
    for b in bookings:
        out.append({
            "id": b.id,
            "user_id": b.user_id,
            "client_name": b.user.name if b.user else None,
            "trek_id": b.trek_id,
            "trek_title": b.trek.title if b.trek else None,
            "book_time": str(b.book_time),
            "status": b.status,
            "pay_status": b.pay_status,
            "qty": b.qty
        })
    return jsonify(out)

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
    u = check_user_session()
    if not u:
        return jsonify({"error": "Not authenticated"}), 401
    from tasks import write_bookings_csv
    job = write_bookings_csv.delay(u.id)
    return jsonify({"message": "CSV export started", "task_id": job.id}), 202

@app.route("/api/tasks/status/<task_id>")
def task_progress(task_id):
    job = AsyncResult(task_id, app=celery)
    return jsonify({
        "task_id": job.id,
        "state": job.state,
        "result": job.result
    })

if __name__ == "__main__":
    with app.app_context():
        from models import db
        db.create_all()
    app.run(debug=True)
