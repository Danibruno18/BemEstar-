from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timedelta
import jwt
from bson import ObjectId
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
security = HTTPBearer()

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
class UserRegister(BaseModel):
    username: str
    password: str
    name: str
    email: str
    role: str  # 'psychologist' or 'patient'

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

class Question(BaseModel):
    id: str
    text: str
    order: int

class FormCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    questions: List[Question]

class FormUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    questions: Optional[List[Question]] = None

class Answer(BaseModel):
    questionId: str
    questionText: str
    answerText: str

class ResponseCreate(BaseModel):
    formId: str
    answers: List[Answer]

# Helper functions
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=7)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Auth routes
@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserRegister):
    # Check if username exists
    existing_user = await db.users.find_one({"username": user_data.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Create user
    hashed_password = get_password_hash(user_data.password)
    user = {
        "username": user_data.username,
        "password": hashed_password,
        "name": user_data.name,
        "email": user_data.email,
        "role": user_data.role,
        "createdAt": datetime.utcnow()
    }
    result = await db.users.insert_one(user)
    user["_id"] = result.inserted_id
    
    # Create token
    access_token = create_access_token(data={"sub": str(user["_id"]), "role": user["role"]})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user["_id"]),
            "username": user["username"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"]
        }
    }

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"username": credentials.username})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(data={"sub": str(user["_id"]), "role": user["role"]})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user["_id"]),
            "username": user["username"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"]
        }
    }

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": str(current_user["_id"]),
        "username": current_user["username"],
        "name": current_user["name"],
        "email": current_user["email"],
        "role": current_user["role"]
    }

# Psychologist routes - Forms
@api_router.post("/forms")
async def create_form(form_data: FormCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "psychologist":
        raise HTTPException(status_code=403, detail="Only psychologists can create forms")
    
    form = {
        "title": form_data.title,
        "description": form_data.description,
        "questions": [q.dict() for q in form_data.questions],
        "createdBy": str(current_user["_id"]),
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    result = await db.forms.insert_one(form)
    form["_id"] = result.inserted_id
    
    return {
        "id": str(form["_id"]),
        "title": form["title"],
        "description": form["description"],
        "questions": form["questions"],
        "createdAt": form["createdAt"].isoformat(),
        "updatedAt": form["updatedAt"].isoformat()
    }

@api_router.get("/forms")
async def get_forms(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "psychologist":
        raise HTTPException(status_code=403, detail="Only psychologists can view their forms")
    
    forms = await db.forms.find({"createdBy": str(current_user["_id"])}).to_list(1000)
    
    result = []
    for form in forms:
        # Count responses
        response_count = await db.responses.count_documents({"formId": str(form["_id"])})
        result.append({
            "id": str(form["_id"]),
            "title": form["title"],
            "description": form.get("description", ""),
            "questionCount": len(form.get("questions", [])),
            "responseCount": response_count,
            "createdAt": form["createdAt"].isoformat(),
            "updatedAt": form["updatedAt"].isoformat()
        })
    
    return result

@api_router.get("/forms/{form_id}")
async def get_form(form_id: str, current_user: dict = Depends(get_current_user)):
    try:
        form = await db.forms.find_one({"_id": ObjectId(form_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid form ID")
    
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    if current_user["role"] == "psychologist" and form["createdBy"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return {
        "id": str(form["_id"]),
        "title": form["title"],
        "description": form.get("description", ""),
        "questions": form.get("questions", []),
        "createdAt": form["createdAt"].isoformat(),
        "updatedAt": form["updatedAt"].isoformat()
    }

@api_router.put("/forms/{form_id}")
async def update_form(form_id: str, form_data: FormUpdate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "psychologist":
        raise HTTPException(status_code=403, detail="Only psychologists can update forms")
    
    try:
        form = await db.forms.find_one({"_id": ObjectId(form_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid form ID")
    
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    if form["createdBy"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {"updatedAt": datetime.utcnow()}
    if form_data.title is not None:
        update_data["title"] = form_data.title
    if form_data.description is not None:
        update_data["description"] = form_data.description
    if form_data.questions is not None:
        update_data["questions"] = [q.dict() for q in form_data.questions]
    
    await db.forms.update_one({"_id": ObjectId(form_id)}, {"$set": update_data})
    
    updated_form = await db.forms.find_one({"_id": ObjectId(form_id)})
    return {
        "id": str(updated_form["_id"]),
        "title": updated_form["title"],
        "description": updated_form.get("description", ""),
        "questions": updated_form.get("questions", []),
        "updatedAt": updated_form["updatedAt"].isoformat()
    }

@api_router.delete("/forms/{form_id}")
async def delete_form(form_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "psychologist":
        raise HTTPException(status_code=403, detail="Only psychologists can delete forms")
    
    try:
        form = await db.forms.find_one({"_id": ObjectId(form_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid form ID")
    
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    if form["createdBy"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.forms.delete_one({"_id": ObjectId(form_id)})
    await db.responses.delete_many({"formId": form_id})
    
    return {"message": "Form deleted successfully"}

@api_router.get("/forms/{form_id}/responses")
async def get_form_responses(form_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "psychologist":
        raise HTTPException(status_code=403, detail="Only psychologists can view responses")
    
    try:
        form = await db.forms.find_one({"_id": ObjectId(form_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid form ID")
    
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    if form["createdBy"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    responses = await db.responses.find({"formId": form_id}).to_list(1000)
    
    result = []
    for response in responses:
        patient = await db.users.find_one({"_id": ObjectId(response["patientId"])})
        result.append({
            "id": str(response["_id"]),
            "patientName": patient["name"] if patient else "Unknown",
            "patientEmail": patient["email"] if patient else "Unknown",
            "answers": response["answers"],
            "submittedAt": response["submittedAt"].isoformat()
        })
    
    return result

# Patient routes
@api_router.get("/patient/forms")
async def get_available_forms(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Only patients can view available forms")
    
    forms = await db.forms.find().to_list(1000)
    
    result = []
    for form in forms:
        psychologist = await db.users.find_one({"_id": ObjectId(form["createdBy"])})
        result.append({
            "id": str(form["_id"]),
            "title": form["title"],
            "description": form.get("description", ""),
            "questionCount": len(form.get("questions", [])),
            "psychologistName": psychologist["name"] if psychologist else "Unknown",
            "createdAt": form["createdAt"].isoformat()
        })
    
    return result

@api_router.post("/responses")
async def submit_response(response_data: ResponseCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Only patients can submit responses")
    
    try:
        form = await db.forms.find_one({"_id": ObjectId(response_data.formId)})
    except:
        raise HTTPException(status_code=400, detail="Invalid form ID")
    
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    response = {
        "formId": response_data.formId,
        "formTitle": form["title"],
        "patientId": str(current_user["_id"]),
        "answers": [a.dict() for a in response_data.answers],
        "submittedAt": datetime.utcnow()
    }
    result = await db.responses.insert_one(response)
    
    return {
        "id": str(result.inserted_id),
        "message": "Response submitted successfully"
    }

@api_router.get("/responses/my")
async def get_my_responses(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Only patients can view their responses")
    
    responses = await db.responses.find({"patientId": str(current_user["_id"])}).to_list(1000)
    
    result = []
    for response in responses:
        result.append({
            "id": str(response["_id"]),
            "formTitle": response.get("formTitle", "Unknown Form"),
            "answers": response["answers"],
            "submittedAt": response["submittedAt"].isoformat()
        })
    
    return result

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
