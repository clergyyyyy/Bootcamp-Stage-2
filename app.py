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

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")
load_dotenv()
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


def get_attractions_list(page: int = 0, keyword: str = None):
    """
    依照 page & keyword 查詢景點清單 (含多張圖片)，並進行分頁處理。
    """
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

@app.post("/api/user/auth")
async def signin(account: str = Form(...), password: str = Form(...)):
    user = get_member_username(account)
    if not user or user["password"] != password:
        raise HTTPException(status_code=400, detail="帳號或密碼錯誤")

    token = create_access_token({
        "user_id": user["id"],
        "username": user["username"]
    })

    return JSONResponse({"token": token})

@app.put("/api/user/auth")
def verify_user_token(credentials: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token 無效或過期")

    return JSONResponse({
        "data": {
            "id": payload["user_id"],
            "username": payload["username"]
        }
    })

@app.post("/api/user")
async def signup(name: str = Form(...), account: str = Form(...), password: str = Form(...)):
    user = get_member_username(account)
    if user :
        return JSONResponse({
            "error": True,
            "message": "重複e-mail或其他原因"
        }, status_code=400)
    add_member_username(name, account, password)
    return JSONResponse({
        "ok": True
    }, status_code=200)
