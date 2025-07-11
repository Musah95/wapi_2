from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr
from pydantic.types import conint

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr
from pydantic.types import conint

class User(BaseModel):
    # user_id: int
    username: str
    is_admin: bool
    stations: int
    created_at: datetime

    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[int]

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

'''
# USER, AUTH SCHEMAS 
class UserCreate(BaseModel):
    username: str
    password: str







# WEATHER DATA SCHEMAS


class CurrentData(BaseModel):
    station_id: str
    data: dict
    created_at: datetime


# WEATHER STATION SHEMAS





'''