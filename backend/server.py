from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import os
import logging
import jwt
import bcrypt
from pathlib import Path
import uuid

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 hours

# Create the main app
app = FastAPI(title="WiRadius ISP CRM API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# ==================== MODELS ====================

# Admin Models
class AdminUser(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: EmailStr
    full_name: str
    role: str = "admin"  # admin, operator, technician
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AdminCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: str
    role: str = "admin"

class AdminLogin(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AdminUser

# Customer Models
class Customer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_number: str  # Unique customer number
    first_name: str
    last_name: str
    email: Optional[EmailStr] = None
    phone: str
    national_id: Optional[str] = None  # TC Kimlik No
    address: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    radius_username: str  # RADIUS username
    radius_password: str  # RADIUS password
    status: str = "active"  # active, suspended, inactive
    connection_status: str = "offline"  # online, offline
    package_id: Optional[str] = None
    package_name: Optional[str] = None
    activation_date: Optional[datetime] = None
    suspension_date: Optional[datetime] = None
    balance: float = 0.0  # Borç/Alacak (-borç, +alacak)
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CustomerCreate(BaseModel):
    first_name: str
    last_name: str
    email: Optional[EmailStr] = None
    phone: str
    national_id: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    radius_username: str
    radius_password: str
    package_id: Optional[str] = None
    notes: Optional[str] = None

class CustomerUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    national_id: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    radius_password: Optional[str] = None
    package_id: Optional[str] = None
    notes: Optional[str] = None

class CustomerStatusUpdate(BaseModel):
    status: str  # active, suspended, inactive

# Package Models
class Package(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    download_speed: int  # Mbps
    upload_speed: int  # Mbps
    traffic_limit: Optional[int] = None  # GB (None = unlimited)
    price: float
    duration_days: int = 30  # Default monthly
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PackageCreate(BaseModel):
    name: str
    description: Optional[str] = None
    download_speed: int
    upload_speed: int
    traffic_limit: Optional[int] = None
    price: float
    duration_days: int = 30

class PackageUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    download_speed: Optional[int] = None
    upload_speed: Optional[int] = None
    traffic_limit: Optional[int] = None
    price: Optional[float] = None
    duration_days: Optional[int] = None
    is_active: Optional[bool] = None

# Dashboard Stats Model
class DashboardStats(BaseModel):
    total_customers: int
    active_customers: int
    suspended_customers: int
    inactive_customers: int
    online_customers: int
    total_packages: int
    monthly_revenue: float
    pending_payments: float
    new_customers_this_month: int

# ==================== HELPER FUNCTIONS ====================

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        return username
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(username: str = Depends(verify_token)):
    user = await db.admin_users.find_one({"username": username}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return AdminUser(**user)

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=AdminUser)
async def register_admin(admin: AdminCreate):
    """Register new admin user"""
    # Check if username exists
    existing = await db.admin_users.find_one({"username": admin.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Hash password
    hashed_pw = hash_password(admin.password)
    
    # Create admin user
    admin_dict = admin.model_dump(exclude={'password'})
    admin_obj = AdminUser(**admin_dict)
    
    doc = admin_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['password'] = hashed_pw
    
    await db.admin_users.insert_one(doc)
    return admin_obj

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: AdminLogin):
    """Admin login"""
    user = await db.admin_users.find_one({"username": credentials.username}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    if not verify_password(credentials.password, user['password']):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    if not user.get('is_active', True):
        raise HTTPException(status_code=401, detail="User account is disabled")
    
    # Create access token
    access_token = create_access_token(data={"sub": user['username']})
    
    # Parse user
    user_obj = AdminUser(**user)
    
    return TokenResponse(access_token=access_token, user=user_obj)

@api_router.get("/auth/me", response_model=AdminUser)
async def get_current_user_info(current_user: AdminUser = Depends(get_current_user)):
    """Get current user info"""
    return current_user

# ==================== DASHBOARD ROUTES ====================

@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: AdminUser = Depends(get_current_user)):
    """Get dashboard statistics"""
    # Count customers by status
    total_customers = await db.customers.count_documents({})
    active_customers = await db.customers.count_documents({"status": "active"})
    suspended_customers = await db.customers.count_documents({"status": "suspended"})
    inactive_customers = await db.customers.count_documents({"status": "inactive"})
    online_customers = await db.customers.count_documents({"connection_status": "online"})
    
    # Count packages
    total_packages = await db.packages.count_documents({"is_active": True})
    
    # Calculate monthly revenue (mock for now)
    monthly_revenue = 0.0
    pending_payments = 0.0
    
    # Calculate balance
    customers = await db.customers.find({}, {"balance": 1, "_id": 0}).to_list(None)
    for customer in customers:
        balance = customer.get('balance', 0)
        if balance < 0:
            pending_payments += abs(balance)
        elif balance > 0:
            monthly_revenue += balance
    
    # New customers this month
    start_of_month = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    new_customers = await db.customers.count_documents({
        "created_at": {"$gte": start_of_month.isoformat()}
    })
    
    return DashboardStats(
        total_customers=total_customers,
        active_customers=active_customers,
        suspended_customers=suspended_customers,
        inactive_customers=inactive_customers,
        online_customers=online_customers,
        total_packages=total_packages,
        monthly_revenue=monthly_revenue,
        pending_payments=pending_payments,
        new_customers_this_month=new_customers
    )

# ==================== CUSTOMER ROUTES ====================

@api_router.get("/customers", response_model=List[Customer])
async def get_customers(
    search: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: AdminUser = Depends(get_current_user)
):
    """Get customers list with search and filters"""
    query = {}
    
    # Search by name, phone, customer number
    if search:
        query["$or"] = [
            {"first_name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"customer_number": {"$regex": search, "$options": "i"}},
            {"radius_username": {"$regex": search, "$options": "i"}}
        ]
    
    # Filter by status
    if status:
        query["status"] = status
    
    customers = await db.customers.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(None)
    
    # Convert datetime strings to datetime objects
    for customer in customers:
        for field in ['created_at', 'updated_at', 'activation_date', 'suspension_date']:
            if customer.get(field) and isinstance(customer[field], str):
                customer[field] = datetime.fromisoformat(customer[field])
    
    return customers

@api_router.post("/customers", response_model=Customer)
async def create_customer(customer: CustomerCreate, current_user: AdminUser = Depends(get_current_user)):
    """Create new customer"""
    # Check if radius_username exists
    existing = await db.customers.find_one({"radius_username": customer.radius_username})
    if existing:
        raise HTTPException(status_code=400, detail="RADIUS username already exists")
    
    # Generate customer number
    count = await db.customers.count_documents({})
    customer_number = f"ABN{str(count + 1).zfill(6)}"
    
    # Get package name if package_id provided
    package_name = None
    if customer.package_id:
        package = await db.packages.find_one({"id": customer.package_id}, {"_id": 0})
        if package:
            package_name = package['name']
    
    # Create customer object
    customer_dict = customer.model_dump()
    customer_obj = Customer(
        **customer_dict,
        customer_number=customer_number,
        package_name=package_name,
        status="active",
        activation_date=datetime.now(timezone.utc)
    )
    
    doc = customer_obj.model_dump()
    for field in ['created_at', 'updated_at', 'activation_date', 'suspension_date']:
        if doc.get(field):
            doc[field] = doc[field].isoformat()
    
    await db.customers.insert_one(doc)
    return customer_obj

@api_router.get("/customers/{customer_id}", response_model=Customer)
async def get_customer(customer_id: str, current_user: AdminUser = Depends(get_current_user)):
    """Get customer details"""
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Convert datetime strings
    for field in ['created_at', 'updated_at', 'activation_date', 'suspension_date']:
        if customer.get(field) and isinstance(customer[field], str):
            customer[field] = datetime.fromisoformat(customer[field])
    
    return Customer(**customer)

@api_router.put("/customers/{customer_id}", response_model=Customer)
async def update_customer(
    customer_id: str,
    customer_update: CustomerUpdate,
    current_user: AdminUser = Depends(get_current_user)
):
    """Update customer"""
    existing = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Update fields
    update_data = customer_update.model_dump(exclude_unset=True)
    
    # If package_id is updated, get package name
    if 'package_id' in update_data and update_data['package_id']:
        package = await db.packages.find_one({"id": update_data['package_id']}, {"_id": 0})
        if package:
            update_data['package_name'] = package['name']
    
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.customers.update_one({"id": customer_id}, {"$set": update_data})
    
    # Get updated customer
    updated = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    
    # Convert datetime strings
    for field in ['created_at', 'updated_at', 'activation_date', 'suspension_date']:
        if updated.get(field) and isinstance(updated[field], str):
            updated[field] = datetime.fromisoformat(updated[field])
    
    return Customer(**updated)

@api_router.patch("/customers/{customer_id}/status", response_model=Customer)
async def update_customer_status(
    customer_id: str,
    status_update: CustomerStatusUpdate,
    current_user: AdminUser = Depends(get_current_user)
):
    """Update customer status"""
    existing = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    update_data = {
        "status": status_update.status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if status_update.status == "suspended":
        update_data["suspension_date"] = datetime.now(timezone.utc).isoformat()
    elif status_update.status == "active":
        update_data["suspension_date"] = None
        if not existing.get('activation_date'):
            update_data["activation_date"] = datetime.now(timezone.utc).isoformat()
    
    await db.customers.update_one({"id": customer_id}, {"$set": update_data})
    
    # Get updated customer
    updated = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    
    # Convert datetime strings
    for field in ['created_at', 'updated_at', 'activation_date', 'suspension_date']:
        if updated.get(field) and isinstance(updated[field], str):
            updated[field] = datetime.fromisoformat(updated[field])
    
    return Customer(**updated)

@api_router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, current_user: AdminUser = Depends(get_current_user)):
    """Delete customer"""
    result = await db.customers.delete_one({"id": customer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Customer deleted successfully"}

# ==================== PACKAGE ROUTES ====================

@api_router.get("/packages", response_model=List[Package])
async def get_packages(current_user: AdminUser = Depends(get_current_user)):
    """Get all packages"""
    packages = await db.packages.find({"is_active": True}, {"_id": 0}).to_list(None)
    
    # Convert datetime strings
    for package in packages:
        if package.get('created_at') and isinstance(package['created_at'], str):
            package['created_at'] = datetime.fromisoformat(package['created_at'])
    
    return packages

@api_router.post("/packages", response_model=Package)
async def create_package(package: PackageCreate, current_user: AdminUser = Depends(get_current_user)):
    """Create new package"""
    package_obj = Package(**package.model_dump())
    
    doc = package_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.packages.insert_one(doc)
    return package_obj

@api_router.put("/packages/{package_id}", response_model=Package)
async def update_package(
    package_id: str,
    package_update: PackageUpdate,
    current_user: AdminUser = Depends(get_current_user)
):
    """Update package"""
    existing = await db.packages.find_one({"id": package_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Package not found")
    
    update_data = package_update.model_dump(exclude_unset=True)
    await db.packages.update_one({"id": package_id}, {"$set": update_data})
    
    # Update package_name in customers
    if 'name' in update_data:
        await db.customers.update_many(
            {"package_id": package_id},
            {"$set": {"package_name": update_data['name']}}
        )
    
    # Get updated package
    updated = await db.packages.find_one({"id": package_id}, {"_id": 0})
    
    if updated.get('created_at') and isinstance(updated['created_at'], str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    
    return Package(**updated)

@api_router.delete("/packages/{package_id}")
async def delete_package(package_id: str, current_user: AdminUser = Depends(get_current_user)):
    """Delete package (soft delete)"""
    result = await db.packages.update_one(
        {"id": package_id},
        {"$set": {"is_active": False}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Package not found")
    return {"message": "Package deleted successfully"}

# ==================== INCLUDE ROUTER ====================

app.include_router(api_router)

# ==================== CORS MIDDLEWARE ====================

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

@app.get("/")
async def root():
    return {"message": "WiRadius ISP CRM API", "version": "1.0.0"}
