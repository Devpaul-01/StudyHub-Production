from app import create_app
from extensions import db

app, scheduler = create_app()  # unpack whatever create_app actually returns

with app.app_context():
    from models import User
    users = User.query.all()
    for user in users:
        print(user.email, user.username)