#!/usr/bin/env python3
"""Add score columns to form_submissions table"""

import mysql.connector
import os

def add_score_columns():
    """Add manual_scores, total_score, and quiz_results columns to form_submissions"""
    try:
        conn = mysql.connector.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            user=os.getenv('DB_USER', 'root'),
            password=os.getenv('DB_PASSWORD', 'rootpassword'),
            database=os.getenv('DB_NAME', 'gleentforms')
        )
        cursor = conn.cursor(dictionary=True)
        
        # Check existing columns
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'gleentforms' 
            AND TABLE_NAME = 'form_submissions'
        """)
        existing_columns = {row['COLUMN_NAME'] for row in cursor.fetchall()}
        
        # Add missing columns
        if 'manual_scores' not in existing_columns:
            cursor.execute("ALTER TABLE form_submissions ADD COLUMN manual_scores JSON")
            print("Added manual_scores column")
        
        if 'total_score' not in existing_columns:
            cursor.execute("ALTER TABLE form_submissions ADD COLUMN total_score DECIMAL(10,2) DEFAULT 0")
            print("Added total_score column")
        
        if 'quiz_results' not in existing_columns:
            cursor.execute("ALTER TABLE form_submissions ADD COLUMN quiz_results JSON")
            print("Added quiz_results column")
        
        conn.commit()
        cursor.close()
        conn.close()
        print("Migration completed successfully!")
        
    except Exception as e:
        print(f"Error: {e}")
        return 1
    
    return 0

if __name__ == '__main__':
    exit(add_score_columns())

