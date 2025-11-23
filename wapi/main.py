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
app.include_router(user.router)
app.include_router(auth.router)
app.include_router(station.router)

# Endpoint to serve sample frontend webpage
@app.get("/")
def index():
    return FileResponse("wapi/templates/index.html", status_code=200)

