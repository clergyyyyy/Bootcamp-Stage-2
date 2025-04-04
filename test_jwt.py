from utils.jwt import create_access_token, decode_access_token
from datetime import timedelta

user_data = {
    "id": 1,
    "name": "Alice",
    "email": "alice@example.com"
}

token = create_access_token(user_data, expires_delta=timedelta(seconds=10))
print("🔐 產生的 JWT Token：")
print(token)

decoded = decode_access_token(token)
print("\n✅ 解碼後的內容：")
print(decoded)
