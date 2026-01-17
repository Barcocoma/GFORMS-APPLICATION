"""
Quick script to check if backend can connect to database
Run this to troubleshoot connection issues
"""
import mysql.connector
from mysql.connector import Error
import os
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'database': os.getenv('DB_NAME', 'gleentforms'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'port': int(os.getenv('DB_PORT', 3306))
}

def check_connection():
    """Check database connection"""
    print("Checking database connection...")
    print(f"Host: {DB_CONFIG['host']}")
    print(f"Database: {DB_CONFIG['database']}")
    print(f"User: {DB_CONFIG['user']}")
    print(f"Port: {DB_CONFIG['port']}")
    print()
    
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        if connection.is_connected():
            print("[OK] Database connection successful!")
            
            cursor = connection.cursor()
            cursor.execute("SELECT COUNT(*) FROM users")
            count = cursor.fetchone()[0]
            print(f"[OK] Found {count} user(s) in database")
            
            cursor.execute("SELECT username, role FROM users")
            users = cursor.fetchall()
            print("\nUsers in database:")
            for username, role in users:
                print(f"  - {username} ({role})")
            
            cursor.close()
            connection.close()
            return True
    except Error as e:
        print(f"[ERROR] Database connection failed: {e}")
        print("\nTroubleshooting:")
        print("1. Make sure MySQL is running (check XAMPP Control Panel)")
        print("2. Check your .env file in backend/ directory")
        print("3. Verify database 'gleentforms' exists")
        print("4. Run: mysql -u root -p < database/schema.sql")
        return False

if __name__ == '__main__':
    check_connection()

