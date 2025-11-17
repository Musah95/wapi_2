from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, Sequence, JSON
from sqlalchemy.sql.expression import text
from sqlalchemy.sql.sqltypes import TIMESTAMP
from .database import Base

from sqlalchemy.orm import relationship

# USER MODEL
class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, nullable=False)
    username = Column(String, unique=True, nullable=False)
    password = Column(String, nullable=False)
    is_admin = Column(Boolean, nullable=False, server_default='False')
    stations = Column(Integer, default=0, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), nullable=False)


# WEATHER STATION MODEL
class Station(Base):
    __tablename__ = "stations"

    station_id = Column(Integer, primary_key=True, nullable=False)
    api_access_key = Column(String, nullable=False)
    location = Column(String, nullable=False)
    owner = Column(String, ForeignKey("users.username", ondelete="CASCADE"), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), nullable=False)
    last_updated = Column(TIMESTAMP(timezone=True), nullable=True)
    is_public = Column(Boolean, server_default='False', nullable=False)

    temperature = Column(Float, default=0, nullable=False)
    pressure = Column(Float, default=0, nullable=False)
    humidity = Column(Float, default=0, nullable=False)
    wind_speed = Column(Float, default=0, nullable=False)
    wind_direction = Column(String, default="", nullable=False)
    uv_index = Column(Float, default=0, nullable=False)
    is_raining = Column(Boolean, server_default='True', nullable=False)


# WEATHER DATA MODEL
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
###############################################################
##############################################################    




