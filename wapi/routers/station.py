@router.get("/{station_id}/latest_metrics", response_model=List[schemas.DataOut])
def get_latest_metrics(station_id: int, db: Session = Depends(get_db)):
    """
    Return the last two readings for the station for trend calculation.
    """
    data_points = db.query(models.Data).filter(models.Data.station_id == station_id).order_by(models.Data.created_at.desc()).limit(2).all()
    return data_points
from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional
from sqlalchemy import func
from sqlalchemy.orm import Session
from .. import models, schemas, oauth2
from ..database import get_db
import secrets, hashlib
from sqlalchemy.exc import IntegrityError

router = APIRouter(prefix="/stations", tags=['Weather Station'])


# # # STATION CRUD OPERATIONS

# CREATE STATION
@router.post("/", status_code=status.HTTP_201_CREATED, response_model=schemas.StationDetail )
def create_station(
    station_data: schemas.StationCreate,
    auth: schemas.User = Depends(oauth2.get_current_user),
    db: Session = Depends(get_db)
    ):
    
    """
    Create a new weather station instance with a unique API access key.
    """
    # Generate a secure API key
    api_key = secrets.token_urlsafe(32)

    # Generate a unique 4-digit code (derived from owner id plus randomness)
    def _generate_unique_code(db, station_name, owner_id):
        import time
        attempts = 0
        while True:
            seed = f"{owner_id}-{secrets.token_urlsafe(8)}-{time.time_ns()}"
            h = hashlib.sha256(seed.encode()).hexdigest()
            code = int(h, 16) % 10000
            code_str = f"{code:04d}"
            exists = db.query(models.Station).filter(models.Station.station_name == station_name, models.Station.unique_code == code_str).first()
            if not exists:
                return code_str
            attempts += 1
            if attempts > 20000:
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not generate unique station code")

    owner_id = getattr(auth, 'user_id', 0)
    unique_code = _generate_unique_code(db, station_data.station_name or "", owner_id)

    # Create a new station instance with unique_code
    new_station = models.Station(location=station_data.location, station_name=station_data.station_name, unique_code=unique_code, api_access_key=api_key, owner=auth.username)

    # Save to the database, handle errors if any
    try:
        db.add(new_station)
        db.commit()
        db.refresh(new_station)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Station with that name/code already exists")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An error occurred while creating the station: {str(e)}")

    return new_station

# UPDATE STATION LOCATION AND PUBLIC STATUS
@router.put("/{station_id}/location", status_code=status.HTTP_200_OK, response_model=schemas.StationDetail)
def update_station_location(
    station_id: int,
    update_data: schemas.StationUpdate,
    auth: schemas.User = Depends(oauth2.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update the location and/or visibility of an existing weather station.
    """
    station = db.query(models.Station).filter(models.Station.station_id == station_id).first()

    if not station:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Station with ID '{station_id}' not found."
        )

    if not auth.is_admin and station.owner != auth.username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to update this station."
        )

    if update_data.location is not None:
        station.location = update_data.location

    if update_data.is_public is not None:
        station.is_public = update_data.is_public

    try:
        db.commit()
        db.refresh(station)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while updating the station: {str(e)}"
        )

    return station

# DELETE STATION
@router.delete("/{station_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_station(
    station_id: int,
    auth: schemas.User = Depends(oauth2.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete an existing weather station.

    Args:
        station_id (int): The ID of the station to delete.
        auth (schemas.User): The authenticated user.
        db (Session): Database session dependency.

    Returns:
        None: Returns no content on successful deletion.
    """
    # Query the station by ID
    station = db.query(models.Station).filter(models.Station.station_id == station_id).first()

    # Check if the station exists
    if not station:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Station with ID '{station_id}' not found."
        )

    # Check if the user is authorized to delete the station
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

    return

# # GET STATION
@router.get("/{station_id}/details", response_model=schemas.StationData)
def get_station_by_id(
    station_id: str,
    auth: schemas.User = Depends(oauth2.get_current_user_optional),  # User authentication (optional)
    db: Session = Depends(get_db),
):

    # Query stations table by {station_id}
    station = db.query(models.Station).filter(models.Station.station_id == int(station_id)).first()
    
    # Check if the user is authorized to access the station details
    # Allow access if:
    # - station is public
    # - user is admin
    # - user is owner
    if not station.is_public:
        if auth is None or (not getattr(auth, 'is_admin', False) and getattr(auth, 'username', None) != station.owner):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to access this station's details."
            )
    if not station:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Station with ID '{station_id}' not found.")

    return station


