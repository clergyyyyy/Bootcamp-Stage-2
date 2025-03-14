from fastapi import FastAPI, Path, Query, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi import HTTPException
from starlette.middleware.sessions import SessionMiddleware
from starlette.templating import Jinja2Templates
import mysql.connector
from dotenv import load_dotenv
import os

app=FastAPI()
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

def data_attractions(query, params=None):
	try:
		with mysql.connector.connect(**DB_CONFIG) as conn:
			with conn.cursor(dictionary=True) as cursor:
				cursor.execute(query, params or ())
				rows = cursor.fetchall()
				
				attractions_dict = {}
				for row in rows:
					attract_id = row["id"]
					if attract_id not in attractions_dict:
						attractions_dict[attract_id] = {
							"id": row["id"],
							"name": row["name"],
							"category": row["category"],
							"description": row["description"],
							"address": row["address"],
							"transport": row["transport"],
							"mrt": [row["mrt"]] if row["mrt"] else [],
							"lat": float(row["lat"]),
							"lng": float(row["lng"]),
							"images": []
						}
					
					if row["image_url"]:
						attractions_dict[attract_id]["images"].append(row["image_url"])
						
				return list(attractions_dict.values())
	except:
		mysql.connector.Error
		raise HTTPException(status_code=500, detail="伺服器內部錯誤，請稍後再試")
    
def data_mrts(query, params=None):
	try:
		with mysql.connector.connect(**DB_CONFIG) as conn:
			with conn.cursor(dictionary=True) as cursor:
				cursor.execute(query, params or ())
				rows = cursor.fetchall()
				
				mrt_dict = {}
				for row in rows:
					mrt = row["mrt"]
					if mrt not in mrt_dict:
						mrt_dict[mrt] = {"mrt": mrt}

				return list(mrt_dict.values())
	except:
		mysql.connector.Error
		raise HTTPException(status_code=500, detail="伺服器內部錯誤，請稍後再試")

def get_attraction_id(attractionID):
	query = """
	SELECT 
		a.id, a.name, a.category, a.description, a.address, 
		a.transport, a.mrt, a.lat, a.lng, i.image_url 
	FROM attractions a
	LEFT JOIN images i ON a.id = i.attraction_id
	WHERE a.id = %s
	"""
	return data_attractions(query, (attractionID,))
            

def get_attraction():
    query = """
    SELECT 
        a.id, a.name, a.category, a.description, a.address, 
        a.transport, a.mrt, a.lat, a.lng, i.image_url 
    FROM attractions a
    LEFT JOIN images i ON a.id = i.attraction_id
    """
    return data_attractions(query)

def get_mrt():
	query = """
	SELECT
		a.mrt
	FROM attractions a
	"""
	return data_mrts(query)
        

@app.get("/api/attractions")
async def attractions(request: Request):
    attraction = get_attraction()
    if not attraction:
        return JSONResponse(content={"error": True, "message": "查無景點資料"}, status_code=500)

    return JSONResponse({
  "nextPage": None,
  "data": attraction
}, status_code=200)

@app.get("/api/attractions/{attractionID}")
async def attraction_id(attractionID: int):
    attraction = get_attraction_id(attractionID)
    
    if not attraction:
        return JSONResponse(content={"error": True, "message": f"ID={attractionID}編號不正確"}, status_code=500)

    return JSONResponse({
        "data": attraction[0]
    }, status_code=200)

@app.get("/api/mrts")
async def mrts(request: Request):
    mrt = get_mrt()
    if not mrt:
        return JSONResponse(content={"error": True, "message": "查無捷運站資料"}, status_code=500)

    return JSONResponse({
  "data": mrt
}, status_code=200)