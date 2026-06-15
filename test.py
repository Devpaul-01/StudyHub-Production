from models import User
from app import create_app
app = create_app()
with app.app_context():
    user1 = User.query.get(1)
    print(user1.username)