# GET ALL STATIONS
@router.get("/all",status_code=status.HTTP_200_OK , response_model=List[schemas.StationData])
def get_all_stations_data(
    auth: schemas.User = Depends(oauth2.get_current_user),
    db: Session = Depends(get_db),
    # skip: int = Query(0, ge=0, description="Number of records to skip for pagination"),
    # limit: int = Query(10, ge=1, le=100, description="Maximum number of records to return"),
    # location: Optional[str] = Query(None, description="Filter by station location"),
    # sort_by: Optional[str] = Query("id", description="Field to sort by (e.g., 'id', 'location')"),
    # sort_order: Optional[str] = Query("asc", description="Sort order: 'asc' or 'desc'")
):
    """
    Retrieve weather stations data with optional filtering, pagination, and sorting.

    Admins can view all stations; regular users see only their stations.
    
    Args:
        auth (schemas.User): The authenticated user.
        db (Session): Database session dependency.
        skip (int): Number of records to skip for pagination.
        limit (int): Maximum number of records to return.
        location (Optional[str]): Filter by station location.
        sort_by (Optional[str]): Field to sort by.
        sort_order (Optional[str]): Sort order: ascending or descending.

    Returns:
        List[schemas.StationData]: A list of station instances.
    """
    
    # Base query
    query = db.query(models.Station)

    # Admins can see all stations, regular users see only their own
    if auth.is_admin != True:
        query = query.filter(models.Station.owner == auth.username)
    '''
    # Filtering by location (if provided)
    if location:
        query = query.filter(models.Station.location.ilike(f"%{location}%"))

    # Sorting logic
    if sort_order not in ["asc", "desc"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid sort order. Must be 'asc' or 'desc'."
        )
    sort_field = getattr(models.Station, sort_by, None)
    if not sort_field:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid sort_by field: {sort_by}"
        )
    query = query.order_by(sort_field.asc() if sort_order == "asc" else sort_field.desc())

    # Apply pagination
    stations = query.offset(skip).limit(limit).all()
    '''
    stations = query.all()
    # Check if no records found
    if not stations:
        # raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No stations found.")
        return []
    return stations

@router.get("/public", response_model=List[schemas.PublicStationData])
def get_public_stations(db: Session = Depends(get_db)):
    """
    Retrieve all public weather stations.
    """
    stations = db.query(models.Station).filter(models.Station.is_public == True).all()
    return stations


# # # DATA CRUD OPERATIONS

# CREATE DATA 
@router.post("/data", status_code=status.HTTP_201_CREATED, response_model=schemas.DataOut)
def create_data(
    received_data: schemas.DataCreate,
    auth_station: schemas.StationData = Depends(oauth2.authenticate_station),
    db: Session = Depends(get_db),
):
    """
    Create or update weather data for authenticated station.
    """
    try:
        from datetime import datetime
        current_time = datetime.utcnow()
        
        # Update station attributes including last_updated timestamp
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
                "last_updated": current_time,
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

# GET HISTORICAL DATA
from datetime import datetime, timedelta

@router.get("/{station_id}/historical_data", response_model=List[schemas.DataOut])
def get_historical_data(
    station_id: int,
    start_time: Optional[str] = Query(None, description="Start time for filtering (ISO format)"),
    end_time: Optional[str] = Query(None, description="End time for filtering (ISO format)"),
    auth: schemas.User = Depends(oauth2.get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Retrieve historical weather data for a specific station.
    If no time filters are provided, returns data from the last 24 hours
    relative to the most recent record.
    """
    # Ensure station exists
    station = db.query(models.Station).filter(models.Station.station_id == station_id).first()
    if not station:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Station with ID '{station_id}' not found."
        )

    # Check user authorization
    # Allow access if:
    # - station is public
    # - user is admin
    # - user is owner
    if not station.is_public:
        if auth is None or (not getattr(auth, 'is_admin', False) and getattr(auth, 'username', None) != station.owner):
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

    historical_data = query.order_by(models.Data.created_at.asc()).all()  # Ascending order

    if not historical_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No historical data found for the given filters."
        )

    return historical_data
