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

# Import RADIUS and Mikrotik clients
from radius_client import RadiusClient
from mikrotik_client import MikrotikClient

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

# Initialize RADIUS Client (optional - only if FreeRADIUS is configured)
RADIUS_ENABLED = os.environ.get('RADIUS_ENABLED', 'false').lower() == 'true'
radius_client = None

if RADIUS_ENABLED:
    try:
        radius_client = RadiusClient(
            host=os.environ.get('RADIUS_HOST', 'localhost'),
            user=os.environ.get('RADIUS_USER', 'radius'),
            password=os.environ.get('RADIUS_PASSWORD', ''),
            database=os.environ.get('RADIUS_DB', 'radius')
        )
        logging.info("RADIUS client initialized successfully")
    except Exception as e:
        logging.error(f"Failed to initialize RADIUS client: {e}")
        radius_client = None

# Initialize Mikrotik Client (optional - only if Mikrotik is configured)
MIKROTIK_ENABLED = os.environ.get('MIKROTIK_ENABLED', 'false').lower() == 'true'
mikrotik_client = None

if MIKROTIK_ENABLED:
    try:
        mikrotik_client = MikrotikClient(
            ip=os.environ.get('MIKROTIK_HOST', '192.168.1.1'),
            username=os.environ.get('MIKROTIK_USER', 'admin'),
            password=os.environ.get('MIKROTIK_PASSWORD', ''),
            port=int(os.environ.get('MIKROTIK_PORT', '443'))
        )
        logging.info("Mikrotik client initialized successfully")
    except Exception as e:
        logging.error(f"Failed to initialize Mikrotik client: {e}")
        mikrotik_client = None

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
    
    # Get package details if package_id provided
    package_name = None
    radius_group = "default_users"
    bandwidth_limit = "5M/10M"  # Default limit
    
    if customer.package_id:
        package = await db.packages.find_one({"id": customer.package_id}, {"_id": 0})
        if package:
            package_name = package['name']
            radius_group = f"package_{package['id']}"
            bandwidth_limit = f"{package['upload_speed']}M/{package['download_speed']}M"
    
    # Add to RADIUS if enabled
    if RADIUS_ENABLED and radius_client:
        try:
            success = radius_client.add_user(
                username=customer.radius_username,
                password=customer.radius_password,
                group=radius_group
            )
            if success:
                # Set bandwidth limit
                radius_client.set_bandwidth_limit(customer.radius_username, bandwidth_limit)
                logging.info(f"Added customer {customer.radius_username} to RADIUS with group {radius_group}")
            else:
                logging.warning(f"Failed to add customer {customer.radius_username} to RADIUS")
        except Exception as e:
            logging.error(f"RADIUS integration error for {customer.radius_username}: {e}")
    
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

# ==================== INVOICE & PAYMENT MODELS ====================

