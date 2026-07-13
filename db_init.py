from flask import Flask
from models import db, User, Role
from flask_security import SQLAlchemyUserDatastore, Security
from flask_security.utils import hash_password
from config import Config
import os

def init_database():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)

    user_store = SQLAlchemyUserDatastore(db, User, Role)
    Security(app, user_store)

    with app.app_context():
        db.create_all()

        roles_list = ["admin", "staff", "trekker"]
        for role_name in roles_list:
            existing_role = user_store.find_role(role_name)
            if not existing_role:
                user_store.create_role(name=role_name, desc=role_name + " role")
        db.session.commit()

        admin_email = os.environ.get("ADMIN_EMAIL", "head@peakventure.com")
        admin_pass = os.environ.get("ADMIN_PASSWORD", "peak@2026")
        existing_admin = user_store.find_user(email=admin_email)
        if not existing_admin:
            admin_user = user_store.create_user(
                email=admin_email,
                password=hash_password(admin_pass),
                name="Head Admin",
                mobile="9876543210",
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
