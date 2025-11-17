# WAPI 2 - Weather API Project Appendix

## Project Overview
WAPI 2 is a FastAPI-based weather data API system that allows weather stations to submit data and users to query weather information through a REST API with authentication and authorization controls.

---

## Table of Contents
1. [Project Structure](#project-structure)
2. [Dependencies](#dependencies)
3. [Database Models](#database-models)
4. [API Schemas](#api-schemas)
5. [Core Configuration](#core-configuration)
6. [Authentication & Security](#authentication--security)
7. [API Endpoints](#api-endpoints)
8. [Database Setup](#database-setup)
9. [Utility Functions](#utility-functions)
10. [Frontend Templates](#frontend-templates)

---

## Project Structure

```
wapi_2/
├── runserver.py              # Entry point - starts FastAPI server
├── requirements.txt          # Python dependencies
├── wapi/
│   ├── __init__.py          # Package initialization
│   ├── main.py              # Main FastAPI application
│   ├── config.py            # Configuration settings
│   ├── database.py          # Database connection setup
│   ├── models.py            # SQLAlchemy ORM models
│   ├── schemas.py           # Pydantic request/response schemas
│   ├── oauth2.py            # OAuth2 authentication logic
│   ├── utils.py             # Password hashing utilities
│   ├── routers/
│   │   ├── auth.py          # Authentication endpoints
│   │   ├── user.py          # User management endpoints
│   │   └── station.py       # Weather station endpoints
│   ├── static/              # Static assets
│   │   ├── index.css
│   │   ├── index2.css
│   │   ├── scripts.js
│   │   └── img/
│   └── templates/           # HTML templates
│       ├── index.html
│       └── index2.html
```

---

## Dependencies

### Core Framework & API
- **fastapi** (0.115.6) - Modern web framework for building APIs
- **uvicorn** - ASGI web server for running FastAPI
- **starlette** (0.41.3) - ASGI web framework
- **pydantic** (2.10.4) - Data validation library
- **pydantic-settings** (2.7.0) - Settings management

### Database
- **SQLAlchemy** (2.0.36) - ORM for database operations
- **psycopg** (3.2.3) - PostgreSQL adapter
- **psycopg-binary** (3.2.3) - PostgreSQL binary adapter

### Authentication & Security
- **python-jose** (3.3.0) - JWT token implementation
- **passlib** (1.7.4) - Password hashing
- **bcrypt** (3.2.0) - Cryptographic hashing
- **python-multipart** (0.0.20) - Form data parsing

### Utilities
- **python-dotenv** (1.0.1) - Environment variable management
- **email-validator** (2.2.0) - Email validation
- **cryptography** (44.0.0) - Cryptographic library
- **httpx** (0.28.1) - Async HTTP client
- **typer** (0.15.1) - CLI framework

---

## Database Models

### User Model
```python
class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, nullable=False)
    username = Column(String, unique=True, nullable=False)
    password = Column(String, nullable=False)
    is_admin = Column(Boolean, nullable=False, server_default='False')
    stations = Column(Integer, default=0, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), nullable=False)
```

**Purpose**: Stores user account information with admin flag for role-based access control.

### Station Model
```python
class Station(Base):
    __tablename__ = "stations"

    station_id = Column(Integer, primary_key=True, nullable=False)
    api_access_key = Column(String, nullable=False)
    location = Column(String, nullable=False)
    owner = Column(String, ForeignKey("users.username", ondelete="CASCADE"), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), nullable=False)
    is_public = Column(Boolean, server_default='False', nullable=False)

    temperature = Column(Float, default=0, nullable=False)
    pressure = Column(Float, default=0, nullable=False)
    humidity = Column(Float, default=0, nullable=False)
    wind_speed = Column(Float, default=0, nullable=False)
    wind_direction = Column(String, default="", nullable=False)
    uv_index = Column(Float, default=0, nullable=False)
    is_raining = Column(Boolean, server_default='True', nullable=False)
```

**Properties**:
- `station_id`: int (Primary Key)
- `api_access_key`: str (Unique token for station identification)
- `location`: str
- `owner`: str (Foreign Key to users.username)
- `created_at`: TIMESTAMP (Auto-generated)
- `is_public`: bool (Default: False)
- Current weather readings (temperature, pressure, humidity, wind_speed, wind_direction, uv_index, is_raining)

**Purpose**: Represents weather stations that submit data. Stores both metadata and current weather readings.

### Data Model
```python
class Data(Base):
    __tablename__ = "data"

    data_id = Column(Integer, primary_key=True, nullable=False)
    station_id = Column(Integer, ForeignKey("stations.station_id", ondelete="CASCADE"), nullable=False)
    location = Column(String, nullable=False)
    
    temperature = Column(Float, nullable=False)
    pressure = Column(Float, nullable=False)
    humidity = Column(Float, nullable=False)
    wind_speed = Column(Float, nullable=False)
    wind_direction = Column(String, nullable=False)
    uv_index = Column(Float, nullable=False)
    is_raining = Column(Boolean, server_default='True', nullable=False)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), nullable=False)
```

**Properties**:
- `data_id`: int (Primary Key)
- `station_id`: int (Foreign Key to stations.station_id)
- `location`: str
- `temperature`, `pressure`, `humidity`, `wind_speed`, `wind_direction`, `uv_index`, `is_raining`: Weather measurements
- `created_at`: TIMESTAMP (Auto-generated)

**Purpose**: Stores historical weather data records submitted by stations for time-series analysis.

---

## API Schemas

### User Schema
```python
class User(BaseModel):
    username: str
    is_admin: bool
    stations: int
    created_at: datetime

    class Config:
        from_attributes = True
```

### UserLogin Schema
```python
class UserLogin(BaseModel):
    username: str
    password: str
```

### Token Schemas
```python
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[int]
```

### Station Schemas
```python
class StationCreate(BaseModel):
    location: str

class StationUpdate(BaseModel):
    location: Optional[str] = None
    is_public: Optional[bool] = None

class StationDetail(BaseModel):
    station_id: int
    location: str
    owner: str
    api_access_key: str
    created_at: datetime

    class Config:
        from_attributes = True
```

### Data Schemas
```python
class DataCreate(BaseModel):
    location: str
    wind_speed: float
    wind_direction: str
    temperature: float
    pressure: float
    humidity: float
    uv_index: float
    is_raining: bool

    class Config:
        from_attributes = True

class DataOut(BaseModel):
    wind_speed: float
    wind_direction: str
    temperature: float
    pressure: float
    humidity: float
    uv_index: float
    is_raining: bool
    created_at: datetime

    class Config:
        from_attributes = True
```

### Extended Station Response Schemas
```python
class StationData(DataOut):
    station_id: int
    location: str
    api_access_key: str
    created_at: datetime
    is_public: bool

    class Config:
        from_attributes = True

class PublicStationData(DataOut):
    station_id: int
    location: str
    created_at: datetime
    is_public: bool

    class Config:
        from_attributes = True
```

---

## Core Configuration

### config.py - Settings Management
```python
from pydantic_settings import BaseSettings
 

class Settings(BaseSettings):
    database_hostname: str
    database_port: str
    database_password: str
    database_name: str
    database_username: str
    secret_key: str
    algorithm: str
    access_token_expire_minutes: int

    class Config:
        env_file = ".env"

        
settings = Settings()
```

**Configuration Source**: Environment variables loaded from `.env` file.

### Required Environment Variables
- `DATABASE_HOSTNAME` - PostgreSQL server host
- `DATABASE_PORT` - PostgreSQL server port
- `DATABASE_PASSWORD` - PostgreSQL password
- `DATABASE_NAME` - Database name
- `DATABASE_USERNAME` - PostgreSQL username
- `SECRET_KEY` - JWT signing secret
- `ALGORITHM` - JWT algorithm (typically HS256)
- `ACCESS_TOKEN_EXPIRE_MINUTES` - JWT expiration time

---

## Authentication & Security

### oauth2.py - OAuth2 Implementation

**Key Functions:**

#### 1. Create Access Token
```python
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    jwt_token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return jwt_token
```

#### 2. Verify Access Token
```python
def verify_access_token(token: str, credential_exception):
    decoded_jwt = jwt.decode(token, SECRET_KEY, algorithms=ALGORITHM)
    
    try:
        id = decoded_jwt.get("user_id")
        if not id:
            raise credential_exception
        token_data = schemas.TokenData(user_id= id)
    except JWTError:
        raise credential_exception
    
    return token_data
```

#### 3. Get Current User Dependency
```python
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credential_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, 
        detail=f"Could not validate credentials", 
        headers={"www-Authenticate":"Bearer"}
    )
    token_data = verify_access_token(token, credential_exception)
    current_user = db.query(models.User).filter(models.User.user_id == token_data.user_id).first()
    return current_user
```

#### 4. Authenticate Station via API Key
```python
def authenticate_station(api_key: str = Header(...), db: Session = Depends(get_db)):
    """
    Authenticate a weather station using its API key.
    """
    station = db.query(models.Station).filter(models.Station.api_access_key == api_key).first()

    if not station:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key."
        )
    
    return station
```

**OAuth2 Configuration:**
```python
oauth2_scheme = OAuth2PasswordBearer(tokenUrl='login')

SECRET_KEY = settings.secret_key
ALGORITHM = settings.algorithm
ACCESS_TOKEN_EXPIRE_MINUTES = settings.access_token_expire_minutes
```

### utils.py - Password Utilities

```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash(password: str):
    return pwd_context.hash(password)

def verify(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)
```

---

## API Endpoints

### Authentication Routes (`/routers/auth.py`)

#### POST /login
- **Authentication**: None (public)
- **Request Body**: UserLogin schema (username, password)
- **Response**: Token schema (access_token, token_type)
- **Status Codes**: 200 OK, 403 Forbidden
- **Description**: Authenticates user and returns JWT token

**Code:**
```python
@router.post("/login", response_model=schemas.Token)
def login(
    login_credentials: schemas.UserLogin,
    db: Session = Depends(get_db)):
    
    # Check if User exists
    user_query = db.query(models.User).filter(models.User.username == login_credentials.username)
    if not user_query.first():
        raise HTTPException(status_code = status.HTTP_403_FORBIDDEN, detail=f"invalid credentials")
    
    # Verify Password
    pwd_match = utils.verify(login_credentials.password, user_query.first().password)
    if not pwd_match:
        raise HTTPException(status_code = status.HTTP_403_FORBIDDEN, detail=f"invalid credentials")
    
    user = user_query.first()
    
    #Create access token
    access_token = oauth2.create_access_token(data={"user_id": user.user_id})

    return {"access_token": access_token, "token_type": "bearer"}
```

### User Management Routes (`/routers/user.py`)

#### POST /users/
- **Authentication**: None (public)
- **Request Body**: UserLogin schema
- **Response**: User schema
- **Status Codes**: 201 Created, 409 Conflict
- **Description**: Creates new user account with encrypted password

**Code:**
```python
@router.post("/", status_code = status.HTTP_201_CREATED, response_model=schemas.User)
def create_user(
    signup_credentials: schemas.UserLogin,
    db: Session = Depends(get_db)
    ):
    
    # Check Username available
    user_query = db.query(models.User).filter(models.User.username == signup_credentials.username)
    if user_query.first():
        raise HTTPException(status_code = status.HTTP_409_CONFLICT, detail=f"This username is taken. Please try again")

    # Encrypt Password
    hashed_password = utils.hash(signup_credentials.password)
    signup_credentials.password = hashed_password
    
    # Create User record
    new_user = models.User(**signup_credentials.dict())
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user
```

#### GET /users/
- **Authentication**: Required (admin only)
- **Response**: List of User schemas
- **Status Codes**: 200 OK, 401 Unauthorized
- **Description**: Retrieves all user accounts (admin only)

**Code:**
```python
@router.get("/", status_code = status.HTTP_200_OK, response_model=list[schemas.User])
def get_users_all(
    auth = Depends(oauth2.get_current_user),
    db: Session = Depends(get_db)
    ):
    
    if not auth.is_admin:
        raise HTTPException(status_code = status.HTTP_401_UNAUTHORIZED, detail=f"unauthorized request")
    user_query = db.query(models.User)

    return user_query.all()
```

#### GET /users/me
- **Authentication**: Required
- **Response**: User schema
- **Status Codes**: 200 OK, 404 Not Found
- **Description**: Returns current authenticated user's profile with updated station count

**Code:**
```python
@router.get("/me", status_code = status.HTTP_200_OK, response_model=schemas.User)
def get_user(
    auth = Depends(oauth2.get_current_user),
    db: Session = Depends(get_db)
    ):
    
    user_query = db.query(models.User).filter(models.User.user_id == auth.user_id)
    if auth.user_id != user_query.first().user_id:
        raise HTTPException(status_code = status.HTTP_401_UNAUTHORIZED, detail=f"unauthorized request")
    if not user_query.first():
        raise HTTPException(status_code = status.HTTP_404_NOT_FOUND, detail=f"user with id:{id} was not found")
    # Count Stations owned by User
    user_stations = db.query(models.Station).filter(models.Station.owner == user_query.first().username)
    # Update User's station count
    user_query.first().stations = len(user_stations.all())
    return user_query.first()
```

### Weather Station Routes (`/routers/station.py`)

#### POST /stations/
- **Authentication**: Required
- **Request Body**: StationCreate schema (location)
- **Response**: StationDetail schema
- **Status Codes**: 201 Created, 500 Internal Server Error
- **Description**: Creates new weather station with unique API key

**Code:**
```python
@router.post("/", status_code=status.HTTP_201_CREATED, response_model=schemas.StationDetail )
def create_station(
    station_data: schemas.StationCreate,
    auth: schemas.User = Depends(oauth2.get_current_user),
    db: Session = Depends(get_db)
    ):
    
    # Generate a secure API key
    api_key = secrets.token_urlsafe(32)

    # Create a new station instance
    new_station = models.Station(location=station_data.location, api_access_key=api_key, owner=auth.username)

    # Save to the database
    try:
        db.add(new_station)
        db.commit()
        db.refresh(new_station)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An error occurred while creating the station: {str(e)}")

    return new_station
```

#### DELETE /stations/{station_id}
- **Authentication**: Required (owner or admin)
- **Response**: No content
- **Status Codes**: 204 No Content, 403 Forbidden, 404 Not Found, 500 Internal Server Error
- **Description**: Deletes weather station

**Code:**
```python
@router.delete("/{station_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_station(
    station_id: int,
    auth: schemas.User = Depends(oauth2.get_current_user),
    db: Session = Depends(get_db),
):
    # Query the station by ID
    station = db.query(models.Station).filter(models.Station.station_id == station_id).first()

    # Check if the station exists
    if not station:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Station with ID '{station_id}' not found."
        )

    # Check authorization
    if not auth.is_admin and station.owner != auth.username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to delete this station."
        )

    # Delete the station
    try:
        db.delete(station)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while deleting the station: {str(e)}"
        )
```

#### GET /stations/{station_id}/details
- **Authentication**: Required (owner, admin, or public if is_public=true)
- **Response**: StationData schema
- **Status Codes**: 200 OK, 403 Forbidden, 404 Not Found
- **Description**: Retrieves detailed station information

**Code:**
```python
@router.get("/{station_id}/details", response_model=schemas.StationData)
def get_station_by_id(
    station_id: str,
    auth: schemas.User = Depends(oauth2.get_current_user),
    db: Session = Depends(get_db),
):
    # Query stations table by {station_id}
    station = db.query(models.Station).filter(models.Station.station_id == int(station_id)).first()
    
    # Check authorization
    if not auth.is_admin and auth.username != station.owner and not station.is_public:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access this station's details."
        )
    if not station:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Station with ID '{station_id}' not found.")

    return station
```

#### GET /stations/all
- **Authentication**: Required
- **Response**: List of StationData schemas
- **Status Codes**: 200 OK
- **Description**: Returns all stations (admins see all, users see only theirs)

**Code:**
```python
@router.get("/all", status_code=status.HTTP_200_OK, response_model=List[schemas.StationData])
def get_all_stations_data(
    auth: schemas.User = Depends(oauth2.get_current_user),
    db: Session = Depends(get_db),
):
    # Base query
    query = db.query(models.Station)

    # Admins can see all stations, regular users see only their own
    if auth.is_admin != True:
        query = query.filter(models.Station.owner == auth.username)
    
    stations = query.all()
    
    # Return empty list if no records found
    if not stations:
        return []
    return stations
```

#### GET /stations/public
- **Authentication**: None (public)
- **Response**: List of PublicStationData schemas
- **Status Codes**: 200 OK
- **Description**: Returns all public weather stations (no API keys exposed)

**Code:**
```python
@router.get("/public", response_model=List[schemas.PublicStationData])
def get_public_stations(db: Session = Depends(get_db)):
    """
    Retrieve all public weather stations.
    """
    stations = db.query(models.Station).filter(models.Station.is_public == True).all()
    return stations
```

#### POST /stations/data
- **Authentication**: Required (via API key header)
- **Request Body**: DataCreate schema
- **Response**: DataOut schema
- **Status Codes**: 201 Created, 500 Internal Server Error
- **Description**: Submits weather data from station, updates station's current readings

**Code:**
```python
@router.post("/data", status_code=status.HTTP_201_CREATED, response_model=schemas.DataOut)
def create_data(
    received_data: schemas.DataCreate,
    auth_station: schemas.StationData = Depends(oauth2.authenticate_station),
    db: Session = Depends(get_db),
):
    try:
        # Update station attributes
        stn = db.query(models.Station).filter(models.Station.station_id == auth_station.station_id)
        stn.update(
            {
                "location": received_data.location,
                "wind_speed": received_data.wind_speed,
                "wind_direction": received_data.wind_direction,
                "temperature": received_data.temperature,
                "pressure": received_data.pressure,
                "humidity": received_data.humidity,
                "uv_index": received_data.uv_index,
                "is_raining": received_data.is_raining,
            },
            synchronize_session=False
        )
        db.commit()

        # Create a new data record
        cleaned_received_data = models.Data(
            station_id=auth_station.station_id,
            location=auth_station.location,
            temperature=received_data.temperature,
            pressure=received_data.pressure,
            humidity=received_data.humidity,
            wind_speed=received_data.wind_speed,
            wind_direction=received_data.wind_direction,
            uv_index=received_data.uv_index,
            is_raining=received_data.is_raining,
        )
        db.add(cleaned_received_data)
        db.commit()
        db.refresh(cleaned_received_data)

        return cleaned_received_data
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while processing the request: {str(e)}"
        )
```

#### GET /stations/{station_id}/historical_data
- **Authentication**: Required (owner, admin, or public if is_public=true)
- **Query Parameters**:
  - `start_time`: Optional (ISO format)
  - `end_time`: Optional (ISO format)
- **Response**: List of DataOut schemas
- **Status Codes**: 200 OK, 403 Forbidden, 404 Not Found
- **Description**: Retrieves historical weather data (default: last 24 hours if no time filter)

**Code:**
```python
@router.get("/{station_id}/historical_data", response_model=List[schemas.DataOut])
def get_historical_data(
    station_id: int,
    start_time: Optional[str] = Query(None, description="Start time for filtering (ISO format)"),
    end_time: Optional[str] = Query(None, description="End time for filtering (ISO format)"),
    auth: schemas.User = Depends(oauth2.get_current_user),
    db: Session = Depends(get_db),
):
    # Ensure station exists
    station = db.query(models.Station).filter(models.Station.station_id == station_id).first()
    if not station:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Station with ID '{station_id}' not found."
        )

    # Check user authorization
    if not auth.is_admin and auth.username != station.owner and not station.is_public:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access this station's data."
        )

    # Determine default time range if no filters provided
    if not start_time and not end_time:
        latest_record = (
            db.query(models.Data)
            .filter(models.Data.station_id == station_id)
            .order_by(models.Data.created_at.desc())
            .first()
        )

        if not latest_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No data found for this station."
            )

        end_dt = latest_record.created_at
        start_dt = end_dt - timedelta(hours=24)
    else:
        start_dt = datetime.fromisoformat(start_time) if start_time else None
        end_dt = datetime.fromisoformat(end_time) if end_time else None

    # Build and filter query
    query = db.query(models.Data).filter(models.Data.station_id == station_id)
    if start_dt:
        query = query.filter(models.Data.created_at >= start_dt)
    if end_dt:
        query = query.filter(models.Data.created_at <= end_dt)

    historical_data = query.order_by(models.Data.created_at.asc()).all()

    if not historical_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No historical data found for the given filters."
        )

    return historical_data
```

### Main Application Routes (`/main.py`)

#### GET /
- **Response**: HTML file (index2.html)
- **Description**: Serves frontend web page

#### GET /weather
- **Response**: Generated random weather data object
- **Description**: Returns randomly generated sample weather data

**Code:**
```python
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

@app.get("/")
def index():
    return FileResponse("wapi/templates/index2.html", status_code=200)

@app.get("/weather")
async def get_weather():
    weather_data = generate_weather_data()
    return weather_data
```

---

## Database Setup

### database.py - Connection Configuration

```python
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

SQLALCHEMY_DATABASE_URL = f"postgresql+psycopg://{settings.database_username}:{settings.database_password}@{settings.database_hostname}/{settings.database_name}"

engine = create_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

### Application Initialization

```python
from . import models
from .database import engine

# Create all database tables on application startup
models.Base.metadata.create_all(bind=engine)

app = FastAPI()
app.mount("/static", StaticFiles(directory="wapi/static"), name="static")
```

**Key Points**:
- Called in `main.py`: `models.Base.metadata.create_all(bind=engine)`
- Creates all tables if they don't exist
- Safe to run on application startup
- Uses PostgreSQL as the database backend

---

## Utility Functions

### main.py - Weather Data Generation

```python
def generate_weather_data() -> dict:
    """
    Generates random weather data for demo purposes.
    
    Returns:
        dict containing:
        - temperature: float (-30 to 50°C)
        - pressure: int (980 to 1050 hPa)
        - humidity: int (0 to 100%)
        - wind_speed: float (0 to 150 km/h)
        - wind_direction: float (0 to 359°)
        - uv_index: float (0 to 5)
        - rain_status: bool
    """
```

---

## Frontend Templates

### index.html & index2.html
Located in `wapi/templates/`
- Serve weather data visualization
- Referenced by GET / endpoint
- Static assets linked from `wapi/static/`

### Static Assets
- **index.css** / **index2.css** - Styling for web interface
- **scripts.js** - Client-side JavaScript logic
- **img/** - Image assets directory

---

## Running the Application

### Server Start Command
```bash
python runserver.py
```

**runserver.py:**
```python
import uvicorn

if __name__ == "__main__":
    uvicorn.run("wapi.main:app", host="0.0.0.0", port=8000, reload=True)
```

### uvicorn Configuration
- **Host**: 0.0.0.0 (all interfaces)
- **Port**: 8000
- **Reload**: Enabled (auto-restart on code changes)
- **App**: wapi.main:app

### Access Points
- **Web UI**: http://localhost:8000/
- **API Docs**: http://localhost:8000/docs (Swagger UI)
- **Alternative Docs**: http://localhost:8000/redoc (ReDoc)
- **Sample Weather**: http://localhost:8000/weather

### Example API Usage

**Register User:**
```bash
curl -X POST "http://localhost:8000/users/" \
  -H "Content-Type: application/json" \
  -d '{"username": "john_doe", "password": "secure_password"}'
```

**Login:**
```bash
curl -X POST "http://localhost:8000/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "john_doe", "password": "secure_password"}'
```

**Create Station:**
```bash
curl -X POST "http://localhost:8000/stations/" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"location": "New York"}'
```

**Submit Weather Data:**
```bash
curl -X POST "http://localhost:8000/stations/data" \
  -H "api_access_key: <station_api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "location": "New York",
    "temperature": 25.5,
    "pressure": 1013,
    "humidity": 65,
    "wind_speed": 12.5,
    "wind_direction": "NE",
    "uv_index": 3.2,
    "is_raining": false
  }'
```

---

## Security Considerations

### Authentication Flow
1. User registers via `POST /users/` with username/password
2. Password hashed with bcrypt and stored
3. User logs in via `POST /login` with credentials
4. Server validates and returns JWT token
5. Client includes token in Authorization header for protected endpoints
6. Server verifies token on each request

**Token Structure:**
```python
# JWT Payload
{
    "user_id": 1,
    "exp": 1700000000  # Expiration timestamp
}
```

### Authorization Levels
- **Public**: Anyone (login, sample weather, public stations)
- **Authenticated**: Logged-in users (manage own stations/data)
- **Admin**: Special users (manage all stations/users)
- **Station**: API key holder (submit weather data)

### Data Privacy
- API keys exposed only to station owner
- Private stations hidden from non-owners
- User passwords never returned in responses
- Historical data filtered by authorization

---

## Error Handling

### HTTP Status Codes Used
- **200 OK** - Successful GET/PUT
- **201 Created** - Successful POST
- **204 No Content** - Successful DELETE
- **400 Bad Request** - Invalid request parameters
- **401 Unauthorized** - Missing/invalid authentication
- **403 Forbidden** - Insufficient permissions
- **404 Not Found** - Resource not found
- **409 Conflict** - Duplicate resource (e.g., username taken)
- **500 Internal Server Error** - Database or server errors

### Error Response Format
```json
{
  "detail": "Error message describing what went wrong"
}
```

---

## Development Notes

### Session Management
- All database operations use dependency injection
- SessionLocal() provides automatic transaction handling
- Connections automatically closed after request completion

### Code Organization
- **Models**: SQLAlchemy ORM definitions
- **Schemas**: Pydantic validation and serialization
- **Routers**: FastAPI endpoint definitions
- **OAuth2**: Authentication and authorization logic
- **Utils**: Reusable utilities (password hashing)
- **Config**: Environment-based settings
- **Database**: Connection and session management

### Commented Code
Some code sections are commented (e.g., in station.py):
- Filtering and pagination parameters (under development)
- Legacy CurrentData model (deprecated)
- Alternative response models

### Future Enhancement Areas
- Pagination implementation for station list
- Advanced filtering by location
- Sorting capabilities
- Real-time data streaming
- Weather alerts/notifications
- Data export functionality

---

## Project Statistics

- **Total Python Files**: 8 (main modules)
- **Total Router Files**: 3 (auth, user, station)
- **Database Models**: 3 (User, Station, Data)
- **API Endpoints**: 11
- **Dependencies**: 40+ packages
- **Authentication Method**: JWT/OAuth2
- **Database**: PostgreSQL with SQLAlchemy ORM

---

*Generated: November 17, 2025*
*Project: WAPI 2 - Weather API*
*Repository: Musah95/wapi_2*
