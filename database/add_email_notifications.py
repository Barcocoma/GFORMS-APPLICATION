"""
Migration script to add email notification columns to forms table
Run this script to add email notification support to existing databases
"""
import mysql.connector
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

def add_email_columns():
    """Add email notification columns to forms table"""
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor()
        
        print("Adding email notification columns to forms table...")
        
        # Check if columns already exist
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'forms' 
            AND COLUMN_NAME = 'email_notifications_enabled'
        """)
        
        if cursor.fetchone():
            print("Email notification columns already exist. Skipping migration.")
            cursor.close()
            connection.close()
            return
        
        # Add email notification columns
        cursor.execute("""
            ALTER TABLE forms 
            ADD COLUMN email_notifications_enabled BOOLEAN DEFAULT FALSE,
            ADD COLUMN email_notification_recipients TEXT,
            ADD COLUMN send_confirmation_email BOOLEAN DEFAULT FALSE
        """)
        
        connection.commit()
        print("✓ Successfully added email notification columns!")
        
        cursor.close()
        connection.close()
        
    except mysql.connector.Error as e:
        print(f"Error adding email columns: {e}")
        if connection:
            connection.rollback()
            connection.close()

if __name__ == "__main__":
    add_email_columns()

