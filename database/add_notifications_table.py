"""
Migration script to add notifications table
Run this script to add in-app notification support to existing databases
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

def add_notifications_table():
    """Add notifications table"""
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor()
        
        print("Adding notifications table...")
        
        # Check if table already exists
        cursor.execute("""
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'notifications'
        """)
        
        if cursor.fetchone():
            print("Notifications table already exists. Skipping migration.")
            cursor.close()
            connection.close()
            return
        
        # Create notifications table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                form_id INT NOT NULL,
                submission_id INT NOT NULL,
                message TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE,
                FOREIGN KEY (submission_id) REFERENCES form_submissions(id) ON DELETE CASCADE,
                INDEX idx_user_id (user_id),
                INDEX idx_is_read (is_read),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        
        connection.commit()
        print("✓ Successfully added notifications table!")
        
        cursor.close()
        connection.close()
        
    except mysql.connector.Error as e:
        print(f"Error adding notifications table: {e}")
        if connection:
            connection.rollback()
            connection.close()

if __name__ == "__main__":
    add_notifications_table()

