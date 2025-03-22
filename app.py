from fastapi import FastAPI, Path, Query, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi import HTTPException
import mysql.connector
from dotenv import load_dotenv
from fastapi.staticfiles import StaticFiles
import os

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
load_dotenv()

DB_CONFIG = {
    "host": os.getenv("DB_HOST"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "database": os.getenv("DB_NAME")
}

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
