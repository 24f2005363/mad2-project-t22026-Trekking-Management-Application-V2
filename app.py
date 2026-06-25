from datetime import date, datetime
from flask import Flask, jsonify, request, render_template, make_response
from flask_security import Security, SQLAlchemyUserDatastore, roles_required, current_user
from flask_security.utils import hash_password, verify_password, login_user, logout_user
from models import db, User, Role, Trek, Booking, StaffInfo
from sqlalchemy import or_

app = Flask(__name__)

# Basic student-like configs
app.config["SECRET_KEY"] = "private_trekker_portal_key"
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///trek.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SECURITY_PASSWORD_SALT"] = "private_trekker_portal_salt"
app.config["SECURITY_PASSWORD_HASH"] = "bcrypt"
app.config["SECURITY_REGISTERABLE"] = False
app.config["SECURITY_SEND_REGISTER_EMAIL"] = False
app.config["WTF_CSRF_ENABLED"] = False

db.init_app(app)

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

if __name__ == "__main__":
    app.run(debug=True)
