# Login System - Quick Start Guide

## ✅ Natapos na ang Login System!

Nakumpleto na ang login system para sa GleentForms. Narito ang mga features:

### Features:
- ✅ Login system na may authentication
- ✅ User at Admin roles
- ✅ Protected routes (kailangan mag-login muna)
- ✅ JWT token-based authentication
- ✅ MySQL database integration
- ✅ Python Flask backend
- ✅ React/Vite frontend

## 🚀 Paano i-setup:

### 1. Database Setup (MySQL)

```bash
# 1. Start MySQL sa XAMPP Control Panel

# 2. Create database at tables
mysql -u root -p < database/schema.sql

# 3. Initialize default accounts (with proper password hashing)
cd backend
pip install -r requirements.txt
python ../database/init_db.py
```

### 2. Backend Setup (Python Flask)

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Edit .env file - ilagay ang MySQL credentials:
# DB_HOST=localhost
# DB_NAME=gleentforms
# DB_USER=root
# DB_PASSWORD=your_password_here
# DB_PORT=3306

# Start backend server
python app.py
```

Backend ay mag-run sa `http://localhost:5000`

### 3. Frontend Setup (React/Vite)

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Frontend ay mag-run sa `http://localhost:8080`

## 🔑 Default Accounts:

**Admin Account:**
- Username: `admin`
- Password: `admin123`
- Role: `admin`

**User Account:**
- Username: `user`
- Password: `user123`
- Role: `user`

## 📁 File Structure:

```
├── backend/
│   ├── app.py              # Flask backend server
│   ├── requirements.txt    # Python dependencies
│   └── .env.example        # Environment variables template
├── database/
│   ├── schema.sql          # Database schema
│   └── init_db.py         # Initialize default accounts
├── client/
│   ├── pages/
│   │   └── Login.tsx      # Login page
│   ├── contexts/
│   │   └── AuthContext.tsx # Authentication context
│   └── components/
│       └── ProtectedRoute.tsx # Route protection
└── shared/
    └── api.ts              # Shared TypeScript types
```

## 🔐 How It Works:

1. **Login Flow:**
   - User nag-login sa `/login` page
   - Frontend sends credentials sa `/api/auth/login`
   - Backend verifies credentials sa MySQL database
   - Backend returns JWT token
   - Frontend stores token sa localStorage
   - User redirected sa home page

2. **Protected Routes:**
   - Lahat ng routes (maliban sa `/login`) ay protected
   - Kapag hindi authenticated, redirect sa `/login`
   - JWT token ay verified sa bawat request

3. **Role-based Access:**
   - System knows kung `user` o `admin` ang role
   - Pwede mag-add ng role-based restrictions sa future features

## 📝 Next Steps:

Para sa susunod na features:
- User management (create/edit users) - admin only
- Form creation - authenticated users
- Form sharing - authenticated users
- Response viewing - authenticated users

## ⚠️ Important Notes:

- **Change SECRET_KEY** sa production!
- **Change default passwords** sa production!
- **Secure your .env file** - huwag i-commit sa git!

