from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from . import models
from .database import engine
from .routers import user, auth, station
import random


models.Base.metadata.create_all(bind=engine)

app = FastAPI()
app.mount("/static", StaticFiles(directory="wapi/static"), name="static")


# Function to generate random weather data
def generate_weather_data():
    temperature = round(random.uniform(-30, 50), 1)
    pressure = random.randint(980, 1050)
    humidity = random.randint(0, 100)
    wind_speed = round(random.uniform(0, 150), 1)
    wind_direction = round(random.uniform(0, 359), 1)
    uv_index = round(random.uniform(0, 5), 1)
    rain_status = random.choice([True, False])

    return {
        'temperature': temperature,
        'pressure': pressure,
        'humidity': humidity,
        'wind_speed': wind_speed,
        'wind_direction': wind_direction,
        'uv_index': uv_index,
        'rain_status': rain_status
    }


app.include_router(user.router)
app.include_router(auth.router)
app.include_router(station.router)

# Endpoint to serve sample frontend webpage
@app.get("/")
def index():
    return FileResponse("wapi/templates/index.html", status_code=200)

# Endpoint to get weather data
@app.get("/weather")
async def get_weather():
    weather_data = generate_weather_data()
    return weather_data


