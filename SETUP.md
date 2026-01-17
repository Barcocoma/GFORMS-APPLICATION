# Setup Instructions - GleentForms Login System

## Prerequisites

1. **Node.js** and **pnpm** (for frontend)
2. **Python 3.8+** (for backend)
3. **MySQL** (XAMPP includes MySQL)

## Database Setup

1. **Start MySQL** (via XAMPP Control Panel)

2. **Create the database and tables:**
   ```bash
   mysql -u root -p < database/schema.sql
   ```
   Or manually run the SQL file in phpMyAdmin.

3. **Initialize default accounts with proper password hashing:**
   ```bash
   cd backend
   pip install -r requirements.txt
   python ../database/init_db.py
   ```

   This will create:
   - **Admin account**: username=`admin`, password=`admin123`
   - **User account**: username=`user`, password=`user123`

## Backend Setup (Python Flask)

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Create `.env` file** (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

4. **Update `.env` with your MySQL credentials:**
   ```
   DB_HOST=localhost
   DB_NAME=gleentforms
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_PORT=3306
   SECRET_KEY=your-secret-key-change-in-production
   ```

5. **Start the Flask backend:**
   ```bash
   python app.py
   ```
   The backend will run on `http://localhost:5000`

## Frontend Setup (React/Vite)

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Start the development server:**
   ```bash
   pnpm dev
   ```
   The frontend will run on `http://localhost:8080`

## Default Login Credentials

- **Admin Account:**
  - Username: `admin`
  - Password: `admin123`
  - Role: `admin`

- **User Account:**
  - Username: `user`
  - Password: `user123`
  - Role: `user`

## Running the Application

1. **Start MySQL** (XAMPP)
2. **Start Python backend:** `cd backend && python app.py`
3. **Start React frontend:** `pnpm dev`
4. **Open browser:** `http://localhost:8080`
5. **Login** with one of the default accounts

## API Endpoints

- `POST /api/auth/login` - Login endpoint
- `GET /api/auth/verify` - Verify token (requires authentication)
- `POST /api/auth/logout` - Logout endpoint (requires authentication)

## Notes

- The frontend proxies API requests to the Python backend automatically
- JWT tokens are stored in localStorage
- Protected routes require authentication
- Admin and User roles are supported

