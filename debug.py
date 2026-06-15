# debug_database.py
# Run this to check your database state
# debug_database.py
# Run this to check your database state

from app import create_app
from extensions import db
from models import User
app = create_app()
password = "scrypt:32768:8:1$hiyT1YRFmBHgKNoC$dff4e77474399c24cb9c8e98bde49a1b99597a049355039491b424e95e353c0da09c1656047e83c232e4e99b2397d81859b373e946cf8c6ee335cf148240c877"

with app.app_context():
    user = User(username="oluwaseyi",name="seyi", email="oluwaseyiogunsola90@gmail.com", pin=password, email_verified=True, status="approved")
    db.session.add(user)
    db.session.commit()
    print("Done")
    
    