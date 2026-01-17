#!/usr/bin/env python3
"""
Add is_quiz column to forms table
"""
import mysql.connector
from mysql.connector import Error
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 3306)),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'gleentforms'),
    'charset': 'utf8mb4',
    'collation': 'utf8mb4_unicode_ci'
}

def add_is_quiz_column():
    """Add is_quiz column to forms table if it doesn't exist"""
    connection = None
    cursor = None
    
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor(dictionary=True)
        
        # Check if is_quiz column exists
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'forms' 
            AND COLUMN_NAME = 'is_quiz'
        """)
        
        column_exists = cursor.fetchone()
        
        if not column_exists:
            print("Adding is_quiz column to forms table...")
            cursor.execute("""
                ALTER TABLE forms 
                ADD COLUMN is_quiz BOOLEAN DEFAULT FALSE AFTER response_limit
            """)
            connection.commit()
            print("✓ Successfully added is_quiz column to forms table")
        else:
            print("✓ is_quiz column already exists in forms table")
        
    except Error as e:
        print(f"Error adding is_quiz column: {e}")
        if connection:
            connection.rollback()
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

if __name__ == "__main__":
    add_is_quiz_column()

