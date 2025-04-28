from fastapi import FastAPI, Path, Query, Request, Form
from fastapi.responses import FileResponse, JSONResponse
from fastapi import HTTPException
import mysql.connector
from dotenv import load_dotenv
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Depends
from utils.jwt import create_access_token, decode_access_token
import os
from pydantic import BaseModel
import traceback
from datetime import date as _date
import requests
from uuid import uuid4


app = FastAPI()
load_dotenv()
TAPPAY_PARTNER_KEY = os.getenv("TAPPAY_PARTNER_KEY")
TAPPAY_MERCHANT_ID = os.getenv("TAPPAY_MERCHANT_ID")

app.mount("/static", StaticFiles(directory="static"), name="static")

auth_scheme = HTTPBearer()


DB_CONFIG = {
    "host": os.getenv("DB_HOST"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "database": os.getenv("DB_NAME")
}

DB_HOST = os.getenv("DB_HOST")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_NAME = os.getenv("DB_NAME")

class SignupForm(BaseModel):
    name: str
    email: str
    password: str

class SigninForm(BaseModel):
    email: str
    password: str

class BookingForm(BaseModel):
    price: int
    attractionId: int
    date: str
    time: str

class Contact(BaseModel):
    name: str
    email: str
    phone: str

class InnerOrder(BaseModel):
    price: int
    attractionId: int
    date: str
    time: str
    contact: Contact

class OrderForm(BaseModel):
    prime: str
    order: InnerOrder

conn = mysql.connector.connect(
    host=DB_HOST,
    user=DB_USER,
    password=DB_PASSWORD,
    database=DB_NAME
)

# Static Pages (Never Modify Code in this Block)
@app.get("/", include_in_schema=False)
async def index(request: Request):
    return FileResponse("./static/index.html", media_type="text/html")

@app.get("/attraction/{id}", include_in_schema=False)
async def attraction(request: Request, id: int):
    return FileResponse("./static/attraction.html", media_type="text/html")

@app.get("/booking", include_in_schema=False)
async def booking(request: Request):
    return FileResponse("./static/booking.html", media_type="text/html")

@app.get("/thankyou", include_in_schema=False)
async def thankyou(request: Request):
    return FileResponse("./static/thankyou.html", media_type="text/html")

@app.get("/member", include_in_schema=False)
async def member(request: Request):
    return FileResponse("./static/member.html", media_type="text/html")

def get_member_by_email(email: str):
    query = "SELECT * FROM member WHERE username = %s"
    with mysql.connector.connect(**DB_CONFIG) as conn:
        with conn.cursor(dictionary=True) as cursor:
            cursor.execute(query, (email,))
            return cursor.fetchone()

def add_booking(price: int,
                attraction_id: int,
                member_id: int,
                date: str,
                time: str,
                *,
                status: int = 0):
    delete_sql = """
        DELETE FROM orders
        WHERE member_id = %s AND status = 0
    """

    insert_sql = """
        INSERT INTO orders
            (price, attraction_id, member_id, date, time, status)
        VALUES
            (%s,    %s,            %s,        %s,   %s,   %s)
    """
    params = (price, attraction_id, member_id, date, time, status)

    with mysql.connector.connect(**DB_CONFIG) as conn:
        with conn.cursor() as cur:
            cur.execute(delete_sql, (member_id,)) #刪舊的
            cur.execute(insert_sql, params) #加新的
            conn.commit()

def add_favorite(attraction_id: int,
                member_id: int):
    insert_sql = """
        INSERT INTO favorite
            (attraction_id, member_id)
        VALUES
            (%s,            %s)
    """
    params = (attraction_id, member_id)

    with mysql.connector.connect(**DB_CONFIG) as conn:
        with conn.cursor() as cur:
            cur.execute(insert_sql, params) #加新的
            conn.commit()

def remove_favorite(attraction_id: int,
                member_id: int):
    delete_sql = """
        DELETE FROM favorite WHERE attraction_id = %s AND member_id = %s
    """
    params = (attraction_id, member_id)

    with mysql.connector.connect(**DB_CONFIG) as conn:
        with conn.cursor() as cur:
            cur.execute(delete_sql, params)
            conn.commit()

def get_favorite_list(member_id):
    query = """
    SELECT a.id, a.name, a.category, a.description, a.address, a.mrt, GROUP_CONCAT(i.image_url) AS images
    FROM favorite f
    JOIN attractions a ON f.attraction_id = a.id
    LEFT JOIN images i ON a.id = i.attraction_id
    WHERE f.member_id = %s
    GROUP BY a.id
    """
    with mysql.connector.connect(**DB_CONFIG) as conn:
        with conn.cursor(dictionary=True) as cursor:
            cursor.execute(query, (member_id,))
            rows = cursor.fetchall()
            return rows

def get_booking_list(member_id):
    query = """
    SELECT attraction_id, date, time, price
    FROM orders
    WHERE member_id = %s AND number IS NULL
    """

    with mysql.connector.connect(**DB_CONFIG) as conn:
        with conn.cursor(dictionary=True) as cursor:
            cursor.execute(query, (member_id,))
            return cursor.fetchone()
        
def get_booking_list_all(member_id):
    query = """
    SELECT number, attraction_id, date, time, price, name, email, phone, status
    FROM orders
    WHERE member_id = %s AND status = 1
    """

    with mysql.connector.connect(**DB_CONFIG) as conn:
        with conn.cursor(dictionary=True) as cursor:
            cursor.execute(query, (member_id,))
            return cursor.fetchall()

def delete_booking(member_id):
    query = """
    DELETE FROM orders
    WHERE member_id = %s"""

    with mysql.connector.connect(**DB_CONFIG) as conn:
        with conn.cursor() as cursor:
            cursor.execute(query, (member_id,))
            conn.commit()

def complete_order(number, name, email, phone, member_id, status):
    print("[DEBUG] 執行 UPDATE SQL：", number, name, email, phone, member_id, status)
    with mysql.connector.connect(**DB_CONFIG) as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
            SELECT id FROM orders
            WHERE member_id = %s AND number IS NULL
            ORDER BY order_time DESC
            LIMIT 1 """, (member_id,))
            row = cursor.fetchone()
            if not row:
                print("[DEBUG]沒找到可更新的訂單")
                return
            
            order_id = row[0]
            print(order_id)

            cursor.execute("""
            UPDATE orders
            SET number = %s, name = %s, email = %s, phone = %s, status = %s
            WHERE id = %s
            """, (number, name, email, phone, status, order_id))
            conn.commit()
            print("[Debug]訂單已更新id=", order_id)

def get_order_by_number(order_number):
    query = """
    SELECT * FROM orders WHERE number = %s
    """
    with mysql.connector.connect(**DB_CONFIG) as conn:
        with conn.cursor(dictionary=True) as cursor:
            cursor.execute(query, (order_number,))
            return cursor.fetchone()

def get_attractions_list(page: int = 0, keyword: str = None):
    limit = 12
    offset = page * limit

    query = """
    SELECT
        a.id, a.name, a.category, a.description, a.address,
        a.transport, a.mrt, a.lat, a.lng,
        COALESCE(GROUP_CONCAT(i.image_url SEPARATOR ','), '') AS images
    FROM attractions a
    LEFT JOIN images i ON a.id = i.attraction_id
    """

    conditions = []
    params = []

    if keyword:
        conditions.append("(a.name LIKE %s OR a.mrt = %s)")
        params.extend([f"%{keyword}%", keyword])

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " GROUP BY a.id ORDER BY a.id LIMIT %s OFFSET %s"
    params.extend([limit + 1, offset])

    with mysql.connector.connect(**DB_CONFIG) as conn:
        with conn.cursor(dictionary=True) as cursor:
            cursor.execute(query, params or ())
            rows = cursor.fetchall()

    results = []
    for row in rows:
        images_list = row["images"].split(",") if row["images"] else []
        mrt_value = row["mrt"] if row["mrt"] else ""

        results.append({
            "id": row["id"],
            "name": row["name"],
            "category": row["category"],
            "description": row["description"],
            "address": row["address"],
            "transport": row["transport"],
            "mrt": mrt_value,
            "lat": float(row["lat"]),
            "lng": float(row["lng"]),
            "images": images_list
        })

    if len(results) > limit:
        next_page = page + 1
        results = results[:limit]
    else:
        next_page = None

    return results, next_page


def get_single_attraction(attraction_id: int):
    query = """
    SELECT
        a.id, a.name, a.category, a.description, a.address,
        a.transport, a.mrt, a.lat, a.lng,
        COALESCE(GROUP_CONCAT(i.image_url SEPARATOR ','), '') AS images
    FROM attractions a
    LEFT JOIN images i ON a.id = i.attraction_id
    WHERE a.id = %s
    GROUP BY a.id
    """

    with mysql.connector.connect(**DB_CONFIG) as conn:
        with conn.cursor(dictionary=True) as cursor:
            cursor.execute(query, (attraction_id,))
            row = cursor.fetchone()

    if not row:
        return None

    images_list = row["images"].split(",") if row["images"] else []
    mrt_value = row["mrt"] if row["mrt"] else ""

    return {
        "id": row["id"],
        "name": row["name"],
        "category": row["category"],
        "description": row["description"],
        "address": row["address"],
        "transport": row["transport"],
        "mrt": mrt_value,
        "lat": float(row["lat"]),
        "lng": float(row["lng"]),
        "images": images_list
    }


def get_mrt_list():
    query = """
    SELECT a.mrt, COUNT(a.id) AS attraction_count
    FROM attractions a
    WHERE a.mrt IS NOT NULL
    GROUP BY a.mrt
    ORDER BY attraction_count DESC
    """

    with mysql.connector.connect(**DB_CONFIG) as conn:
        with conn.cursor(dictionary=True) as cursor:
            cursor.execute(query)
            rows = cursor.fetchall()

    mrt_list = [row["mrt"] for row in rows if row["mrt"]]
    return mrt_list

def get_member_username(username: str):
    query = "SELECT * FROM member WHERE username = %s"
    with mysql.connector.connect(**DB_CONFIG) as conn:
        with conn.cursor(dictionary=True) as cursor:
            cursor.execute(query, (username,))
            return cursor.fetchone()

@app.get("/api/attractions")
async def attractions_api(
    request: Request,
    page: int = Query(0, ge=0),
    keyword: str = Query(None)
):
    attractions_data, next_page = get_attractions_list(page, keyword)
    print(f"[DEBUG] page={page}, keyword={keyword}, next_page={next_page}, count={len(attractions_data)}")

    if not attractions_data:
        return JSONResponse(
            content={"error": True, "message": "查無景點資料"},
            status_code=500
        )

    return JSONResponse({
        "nextPage": next_page,
        "data": attractions_data
    }, status_code=200)

def add_member_username(name, username, password):
    with mysql.connector.connect(**DB_CONFIG) as conn:
        with conn.cursor(dictionary=True) as cursor:
            query = "INSERT INTO member (name, username, password) VALUES (%s, %s, %s)"
            cursor.execute(query, (name, username, password))
            conn.commit()


@app.get("/api/attraction/{attractionId}")
async def attraction_id_api(attractionId: int):
    attraction_data = get_single_attraction(attractionId)

    if not attraction_data:
        return JSONResponse(
            content={"error": True, "message": f"ID={attractionId}編號不正確"},
            status_code=400
        )

    return JSONResponse({"data": attraction_data}, status_code=200)


@app.get("/api/mrts")
async def mrts_api():
    mrt_data = get_mrt_list()
    if not mrt_data:
        return JSONResponse(
            content={"error": True, "message": "查無捷運站資料"},
            status_code=500
        )

    return JSONResponse(content={"data": mrt_data}, status_code=200)

@app.put("/api/user/auth")
async def signin(form: SigninForm):
    user = get_member_by_email(form.email)
    if not user or user["password"] != form.password:
        return JSONResponse(status_code=400, content={
            "error": True,
            "message": "帳號或密碼錯誤"
        })
    try:
        token = create_access_token({
            "user_id": user["id"],
            "name": user["name"],
            "email": user["username"]
        })
        return {"token": token}
    except:
        return JSONResponse(status_code=500, content={
            "error": True,
            "message": "伺服器內部錯誤"
        })

@app.get("/api/user/auth")
def get_user_auth(credentials: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        return JSONResponse(content={"data": None})
    
    return {
      "data": {
        "id": payload["user_id"],
        "name": payload["name"],
        "email": payload["email"]
      }
    }

@app.post("/api/user")
async def signup_api(form: SignupForm):
    user = get_member_by_email(form.email)
    if user:
        return JSONResponse(status_code=400, content={
            "error": True,
            "message": "Email 已被註冊"
        })
    try:
        add_member_username(form.name, form.email, form.password)
        return {"ok": True}
    except Exception as e:
        return JSONResponse(status_code=500, content={
            "error": True,
            "message": "伺服器內部錯誤"
        })

@app.get("/api/booking")
def booking_get(credentials: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    payload = decode_access_token(credentials.credentials)
    if not payload:
        return JSONResponse(status_code=403, content={
            "error": True,
            "message": "未登入系統，拒絕存取"
        })

    member_id = payload["user_id"]
    booking_data = get_booking_list(member_id)

    if not booking_data:
        return JSONResponse(content={"data": None}, status_code=200)

    attraction = get_single_attraction(booking_data["attraction_id"])

    if not attraction:
        return JSONResponse(content={"data": None}, status_code=200)

    result = {
        "data": {
            "attraction": {
                "id": attraction["id"],
                "name": attraction["name"],
                "address": attraction["address"],
                "image": attraction["images"][0] if attraction["images"] else None
            },
            "date": booking_data["date"].isoformat()
            ,
            "time": booking_data["time"],
            "price": booking_data["price"]
        }
    }
    return JSONResponse(result, status_code=200)

    
@app.post("/api/booking")
async def booking_api(
    form: BookingForm,
    credentials: HTTPAuthorizationCredentials = Depends(auth_scheme)
):
    payload = decode_access_token(credentials.credentials)
    if not payload:
        return JSONResponse(status_code=403, content={
            "error": True,
            "message": "未登入系統，拒絕存取"
        })

    member_id = payload["user_id"]
    attraction_data = get_single_attraction(form.attractionId)

    if not attraction_data:
        return JSONResponse(
            content={"error": True, "message": f"內容不正確，請重新輸入"},
            status_code=400
        )

    try:
        add_booking(form.price, form.attractionId, member_id, form.date, form.time)
        return JSONResponse(status_code=200, content={"ok": True})
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={
            "error": True,
            "message": f"伺服器內部錯誤: {str(e)}"
        })
    
@app.delete("/api/booking")
def booking_delete(credentials: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    payload = decode_access_token(credentials.credentials)
    if not payload:
        return JSONResponse(status_code=403, content={
            "error": True,
            "message": "未登入系統，拒絕存取"
        })

    member_id = payload["user_id"]
    booking_data = get_booking_list(member_id)

    if not booking_data:
        return JSONResponse(status_code=500, content={
            "error": True,
            "message": "查無預定資料"
        })
    
    try:
        delete_booking(member_id)
        return {"ok": True}
    except Exception as e:
        return JSONResponse(status_code=500, content={
            "error": True,
            "message": "伺服器內部錯誤"
        })
    
@app.post("/api/orders")
async def create_order(
    form: OrderForm,
    cred: HTTPAuthorizationCredentials = Depends(auth_scheme)
):
    payload = decode_access_token(cred.credentials)
    if not payload:
        raise HTTPException(403, "未登入")

    member_id = payload["user_id"]

    attraction = get_single_attraction(form.order.attractionId)
    if not attraction:
        return JSONResponse({"error": True, "message": "景點不存在"}, 400)

    tappay_payload = {
        "prime":       form.prime,
        "partner_key": TAPPAY_PARTNER_KEY,
        "merchant_id": TAPPAY_MERCHANT_ID,
        "amount":      form.order.price,
        "details":     f"台北一日遊 - {attraction['name']}"[:100],
        "cardholder": {
            "phone_number": form.order.contact.phone,
            "name":         form.order.contact.name,
            "email":        form.order.contact.email
        },
        "remember": False
    }

    headers = {
        "Content-Type": "application/json",
        "x-api-key": TAPPAY_PARTNER_KEY
    }

    print("TapPay payload:", tappay_payload)
    print("Env partner_key:", repr(TAPPAY_PARTNER_KEY))
    print("Env merchant_id:", repr(TAPPAY_MERCHANT_ID))

    r = requests.post(
        "https://sandbox.tappaysdk.com/tpc/payment/pay-by-prime",
        headers=headers,
        json=tappay_payload,
        timeout=15
    )
    result = r.json()

    if result.get("status") != 0:
        return JSONResponse({
            "error": True,
            "message": f"TapPay 錯誤：{result.get('msg','unknown')}"
        }, 400)

    order_no = str(uuid4())[:8]

    print(order_no)

    print("[DEBUG]傳入complete_order：", {
    "number": order_no,
    "name": form.order.contact.name,
    "email": form.order.contact.email,
    "phone": form.order.contact.phone,
    "member_id": member_id,
    "status": 1
})

    complete_order(
        number = order_no,
        name  = form.order.contact.name,
        email = form.order.contact.email,
        phone = form.order.contact.phone,
        member_id = member_id,
        status = 1
    )

    return {
        "data": {
            "number":  order_no,
            "payment": {"status": 0, "message": "付款成功"}
        }
    }

@app.get("/api/order/{orderNumber}")
def order_get(orderNumber: str, credentials: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    payload = decode_access_token(credentials.credentials)
    if not payload:
        return JSONResponse(status_code=403, content={
            "error": True,
            "message": "未登入系統，拒絕存取"
        })

    order = get_order_by_number(orderNumber)
    if not order:
        return JSONResponse(content={"data": None}, status_code=200)

    attraction = get_single_attraction(order["attraction_id"])
    if not attraction:
        return JSONResponse(status_code=500, content={"error": True, "message": "查無景點資料"})

    result = {
        "data": {
            "number": order["number"],
            "price": order["price"],
            "trip": {
                "attraction": {
                    "id": attraction["id"],
                    "name": attraction["name"],
                    "address": attraction["address"],
                    "image": attraction["images"][0] if attraction["images"] else None
                },
                "date": order["date"].isoformat(),
                "time": order["time"]
            },
            "contact": {
                "name": order["name"],
                "email": order["email"],
                "phone": order["phone"]
            },
            "status": order["status"]
        }
    }
    return JSONResponse(result, status_code=200)

@app.get("/api/member")
def booking_get_all(credentials: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    payload = decode_access_token(credentials.credentials)
    if not payload:
        return JSONResponse(status_code=403, content={
            "error": True,
            "message": "未登入系統，拒絕存取"
        })

    member_id = payload["user_id"]
    orders = get_booking_list_all(member_id)
    print(f"📦 查詢到訂單數量：{len(orders) if orders else 0}")
    if not orders:
        return JSONResponse(content={"data": None}, status_code=200)

    result = []

    for order in orders:
        print("👉 order 資料：", order)
        attraction = get_single_attraction(order["attraction_id"])
        if not attraction:
            continue

        result.append({
            "number": order["number"],  # ✅ 修正這裡
            "price": order["price"],
            "trip": {
                "attraction": {
                    "id": attraction["id"],
                    "name": attraction["name"],
                    "address": attraction["address"],
                    "image": attraction["images"][0] if attraction["images"] else None
                },
                "date": order["date"].isoformat(),
                "time": order["time"]
            },
            "contact": {
                "name": order["name"],
                "email": order["email"],
                "phone": order["phone"]
            },
            "status": order["status"]
        })

    return JSONResponse(content={"data": result}, status_code=200)


@app.get("/api/favorite")
async def get_favorite(credentials: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    payload = decode_access_token(credentials.credentials)
    if not payload:
        return JSONResponse(status_code=403, content={
            "error": True,
            "message": "未登入系統，無法查看喜愛景點"
        })

    member_id = payload["user_id"]
    favorite_data = get_favorite_list(member_id)
    return JSONResponse(status_code=200, content={
        "data": favorite_data or []                        # ✔ 至少回空陣列
    })

@app.post("/api/favorite")
async def post_add_favorite(attractionId: int, credentials: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    payload = decode_access_token(credentials.credentials)
    if not payload:
        return JSONResponse(status_code=403, content={
            "error": True,
            "message": "未登入系統，無法查看喜愛景點"
        })

    member_id = payload["user_id"]
    try:
        add_favorite(attractionId, member_id)
        return {"ok": True}
    except Exception as e:
        return JSONResponse(status_code=500, content={
            "error": True,
            "message": "伺服器內部錯誤"
        })
    
@app.delete("/api/favorite")
async def delete_favorite(attractionId: int, credentials: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    payload = decode_access_token(credentials.credentials)
    if not payload:
        return JSONResponse(status_code=403, content={
            "error": True,
            "message": "未登入系統，無法查看喜愛景點"
        })

    member_id = payload["user_id"]
    try:
        remove_favorite(attractionId, member_id)
        return {"ok": True}
    except Exception as e:
        return JSONResponse(status_code=500, content={
            "error": True,
            "message": "伺服器內部錯誤"
        })