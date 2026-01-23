"""
Simple script to list all quizzes in the database
Run: python list_quizzes.py
"""
import mysql.connector
from mysql.connector import Error
import os
from dotenv import load_dotenv

# Try to load .env from backend directory first, then root
load_dotenv('backend/.env')
load_dotenv()

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'database': os.getenv('DB_NAME', 'gleentforms'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'port': int(os.getenv('DB_PORT', 3306))
}

def list_quizzes():
    """List all quizzes in the database"""
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        if connection.is_connected():
            cursor = connection.cursor(dictionary=True)
            
            # Get all quizzes
            cursor.execute("""
                SELECT f.id, f.title, f.description, f.is_quiz, 
                       COUNT(s.id) as submission_count
                FROM forms f
                LEFT JOIN form_submissions s ON f.id = s.form_id
                WHERE f.is_quiz = 1
                GROUP BY f.id
                ORDER BY f.id DESC
            """)
            
            quizzes = cursor.fetchall()
            
            if not quizzes:
                print("[X] No quizzes found in the database.")
                print("\nTip: Create a quiz first in the web app at http://localhost:8080")
            else:
                print("=" * 60)
                print("QUIZZES IN DATABASE")
                print("=" * 60)
                print()
                
                for quiz in quizzes:
                    print(f"ID: {quiz['id']}")
                    print(f"Title: {quiz['title']}")
                    if quiz['description']:
                        desc = quiz['description'][:50] + "..." if len(quiz['description']) > 50 else quiz['description']
                        print(f"Description: {desc}")
                    print(f"Submissions: {quiz['submission_count']}")
                    print("-" * 60)
                
                print()
                print("Use one of these IDs in your API request:")
                print("   Example: quiz-id=1, quiz-id=2, etc.")
            
            cursor.close()
            connection.close()
            
    except Error as e:
        print(f"[X] Error: {e}")
        print("\nTroubleshooting:")
        print("1. Make sure MySQL is running (XAMPP Control Panel)")
        print("2. Check your .env file in backend/ directory")
        print("3. Verify database 'gleentforms' exists")

if __name__ == '__main__':
    list_quizzes()

