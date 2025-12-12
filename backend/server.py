from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timedelta
import jwt
import bcrypt
import uuid
import json
import pymongo

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

class InMemoryDB:
    def __init__(self):
        self.users = {}
        self.forms = {}
        self.responses = {}

db = InMemoryDB()

DATA_DIR = ROOT_DIR / 'data'
USERS_FILE = DATA_DIR / 'users.json'
FORMS_FILE = DATA_DIR / 'forms.json'
RESPONSES_FILE = DATA_DIR / 'responses.json'

def load_users():
    try:
        if USERS_FILE.exists():
            with open(USERS_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                parsed = {}
                for k, v in data.items():
                    created = v.get("createdAt")
                    if isinstance(created, str):
                        try:
                            v["createdAt"] = datetime.fromisoformat(created)
                        except Exception:
                            v["createdAt"] = datetime.utcnow()
                    parsed[k] = v
                db.users = parsed
    except Exception:
        pass

def save_users():
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        to_save = {}
        for k, v in db.users.items():
            u = dict(v)
            created = u.get("createdAt")
            if isinstance(created, datetime):
                u["createdAt"] = created.isoformat()
            to_save[k] = u
        with open(USERS_FILE, 'w', encoding='utf-8') as f:
            json.dump(to_save, f)
    except Exception:
        pass

load_users()

def load_forms():
    try:
        if FORMS_FILE.exists():
            with open(FORMS_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                parsed = {}
                for k, v in data.items():
                    ca = v.get("createdAt")
                    ua = v.get("updatedAt")
                    if isinstance(ca, str):
                        try:
                            v["createdAt"] = datetime.fromisoformat(ca)
                        except Exception:
                            v["createdAt"] = datetime.utcnow()
                    if isinstance(ua, str):
                        try:
                            v["updatedAt"] = datetime.fromisoformat(ua)
                        except Exception:
                            v["updatedAt"] = datetime.utcnow()
                    parsed[k] = v
                db.forms = parsed
    except Exception:
        pass

def save_forms():
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        out = {}
        for k, v in db.forms.items():
            f = dict(v)
            ca = f.get("createdAt")
            ua = f.get("updatedAt")
            if isinstance(ca, datetime):
                f["createdAt"] = ca.isoformat()
            if isinstance(ua, datetime):
                f["updatedAt"] = ua.isoformat()
            out[k] = f
        with open(FORMS_FILE, 'w', encoding='utf-8') as fw:
            json.dump(out, fw)
    except Exception:
        pass

def load_responses():
    try:
        if RESPONSES_FILE.exists():
            with open(RESPONSES_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                parsed = {}
                for k, v in data.items():
                    sa = v.get("submittedAt")
                    if isinstance(sa, str):
                        try:
                            v["submittedAt"] = datetime.fromisoformat(sa)
                        except Exception:
                            v["submittedAt"] = datetime.utcnow()
                    parsed[k] = v
                db.responses = parsed
    except Exception:
        pass

def save_responses():
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        out = {}
        for k, v in db.responses.items():
            r = dict(v)
            sa = r.get("submittedAt")
            if isinstance(sa, datetime):
                r["submittedAt"] = sa.isoformat()
            out[k] = r
        with open(RESPONSES_FILE, 'w', encoding='utf-8') as fw:
            json.dump(out, fw)
    except Exception:
        pass

load_forms()
load_responses()

# Security
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
security = HTTPBearer()

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

MONGODB_URI = os.environ.get("MONGODB_URI") or os.environ.get("MONGO_URI")
MONGO_DB_NAME = os.environ.get("MONGO_DB", "bemestar")
mongo_client = None
mongo_db = None

def init_mongo_architecture():
    global mongo_client, mongo_db
    if not MONGODB_URI:
        return
    mongo_client = pymongo.MongoClient(MONGODB_URI)
    mongo_db = mongo_client.get_database(MONGO_DB_NAME)
    mongo_db.users.create_index("username", unique=True)
    mongo_db.users.create_index("email", unique=False)
    mongo_db.forms.create_index("createdBy")
    mongo_db.forms.create_index("assignedPatients")
    mongo_db.forms.create_index([("createdBy", pymongo.ASCENDING), ("title", pymongo.ASCENDING)], unique=False)
    mongo_db.responses.create_index("formId")
    mongo_db.responses.create_index("patientId")
    mongo_db.responses.create_index([("formId", pymongo.ASCENDING), ("patientId", pymongo.ASCENDING)], unique=True)

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
    assignedPatientIds: Optional[List[str]] = []

class FormUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    questions: Optional[List[Question]] = None
    assignedPatientIds: Optional[List[str]] = None

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

def is_patient_role(role: str) -> bool:
    return str(role).lower() in {"patient", "patiente"}

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = db.users.get(user_id)
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
    existing_user = next((u for u in db.users.values() if u["username"] == user_data.username), None)
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    hashed_password = get_password_hash(user_data.password)
    user_id = uuid.uuid4().hex
    user = {
        "username": user_data.username,
        "password": hashed_password,
        "name": user_data.name,
        "email": user_data.email,
        "role": user_data.role,
        "isPatient": is_patient_role(user_data.role),
        "createdAt": datetime.utcnow(),
        "_id": user_id
    }
    db.users[user_id] = user
    save_users()
    
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
    user = next((u for u in db.users.values() if u["username"] == credentials.username), None)
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
    recent_duplicate = next(
        (
            f for f in db.forms.values()
            if f.get("createdBy") == str(current_user["_id"]) and f.get("title") == form_data.title and (datetime.utcnow() - f["createdAt"]).total_seconds() < 5
        ),
        None,
    )
    if recent_duplicate:
        raise HTTPException(status_code=409, detail="Duplicate form submission detected")
    
    form_id = uuid.uuid4().hex
    form = {
        "title": form_data.title,
        "description": form_data.description,
        "questions": [q.dict() for q in form_data.questions],
        "createdBy": str(current_user["_id"]),
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
        "assignedPatients": [
            pid for pid in (form_data.assignedPatientIds or [])
            if (
                is_patient_role(db.users.get(pid, {}).get("role"))
                or bool(db.users.get(pid, {}).get("isPatient"))
            )
        ],
        "_id": form_id
    }
    db.forms[form_id] = form
    save_forms()
    
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
    
    forms = [f for f in db.forms.values() if f.get("createdBy") == str(current_user["_id"])]
    
    result = []
    for form in forms:
        response_count = sum(1 for r in db.responses.values() if r.get("formId") == str(form["_id"]))
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
    form = db.forms.get(form_id)
    
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    if current_user["role"] == "psychologist" and form["createdBy"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
    if is_patient_role(current_user["role"]) and str(current_user["_id"]) not in form.get("assignedPatients", []):
        raise HTTPException(status_code=403, detail="Form not assigned to you")
    
    return {
        "id": str(form["_id"]),
        "title": form["title"],
        "description": form.get("description", ""),
        "questions": form.get("questions", []),
        "assignedPatients": form.get("assignedPatients", []),
        "createdAt": form["createdAt"].isoformat(),
        "updatedAt": form["updatedAt"].isoformat()
    }

@api_router.put("/forms/{form_id}")
async def update_form(form_id: str, form_data: FormUpdate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "psychologist":
        raise HTTPException(status_code=403, detail="Only psychologists can update forms")
    
    form = db.forms.get(form_id)
    
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
    if form_data.assignedPatientIds is not None:
        update_data["assignedPatients"] = [
            pid for pid in (form_data.assignedPatientIds or [])
            if (
                is_patient_role(db.users.get(pid, {}).get("role"))
                or bool(db.users.get(pid, {}).get("isPatient"))
            )
        ]
    
    db.forms[form_id].update(update_data)
    updated_form = db.forms.get(form_id)
    save_forms()
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
    
    form = db.forms.get(form_id)
    
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    if form["createdBy"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db.forms.pop(form_id, None)
    db.responses = {rid: r for rid, r in db.responses.items() if r.get("formId") != form_id}
    save_forms()
    save_responses()
    
    return {"message": "Form deleted successfully"}

@api_router.get("/forms/{form_id}/responses")
async def get_form_responses(form_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "psychologist":
        raise HTTPException(status_code=403, detail="Only psychologists can view responses")
    
    form = db.forms.get(form_id)
    
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    if form["createdBy"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    responses = [r for r in db.responses.values() if r.get("formId") == form_id]
    
    result = []
    for response in responses:
        patient = db.users.get(response["patientId"])
        result.append({
            "id": str(response.get("_id")),
            "patientName": patient["name"] if patient else "Unknown",
            "patientEmail": patient["email"] if patient else "Unknown",
            "answers": response["answers"],
            "submittedAt": response["submittedAt"].isoformat()
        })
    
    return result

# Patient routes
@api_router.get("/patient/forms")
async def get_available_forms(current_user: dict = Depends(get_current_user)):
    if not is_patient_role(current_user["role"]):
        raise HTTPException(status_code=403, detail="Only patients can view available forms")
    
    responded_form_ids = {r.get("formId") for r in db.responses.values() if r.get("patientId") == str(current_user["_id"])}
    forms = [f for f in db.forms.values() if str(f.get("_id")) not in responded_form_ids and str(current_user["_id"]) in f.get("assignedPatients", [])]
    
    result = []
    for form in forms:
        psychologist = db.users.get(form["createdBy"])
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
    if not is_patient_role(current_user["role"]):
        raise HTTPException(status_code=403, detail="Only patients can submit responses")
    form = db.forms.get(response_data.formId)
    
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    if str(current_user["_id"]) not in form.get("assignedPatients", []):
        raise HTTPException(status_code=403, detail="Form not assigned to you")
    
    already = next((
        r for r in db.responses.values()
        if r.get("formId") == response_data.formId and r.get("patientId") == str(current_user["_id"])
    ), None)
    if already:
        raise HTTPException(status_code=409, detail="You have already responded to this form")
    
    response = {
        "formId": response_data.formId,
        "formTitle": form["title"],
        "patientId": str(current_user["_id"]),
        "answers": [a.dict() for a in response_data.answers],
        "submittedAt": datetime.utcnow(),
    }
    response_id = uuid.uuid4().hex
    response["_id"] = response_id
    db.responses[response_id] = response
    save_responses()
    
    return {
        "id": str(response_id),
        "message": "Response submitted successfully"
    }

@api_router.get("/responses/my")
async def get_my_responses(current_user: dict = Depends(get_current_user)):
    if not is_patient_role(current_user["role"]):
        raise HTTPException(status_code=403, detail="Only patients can view their responses")
    
    responses = [r for r in db.responses.values() if r.get("patientId") == str(current_user["_id"])]
    
    result = []
    for response in responses:
        result.append({
            "id": str(response.get("_id")),
            "formTitle": response.get("formTitle", "Unknown Form"),
            "answers": response["answers"],
            "submittedAt": response["submittedAt"].isoformat()
        })
    
    return result

# NOTE: router inclusion and middleware registration moved to end of file

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    return
@app.on_event("startup")
async def startup_event():
    init_mongo_architecture()
@api_router.get("/patients")
async def list_patients(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "psychologist":
        raise HTTPException(status_code=403, detail="Only psychologists can list patients")
    patients = [
        {
            "id": str(u.get("_id")),
            "name": u.get("name"),
            "email": u.get("email"),
            "username": u.get("username"),
        }
        for u in db.users.values() if is_patient_role(u.get("role")) or bool(u.get("isPatient"))
    ]
    return patients

# Include the router and middleware at the end, after all routes have been defined
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
