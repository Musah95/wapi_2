from sqlalchemy.orm import Session
from fastapi import Depends, FastAPI, Response, status, HTTPException, APIRouter
from .. import models, schemas, utils, oauth2
from ..database import get_db

router = APIRouter( prefix="/users", tags=['User'])


###### Create User
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


###### Get All Users
@router.get("/", status_code = status.HTTP_200_OK, response_model=list[schemas.User])
def get_users_all(
    auth = Depends(oauth2.get_current_user),
    db: Session = Depends(get_db)
    ):
    
    if not auth.is_admin:
        raise HTTPException(status_code = status.HTTP_401_UNAUTHORIZED, detail=f"unauthorized request")
    user_query = db.query(models.User)

    return user_query.all()


###### Get User by id
@router.get("/me", status_code = status.HTTP_200_OK, response_model=schemas.User)
def get_user(
    # id: int,
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

