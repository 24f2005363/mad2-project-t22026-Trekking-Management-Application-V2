from flask import Flask
from models import db, User, Role
from flask_security import SQLAlchemyUserDatastore, Security
from flask_security.utils import hash_password

def init_database():
    app = Flask(__name__)
    
    # Inline configuration to avoid external file dependencies in this milestone
    app.config["SECRET_KEY"] = "student_trek_secret_key"
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///trek.db"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SECURITY_PASSWORD_SALT"] = "student_salt_key_value"
    app.config["SECURITY_PASSWORD_HASH"] = "bcrypt"
    app.config["WTF_CSRF_ENABLED"] = False

    db.init_app(app)

    # Setup Flask-Security datastore
    user_store = SQLAlchemyUserDatastore(db, User, Role)
    Security(app, user_store)

    with app.app_context():
        # Create database tables
        db.create_all()

        # Create roles
        roles_list = ["admin", "staff", "trekker"]
        for role_name in roles_list:
            existing_role = user_store.find_role(role_name)
            if not existing_role:
                user_store.create_role(name=role_name, desc=role_name + " role")
        db.session.commit()

        # Create pre-defined Admin user
        admin_email = "admin@tma.com"
        existing_admin = user_store.find_user(email=admin_email)
        if not existing_admin:
            admin_user = user_store.create_user(
                email=admin_email,
                password=hash_password("admin123"),
                name="Main Admin",
                mobile="9999999999",
                active=True
            )
            admin_role = user_store.find_role("admin")
            user_store.add_role_to_user(admin_user, admin_role)
            db.session.commit()
            print("Database created and admin user pre-populated!")
        else:
            print("Admin user already exists.")

if __name__ == "__main__":
    init_database()
