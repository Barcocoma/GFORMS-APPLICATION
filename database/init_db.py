"""
Script to initialize database with proper password hashing
Run this after creating the database schema
"""
import mysql.connector
import bcrypt
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend directory
backend_dir = Path(__file__).parent.parent / 'backend'
env_path = backend_dir / '.env'
load_dotenv(env_path)

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'database': os.getenv('DB_NAME', 'gleentforms'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'port': int(os.getenv('DB_PORT', 3306))
}

def hash_password(password):
    """Hash password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def init_database():
    """Initialize database with default accounts"""
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor()
        
        # Hash passwords
        admin_password = hash_password('admin123')
        user_password = hash_password('user123')
        
        # Insert or update default accounts
        cursor.execute("""
            INSERT INTO users (username, password, role) 
            VALUES ('admin', %s, 'admin')
            ON DUPLICATE KEY UPDATE password = VALUES(password)
        """, (admin_password,))
        
        cursor.execute("""
            INSERT INTO users (username, password, role) 
            VALUES ('user', %s, 'user')
            ON DUPLICATE KEY UPDATE password = VALUES(password)
        """, (user_password,))
        
        connection.commit()
        print("✓ Default accounts created successfully!")
        print("  Admin: username='admin', password='admin123'")
        print("  User:  username='user', password='user123'")
        
        cursor.close()
        connection.close()
        
    except Exception as e:
        print(f"Error initializing database: {e}")

if __name__ == '__main__':
    init_database()

