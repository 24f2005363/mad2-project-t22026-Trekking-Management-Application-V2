from datetime import datetime
from flask import Flask, jsonify, request, render_template, make_response
from flask_security import Security, SQLAlchemyUserDatastore, roles_required, current_user
from flask_security.utils import hash_password, verify_password, login_user, logout_user
from models import db, User, Role, Trek, Booking, StaffInfo

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

if __name__ == "__main__":
    app.run(debug=True)