class Invoice(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invoice_number: str
    customer_id: str
    customer_name: str
    customer_phone: str
    package_id: Optional[str] = None
    package_name: Optional[str] = None
    amount: float
    issue_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    due_date: datetime
    status: str = "unpaid"  # unpaid, paid, overdue, cancelled
    payment_date: Optional[datetime] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InvoiceCreate(BaseModel):
    customer_id: str
    package_id: Optional[str] = None
    amount: float
    due_date: datetime
    notes: Optional[str] = None

class InvoiceUpdate(BaseModel):
    amount: Optional[float] = None
    due_date: Optional[datetime] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class PaymentCreate(BaseModel):
    invoice_id: str
    payment_method: str  # cash, credit_card, bank_transfer
    notes: Optional[str] = None

class Payment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_id: str
    customer_name: str
    invoice_id: Optional[str] = None
    invoice_number: Optional[str] = None
    amount: float
    payment_method: str
    payment_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DirectPaymentCreate(BaseModel):
    customer_id: str
    amount: float
    payment_method: str
    notes: Optional[str] = None

# ==================== DEVICE MODELS ====================

class Device(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    device_type: str  # modem, router, ont, switch
    brand: str
    model: str
    serial_number: str
    mac_address: Optional[str] = None
    status: str = "in_stock"  # in_stock, assigned, faulty, retired
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    assigned_date: Optional[datetime] = None
    purchase_date: Optional[datetime] = None
    purchase_price: Optional[float] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DeviceCreate(BaseModel):
    device_type: str
    brand: str
    model: str
    serial_number: str
    mac_address: Optional[str] = None
    purchase_date: Optional[datetime] = None
    purchase_price: Optional[float] = None
    notes: Optional[str] = None

class DeviceUpdate(BaseModel):
    device_type: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    mac_address: Optional[str] = None
    status: Optional[str] = None
    purchase_date: Optional[datetime] = None
    purchase_price: Optional[float] = None
    notes: Optional[str] = None

class DeviceAssign(BaseModel):
    customer_id: str

# ==================== INVOICE ROUTES ====================

@api_router.get("/invoices", response_model=List[Invoice])
async def get_invoices(
    search: Optional[str] = None,
    status: Optional[str] = None,
    customer_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: AdminUser = Depends(get_current_user)
):
    """Get invoices list with search and filters"""
    query = {}
    
    if search:
        query["$or"] = [
            {"invoice_number": {"$regex": search, "$options": "i"}},
            {"customer_name": {"$regex": search, "$options": "i"}},
            {"customer_phone": {"$regex": search, "$options": "i"}}
        ]
    
    if status:
        query["status"] = status
    
    if customer_id:
        query["customer_id"] = customer_id
    
    invoices = await db.invoices.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(None)
    
    # Convert datetime strings
    for invoice in invoices:
        for field in ['issue_date', 'due_date', 'payment_date', 'created_at', 'updated_at']:
            if invoice.get(field) and isinstance(invoice[field], str):
                invoice[field] = datetime.fromisoformat(invoice[field])
    
    return invoices

@api_router.post("/invoices", response_model=Invoice)
async def create_invoice(invoice: InvoiceCreate, current_user: AdminUser = Depends(get_current_user)):
    """Create new invoice"""
    # Get customer info
    customer = await db.customers.find_one({"id": invoice.customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Generate invoice number
    count = await db.invoices.count_documents({})
    invoice_number = f"FAT{str(count + 1).zfill(6)}"
    
    # Get package info if provided
    package_name = None
    if invoice.package_id:
        package = await db.packages.find_one({"id": invoice.package_id}, {"_id": 0})
        if package:
            package_name = package['name']
    
    # Create invoice
    invoice_dict = invoice.model_dump()
    invoice_obj = Invoice(
        **invoice_dict,
        invoice_number=invoice_number,
        customer_name=f"{customer['first_name']} {customer['last_name']}",
        customer_phone=customer['phone'],
        package_name=package_name
    )
    
    doc = invoice_obj.model_dump()
    for field in ['issue_date', 'due_date', 'payment_date', 'created_at', 'updated_at']:
        if doc.get(field):
            doc[field] = doc[field].isoformat()
    
    await db.invoices.insert_one(doc)
    
    # Update customer balance
    await db.customers.update_one(
        {"id": invoice.customer_id},
        {"$inc": {"balance": -invoice.amount}}
    )
    
    return invoice_obj

@api_router.get("/invoices/{invoice_id}", response_model=Invoice)
async def get_invoice(invoice_id: str, current_user: AdminUser = Depends(get_current_user)):
    """Get invoice details"""
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Convert datetime strings
    for field in ['issue_date', 'due_date', 'payment_date', 'created_at', 'updated_at']:
        if invoice.get(field) and isinstance(invoice[field], str):
            invoice[field] = datetime.fromisoformat(invoice[field])
    
    return Invoice(**invoice)

@api_router.put("/invoices/{invoice_id}", response_model=Invoice)
async def update_invoice(
    invoice_id: str,
    invoice_update: InvoiceUpdate,
    current_user: AdminUser = Depends(get_current_user)
):
    """Update invoice"""
    existing = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    update_data = invoice_update.model_dump(exclude_unset=True)
    
    # Update amount in customer balance if changed
    if 'amount' in update_data and update_data['amount'] != existing['amount']:
        diff = update_data['amount'] - existing['amount']
        await db.customers.update_one(
            {"id": existing['customer_id']},
            {"$inc": {"balance": -diff}}
        )
    
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    # Convert datetime to ISO string
    if 'due_date' in update_data and update_data['due_date']:
        update_data['due_date'] = update_data['due_date'].isoformat()
    
    await db.invoices.update_one({"id": invoice_id}, {"$set": update_data})
    
    # Get updated invoice
    updated = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    
    # Convert datetime strings
    for field in ['issue_date', 'due_date', 'payment_date', 'created_at', 'updated_at']:
        if updated.get(field) and isinstance(updated[field], str):
            updated[field] = datetime.fromisoformat(updated[field])
    
    return Invoice(**updated)

@api_router.post("/invoices/{invoice_id}/pay", response_model=Invoice)
async def pay_invoice(
    invoice_id: str,
    payment: PaymentCreate,
    current_user: AdminUser = Depends(get_current_user)
):
    """Record payment for invoice"""
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if invoice['status'] == 'paid':
        raise HTTPException(status_code=400, detail="Invoice already paid")
    
    # Update invoice
    payment_date = datetime.now(timezone.utc)
    await db.invoices.update_one(
        {"id": invoice_id},
        {"$set": {
            "status": "paid",
            "payment_date": payment_date.isoformat(),
            "payment_method": payment.payment_method,
            "updated_at": payment_date.isoformat()
        }}
    )
    
    # Update customer balance
    await db.customers.update_one(
        {"id": invoice['customer_id']},
        {"$inc": {"balance": invoice['amount']}}
    )
    
    # Create payment record
    customer = await db.customers.find_one({"id": invoice['customer_id']}, {"_id": 0})
    payment_obj = Payment(
        customer_id=invoice['customer_id'],
        customer_name=f"{customer['first_name']} {customer['last_name']}",
        invoice_id=invoice_id,
        invoice_number=invoice['invoice_number'],
        amount=invoice['amount'],
        payment_method=payment.payment_method,
        payment_date=payment_date,
        notes=payment.notes
    )
    
    payment_doc = payment_obj.model_dump()
    payment_doc['payment_date'] = payment_doc['payment_date'].isoformat()
    payment_doc['created_at'] = payment_doc['created_at'].isoformat()
    
    await db.payments.insert_one(payment_doc)
    
    # Get updated invoice
    updated = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    
    # Convert datetime strings
    for field in ['issue_date', 'due_date', 'payment_date', 'created_at', 'updated_at']:
        if updated.get(field) and isinstance(updated[field], str):
            updated[field] = datetime.fromisoformat(updated[field])
    
    return Invoice(**updated)

@api_router.delete("/invoices/{invoice_id}")
async def cancel_invoice(invoice_id: str, current_user: AdminUser = Depends(get_current_user)):
    """Cancel invoice"""
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if invoice['status'] == 'paid':
        raise HTTPException(status_code=400, detail="Cannot cancel paid invoice")
    
    # Update invoice status
    await db.invoices.update_one(
        {"id": invoice_id},
        {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Update customer balance
    await db.customers.update_one(
        {"id": invoice['customer_id']},
        {"$inc": {"balance": invoice['amount']}}
    )
    
    return {"message": "Invoice cancelled successfully"}

# ==================== PAYMENT ROUTES ====================

@api_router.get("/payments", response_model=List[Payment])
async def get_payments(
    customer_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: AdminUser = Depends(get_current_user)
):
    """Get payments list"""
    query = {}
    if customer_id:
        query["customer_id"] = customer_id
    
    payments = await db.payments.find(query, {"_id": 0}).sort("payment_date", -1).skip(skip).limit(limit).to_list(None)
    
    # Convert datetime strings
    for payment in payments:
        for field in ['payment_date', 'created_at']:
            if payment.get(field) and isinstance(payment[field], str):
                payment[field] = datetime.fromisoformat(payment[field])
    
    return payments

@api_router.post("/payments", response_model=Payment)
async def create_direct_payment(payment: DirectPaymentCreate, current_user: AdminUser = Depends(get_current_user)):
    """Create direct payment (not linked to invoice)"""
    # Get customer info
    customer = await db.customers.find_one({"id": payment.customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Create payment
    payment_obj = Payment(
        customer_id=payment.customer_id,
        customer_name=f"{customer['first_name']} {customer['last_name']}",
        amount=payment.amount,
        payment_method=payment.payment_method,
        notes=payment.notes
    )
    
    doc = payment_obj.model_dump()
    doc['payment_date'] = doc['payment_date'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.payments.insert_one(doc)
    
    # Update customer balance
    await db.customers.update_one(
        {"id": payment.customer_id},
        {"$inc": {"balance": payment.amount}}
    )
    
    return payment_obj

# ==================== DEVICE ROUTES ====================

@api_router.get("/devices", response_model=List[Device])
async def get_devices(
    search: Optional[str] = None,
    status: Optional[str] = None,
    device_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: AdminUser = Depends(get_current_user)
):
    """Get devices list with search and filters"""
    query = {}
    
    if search:
        query["$or"] = [
            {"brand": {"$regex": search, "$options": "i"}},
            {"model": {"$regex": search, "$options": "i"}},
            {"serial_number": {"$regex": search, "$options": "i"}},
            {"mac_address": {"$regex": search, "$options": "i"}}
        ]
    
    if status:
        query["status"] = status
    
    if device_type:
        query["device_type"] = device_type
    
    devices = await db.devices.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(None)
    
    # Convert datetime strings
    for device in devices:
        for field in ['assigned_date', 'purchase_date', 'created_at', 'updated_at']:
            if device.get(field) and isinstance(device[field], str):
                device[field] = datetime.fromisoformat(device[field])
    
    return devices

@api_router.post("/devices", response_model=Device)
async def create_device(device: DeviceCreate, current_user: AdminUser = Depends(get_current_user)):
    """Create new device"""
    # Check if serial number exists
    existing = await db.devices.find_one({"serial_number": device.serial_number})
    if existing:
        raise HTTPException(status_code=400, detail="Serial number already exists")
    
    device_obj = Device(**device.model_dump())
    
    doc = device_obj.model_dump()
    for field in ['assigned_date', 'purchase_date', 'created_at', 'updated_at']:
        if doc.get(field):
            doc[field] = doc[field].isoformat()
    
    await db.devices.insert_one(doc)
    return device_obj

@api_router.get("/devices/{device_id}", response_model=Device)
async def get_device(device_id: str, current_user: AdminUser = Depends(get_current_user)):
    """Get device details"""
    device = await db.devices.find_one({"id": device_id}, {"_id": 0})
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    # Convert datetime strings
    for field in ['assigned_date', 'purchase_date', 'created_at', 'updated_at']:
        if device.get(field) and isinstance(device[field], str):
            device[field] = datetime.fromisoformat(device[field])
    
    return Device(**device)

@api_router.put("/devices/{device_id}", response_model=Device)
async def update_device(
    device_id: str,
    device_update: DeviceUpdate,
    current_user: AdminUser = Depends(get_current_user)
):
    """Update device"""
    existing = await db.devices.find_one({"id": device_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Device not found")
    
    update_data = device_update.model_dump(exclude_unset=True)
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    # Convert datetime to ISO string
    if 'purchase_date' in update_data and update_data['purchase_date']:
        update_data['purchase_date'] = update_data['purchase_date'].isoformat()
    
    await db.devices.update_one({"id": device_id}, {"$set": update_data})
    
    # Get updated device
    updated = await db.devices.find_one({"id": device_id}, {"_id": 0})
    
    # Convert datetime strings
    for field in ['assigned_date', 'purchase_date', 'created_at', 'updated_at']:
        if updated.get(field) and isinstance(updated[field], str):
            updated[field] = datetime.fromisoformat(updated[field])
    
    return Device(**updated)

@api_router.post("/devices/{device_id}/assign", response_model=Device)
async def assign_device(
    device_id: str,
    assignment: DeviceAssign,
    current_user: AdminUser = Depends(get_current_user)
):
    """Assign device to customer"""
    device = await db.devices.find_one({"id": device_id}, {"_id": 0})
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    if device['status'] != 'in_stock':
        raise HTTPException(status_code=400, detail="Device is not available")
    
    customer = await db.customers.find_one({"id": assignment.customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Update device
    await db.devices.update_one(
        {"id": device_id},
        {"$set": {
            "status": "assigned",
            "customer_id": assignment.customer_id,
            "customer_name": f"{customer['first_name']} {customer['last_name']}",
            "assigned_date": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Get updated device
    updated = await db.devices.find_one({"id": device_id}, {"_id": 0})
    
    # Convert datetime strings
    for field in ['assigned_date', 'purchase_date', 'created_at', 'updated_at']:
        if updated.get(field) and isinstance(updated[field], str):
            updated[field] = datetime.fromisoformat(updated[field])
    
    return Device(**updated)

@api_router.post("/devices/{device_id}/unassign", response_model=Device)
async def unassign_device(device_id: str, current_user: AdminUser = Depends(get_current_user)):
    """Unassign device from customer"""
    device = await db.devices.find_one({"id": device_id}, {"_id": 0})
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    # Update device
    await db.devices.update_one(
        {"id": device_id},
        {"$set": {
            "status": "in_stock",
            "customer_id": None,
            "customer_name": None,
            "assigned_date": None,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Get updated device
    updated = await db.devices.find_one({"id": device_id}, {"_id": 0})
    
    # Convert datetime strings
    for field in ['assigned_date', 'purchase_date', 'created_at', 'updated_at']:
        if updated.get(field) and isinstance(updated[field], str):
            updated[field] = datetime.fromisoformat(updated[field])
    
    return Device(**updated)

@api_router.delete("/devices/{device_id}")
async def delete_device(device_id: str, current_user: AdminUser = Depends(get_current_user)):
    """Delete device"""
    device = await db.devices.find_one({"id": device_id}, {"_id": 0})
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    if device['status'] == 'assigned':
        raise HTTPException(status_code=400, detail="Cannot delete assigned device")
    
    result = await db.devices.delete_one({"id": device_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Device not found")
    return {"message": "Device deleted successfully"}

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
