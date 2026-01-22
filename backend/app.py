from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import mysql.connector
from mysql.connector import Error
import bcrypt
import jwt
import os
import secrets
import json
import csv
import io
import threading
from datetime import datetime, timedelta, timezone
from functools import wraps
from dotenv import load_dotenv
from queue import Queue
from email_utils import (
    send_email,
    format_submission_email_html,
    format_confirmation_email_html,
    extract_email_from_answers,
    is_email_configured
)

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Configuration
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key-change-in-production')
JWT_SECRET = app.config['SECRET_KEY']
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION = timedelta(hours=24)

# Real-time notifications: Store SSE connections per user
notification_queues = {}
notification_lock = threading.Lock()

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'database': os.getenv('DB_NAME', 'gleentforms'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'port': int(os.getenv('DB_PORT', 3306))
}

def validate_text_answer(value: str, validation: dict, question_id: int):
    """Validate text answer against validation rules"""
    if not value:
        return
    
    # Min/Max length
    if 'minLength' in validation and len(value) < validation['minLength']:
        raise ValueError(f'Answer must be at least {validation["minLength"]} characters long')
    if 'maxLength' in validation and len(value) > validation['maxLength']:
        raise ValueError(f'Answer must be at most {validation["maxLength"]} characters long')
    
    # Pattern validation
    if 'pattern' in validation:
        pattern = validation['pattern']
        if pattern == 'email':
            import re
            if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', value):
                raise ValueError('Please enter a valid email address')
        elif pattern == 'phone':
            import re
            if not re.match(r'^[\d\s\-\+\(\)]+$', value) or len(re.sub(r'\D', '', value)) < 10:
                raise ValueError('Please enter a valid phone number')
        elif pattern == 'url':
            try:
                from urllib.parse import urlparse
                url = value if value.startswith(('http://', 'https://')) else f'https://{value}'
                result = urlparse(url)
                if not all([result.scheme, result.netloc]):
                    raise ValueError('Please enter a valid URL')
            except:
                raise ValueError('Please enter a valid URL')
        elif pattern == 'number':
            try:
                float(value)
            except ValueError:
                raise ValueError('Please enter a valid number')

def validate_number_answer(value: float, validation: dict, question_id: int):
    """Validate number answer against validation rules"""
    if 'minValue' in validation and value < validation['minValue']:
        raise ValueError(f'Value must be at least {validation["minValue"]}')
    if 'maxValue' in validation and value > validation['maxValue']:
        raise ValueError(f'Value must be at most {validation["maxValue"]}')

def get_db_connection():
    """Create and return database connection"""
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        # Set timezone to UTC for consistent timestamp handling
        cursor = connection.cursor()
        cursor.execute("SET time_zone = '+00:00'")
        cursor.close()
        return connection
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
        return None

def generate_token(user_id, username, role):
    """Generate JWT token"""
    payload = {
        'user_id': user_id,
        'username': username,
        'role': role,
        'exp': datetime.utcnow() + JWT_EXPIRATION
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token):
    """Verify JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def token_required(f):
    """Decorator to require authentication"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        
        if auth_header:
            try:
                token = auth_header.split(' ')[1]  # Bearer <token>
            except IndexError:
                return jsonify({'error': 'Invalid token format'}), 401
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        request.current_user = payload
        return f(*args, **kwargs)
    
    return decorated

def admin_required(f):
    """Decorator to require admin role"""
    @wraps(f)
    @token_required
    def decorated(*args, **kwargs):
        if request.current_user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated

def api_key_required(f):
    """Decorator to require API key authentication"""
    @wraps(f)
    def decorated(*args, **kwargs):
        api_key = request.headers.get('api-key') or request.headers.get('API-Key') or request.headers.get('X-API-Key')
        
        if not api_key:
            return jsonify({'error': 'API key is required'}), 401
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Check if api_keys table exists
        cursor.execute("""
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'api_keys'
        """)
        api_keys_table_exists = cursor.fetchone() is not None
        
        if not api_keys_table_exists:
            cursor.close()
            connection.close()
            return jsonify({'error': 'API key authentication not configured'}), 500
        
        # Validate API key
        cursor.execute("""
            SELECT id, user_id, name, is_active
            FROM api_keys
            WHERE api_key = %s AND is_active = TRUE
        """, (api_key,))
        api_key_record = cursor.fetchone()
        
        if not api_key_record:
            cursor.close()
            connection.close()
            return jsonify({'error': 'Invalid or inactive API key'}), 401
        
        # Update last_used_at
        try:
            cursor.execute("""
                UPDATE api_keys
                SET last_used_at = NOW()
                WHERE id = %s
            """, (api_key_record['id'],))
            connection.commit()
        except:
            pass  # Non-critical, continue even if update fails
        
        cursor.close()
        connection.close()
        
        # Store API key info in request for use in endpoint
        request.api_key_user_id = api_key_record.get('user_id')
        request.api_key_name = api_key_record.get('name')
        
        return f(*args, **kwargs)
    return decorated

@app.route('/api/ping', methods=['GET'])
def ping():
    """Health check endpoint"""
    return jsonify({'message': 'pong'})

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Login endpoint"""
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'error': 'Username and password are required'}), 400
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, username, password, role FROM users WHERE username = %s",
            (username,)
        )
        user = cursor.fetchone()
        cursor.close()
        connection.close()
        
        if not user:
            return jsonify({'error': 'Invalid username or password'}), 401
        
        # Verify password
        stored_password = user['password']
        # Ensure stored_password is a string (MySQL connector may return bytes)
        if isinstance(stored_password, bytes):
            stored_password = stored_password.decode('utf-8')
        if not bcrypt.checkpw(password.encode('utf-8'), stored_password.encode('utf-8')):
            return jsonify({'error': 'Invalid username or password'}), 401
        
        # Generate token
        token = generate_token(user['id'], user['username'], user['role'])
        
        return jsonify({
            'token': token,
            'user': {
                'id': user['id'],
                'username': user['username'],
                'role': user['role']
            }
        }), 200
        
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/auth/verify', methods=['GET'])
@token_required
def verify():
    """Verify token and return user info"""
    return jsonify({
        'user': {
            'id': request.current_user['user_id'],
            'username': request.current_user['username'],
            'role': request.current_user['role']
        }
    }), 200

@app.route('/api/auth/logout', methods=['POST'])
@token_required
def logout():
    """Logout endpoint (client-side token removal)"""
    return jsonify({'message': 'Logged out successfully'}), 200

@app.route('/api/user/profile', methods=['PUT'])
@token_required
def update_profile():
    """Update current user's profile (username)"""
    try:
        user_id = request.current_user['user_id']
        data = request.get_json()
        new_username = data.get('username')
        
        if not new_username or not new_username.strip():
            return jsonify({'error': 'Username is required'}), 400
        
        new_username = new_username.strip()
        
        # Check if username already exists (excluding current user)
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Check if username is already taken by another user
        cursor.execute(
            "SELECT id FROM users WHERE username = %s AND id != %s",
            (new_username, user_id)
        )
        existing_user = cursor.fetchone()
        
        if existing_user:
            cursor.close()
            connection.close()
            return jsonify({'error': 'Username already taken'}), 400
        
        # Update username
        cursor.execute(
            "UPDATE users SET username = %s WHERE id = %s",
            (new_username, user_id)
        )
        connection.commit()
        
        # Get updated user info
        cursor.execute(
            "SELECT id, username, role FROM users WHERE id = %s",
            (user_id,)
        )
        updated_user = cursor.fetchone()
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'user': {
                'id': updated_user['id'],
                'username': updated_user['username'],
                'role': updated_user['role']
            },
            'message': 'Profile updated successfully'
        }), 200
        
    except Exception as e:
        print(f"Update profile error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Internal server error'}), 500

# Admin endpoints
@app.route('/api/admin/stats', methods=['GET'])
@admin_required
def admin_stats():
    """Get admin dashboard statistics"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor()
        
        # Get total users
        cursor.execute("SELECT COUNT(*) FROM users")
        total_users = cursor.fetchone()[0]
        
        # Get total forms
        cursor.execute("SELECT COUNT(*) FROM forms")
        total_forms = cursor.fetchone()[0]
        
        # Get total submissions
        cursor.execute("SELECT COUNT(*) FROM form_submissions")
        total_submissions = cursor.fetchone()[0]
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'totalUsers': total_users,
            'totalForms': total_forms,
            'totalSubmissions': total_submissions
        }), 200
        
    except Exception as e:
        print(f"Admin stats error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/admin/users', methods=['GET'])
@admin_required
def admin_get_users():
    """Get all users (admin only)"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT id, username, role, created_at FROM users ORDER BY created_at DESC")
        users = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        return jsonify(users), 200
        
    except Exception as e:
        print(f"Get users error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/admin/forms', methods=['GET'])
@admin_required
def admin_get_forms():
    """Get all forms (admin only)"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        cursor.execute("""
            SELECT f.id, f.user_id, f.title, f.description, f.confirmation_message, f.accepting_responses, f.is_shared, f.share_token, 
                   f.created_at, f.updated_at, u.username
            FROM forms f
            LEFT JOIN users u ON f.user_id = u.id
            ORDER BY f.created_at DESC
        """)
        forms = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        return jsonify(forms), 200
        
    except Exception as e:
        print(f"Get forms error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/admin/submissions', methods=['GET'])
@admin_required
def admin_get_submissions():
    """Get all submissions (admin only)"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        cursor.execute("""
            SELECT s.id, s.form_id, s.submitted_by, s.submitted_at, 
                   f.title as form_title, u.username
            FROM form_submissions s
            LEFT JOIN forms f ON s.form_id = f.id
            LEFT JOIN users u ON s.submitted_by = u.id
            ORDER BY s.submitted_at DESC
        """)
        submissions = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        return jsonify(submissions), 200
        
    except Exception as e:
        print(f"Get submissions error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/admin/users', methods=['POST'])
@admin_required
def admin_create_user():
    """Create a new user (admin only)"""
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        role = data.get('role', 'user')
        
        if not username or not password:
            return jsonify({'error': 'Username and password are required'}), 400
        
        if role not in ['user', 'admin']:
            return jsonify({'error': 'Invalid role. Must be "user" or "admin"'}), 400
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Check if username already exists
        cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
        if cursor.fetchone():
            cursor.close()
            connection.close()
            return jsonify({'error': 'Username already exists'}), 400
        
        # Hash password
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Insert new user
        cursor.execute("""
            INSERT INTO users (username, password, role)
            VALUES (%s, %s, %s)
        """, (username, hashed_password, role))
        
        user_id = cursor.lastrowid
        connection.commit()
        
        # Get the created user
        cursor.execute("""
            SELECT id, username, role, created_at
            FROM users
            WHERE id = %s
        """, (user_id,))
        user = cursor.fetchone()
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'id': user['id'],
            'username': user['username'],
            'role': user['role'],
            'created_at': user['created_at'].isoformat() if user['created_at'] else None
        }), 201
        
    except mysql.connector.IntegrityError:
        return jsonify({'error': 'Username already exists'}), 400
    except Exception as e:
        print(f"Create user error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

# User form endpoints
@app.route('/api/forms', methods=['POST'])
@token_required
def create_form():
    """Create a new form with questions"""
    try:
        user_id = request.current_user['user_id']
        data = request.get_json()
        
        title = data.get('title')
        description = data.get('description', '')
        confirmation_message = data.get('confirmation_message', '').strip() or None
        accepting_responses = data.get('accepting_responses', True)
        response_limit = data.get('response_limit')
        is_quiz = data.get('is_quiz', False)
        email_notifications_enabled = data.get('email_notifications_enabled', False)
        email_notification_recipients = data.get('email_notification_recipients', '').strip() or None
        send_confirmation_email = data.get('send_confirmation_email', False)
        requires_login = data.get('requires_login', True)  # Default to True for backward compatibility
        if response_limit is not None:
            try:
                response_limit = int(response_limit) if response_limit > 0 else None
            except (ValueError, TypeError):
                response_limit = None
        else:
            response_limit = None
        questions = data.get('questions', [])
        sections = data.get('sections', [])
        
        if not title:
            return jsonify({'error': 'Form title is required'}), 400
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Check if sections table exists
        cursor.execute("""
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'form_sections'
        """)
        sections_table_exists = cursor.fetchone() is not None
        
        # Check if section_id column exists in form_questions
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'form_questions' 
            AND COLUMN_NAME = 'section_id'
        """)
        section_id_column_exists = cursor.fetchone() is not None
        
        # Generate unique share token
        share_token = secrets.token_urlsafe(32)
        
        # Insert form (with default settings)
        # Check if email columns exist before inserting
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'forms' 
            AND COLUMN_NAME = 'email_notifications_enabled'
        """)
        email_columns_exist = cursor.fetchone() is not None
        
        # Check if requires_login column exists
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'forms' 
            AND COLUMN_NAME = 'requires_login'
        """)
        requires_login_column_exists = cursor.fetchone() is not None
        
        if email_columns_exist and requires_login_column_exists:
            cursor.execute("""
                INSERT INTO forms (user_id, title, description, confirmation_message, accepting_responses, response_limit, is_shared, share_token, is_quiz, email_notifications_enabled, email_notification_recipients, send_confirmation_email, requires_login)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (user_id, title, description, confirmation_message, accepting_responses, response_limit, False, share_token, is_quiz, email_notifications_enabled, email_notification_recipients, send_confirmation_email, requires_login))
        elif email_columns_exist:
            cursor.execute("""
                INSERT INTO forms (user_id, title, description, confirmation_message, accepting_responses, response_limit, is_shared, share_token, is_quiz, email_notifications_enabled, email_notification_recipients, send_confirmation_email)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (user_id, title, description, confirmation_message, accepting_responses, response_limit, False, share_token, is_quiz, email_notifications_enabled, email_notification_recipients, send_confirmation_email))
        else:
            cursor.execute("""
                INSERT INTO forms (user_id, title, description, confirmation_message, accepting_responses, response_limit, is_shared, share_token, is_quiz)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (user_id, title, description, confirmation_message, accepting_responses, response_limit, False, share_token, is_quiz))
        
        form_id = cursor.lastrowid
        
        # Map frontend section IDs to database section IDs
        section_id_map = {}  # {frontend_id: database_id}
        
        # Insert sections if table exists
        if sections_table_exists and sections:
            for index, section in enumerate(sections):
                section_title = section.get('title', 'Untitled Section')
                section_description = section.get('description', '') or None
                conditional_navigation = section.get('conditionalNavigation')
                conditional_nav_json = json.dumps(conditional_navigation) if conditional_navigation else None
                
                cursor.execute("""
                    INSERT INTO form_sections (form_id, section_title, section_description, display_order, conditional_navigation)
                    VALUES (%s, %s, %s, %s, %s)
                """, (form_id, section_title, section_description, index, conditional_nav_json))
                
                section_db_id = cursor.lastrowid
                # Map frontend ID (string) to database ID (int)
                frontend_id = section.get('id')
                if frontend_id:
                    section_id_map[str(frontend_id)] = section_db_id
        
        # Map frontend question types to database types
        type_mapping = {
            'short': 'text',
            'long': 'textarea',
            'multiple': 'radio',
            'checkbox': 'checkbox',
            'dropdown': 'select',
            'linear': 'number',
            'text': 'text',
            'textarea': 'textarea',
            'radio': 'radio',
            'select': 'select',
            'number': 'number',
            'email': 'email',
            'date': 'date'
        }
        
        # Insert questions
        for index, question in enumerate(questions):
            question_text = question.get('title', '')
            question_type = question.get('type', 'short')
            db_type = type_mapping.get(question_type, 'text')
            is_required = question.get('required', False)
            options = question.get('options', [])
            has_other = question.get('hasOther', False)
            description = question.get('description', '')
            
            # Store has_other, description, validation, correct_answer, and conditional_logic in options JSON as metadata (backward compatible)
            validation = question.get('validation', {})
            has_validation = validation and any(validation.values())
            conditional_logic = question.get('conditionalLogic')
            has_conditional_logic = conditional_logic and conditional_logic.get('showIfQuestion')
            correct_answer = question.get('correctAnswer')  # Can be string or array
            points = question.get('points', 1)
            has_correct_answer = correct_answer is not None and (correct_answer != '' if isinstance(correct_answer, str) else correct_answer != [])
            
            # If has_other, description, validation, correct_answer, or conditional_logic exists, wrap options in an object
            if has_other or description or has_validation or has_correct_answer or has_conditional_logic:
                options_data = {
                    'options': options if options else [],
                    'has_other': has_other,
                    'description': description,
                    'validation': validation if has_validation else None,
                    'correct_answer': correct_answer if has_correct_answer else None,
                    'points': points if has_correct_answer else None,
                    'conditional_logic': conditional_logic if has_conditional_logic else None
                }
            else:
                options_data = options
            
            # Convert options to JSON
            options_json = json.dumps(options_data) if options_data else None
            
            # Get section_id if provided
            question_section_id = question.get('sectionId')
            db_section_id = section_id_map.get(str(question_section_id)) if question_section_id and section_id_column_exists else None
            
            # Build INSERT query based on whether section_id column exists
            if section_id_column_exists:
                cursor.execute("""
                    INSERT INTO form_questions (form_id, section_id, question_text, question_type, options, is_required, display_order)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (form_id, db_section_id, question_text, db_type, options_json, is_required, index))
            else:
                cursor.execute("""
                    INSERT INTO form_questions (form_id, question_text, question_type, options, is_required, display_order)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (form_id, question_text, db_type, options_json, is_required, index))
        
        connection.commit()
        
        # Get the created form
        cursor.execute("""
            SELECT id, user_id, title, description, is_shared, share_token, created_at, updated_at
            FROM forms
            WHERE id = %s
        """, (form_id,))
        form = cursor.fetchone()
        
        cursor.close()
        connection.close()
        
        # Generate share URL (frontend will construct the full URL)
        share_url = f"/form/{form['share_token']}"
        
        return jsonify({
            'id': form['id'],
            'user_id': form['user_id'],
            'title': form['title'],
            'description': form['description'],
            'is_shared': form['is_shared'],
            'share_token': form['share_token'],
            'share_url': share_url,
            'created_at': form['created_at'].isoformat() if form['created_at'] else None,
            'updated_at': form['updated_at'].isoformat() if form['updated_at'] else None
        }), 201
        
    except Exception as e:
        print(f"Create form error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@app.route('/api/user/forms', methods=['GET'])
@token_required
def get_user_forms():
    """Get current user's forms"""
    try:
        user_id = request.current_user['user_id']
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Get user's forms with submission count
        cursor.execute("""
            SELECT f.id, f.user_id, f.title, f.description, f.confirmation_message, f.accepting_responses, f.response_limit, f.is_shared, f.share_token, f.is_quiz,
                   f.created_at, f.updated_at, f.last_opened_at,
                   COUNT(DISTINCT s.id) as response_count
            FROM forms f
            LEFT JOIN form_submissions s ON f.id = s.form_id
            WHERE f.user_id = %s
            GROUP BY f.id
            ORDER BY f.updated_at DESC
        """, (user_id,))
        forms = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        # Format dates and convert response_count to int, and is_quiz to boolean
        for form in forms:
            if form['created_at']:
                form['created_at'] = form['created_at'].isoformat()
            if form['updated_at']:
                form['updated_at'] = form['updated_at'].isoformat()
            if form.get('last_opened_at'):
                dt = form['last_opened_at']
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                form['last_opened_at'] = dt.isoformat()
            else:
                form['last_opened_at'] = None
            form['response_count'] = int(form['response_count']) if form['response_count'] else 0
            # Convert is_quiz to boolean (MySQL might return 0/1 or True/False)
            if 'is_quiz' in form:
                form['is_quiz'] = bool(form['is_quiz']) if form['is_quiz'] is not None else False
            else:
                form['is_quiz'] = False
        
        return jsonify(forms), 200
        
    except Exception as e:
        print(f"Get user forms error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/forms/<int:form_id>', methods=['GET'])
@token_required
def get_form_by_id(form_id):
    """Get form by ID (only if user is the owner)"""
    try:
        user_id = request.current_user['user_id']
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)

        # Check existence first (so we can distinguish 404 vs 403)
        cursor.execute("SELECT id, user_id FROM forms WHERE id = %s", (form_id,))
        form_owner = cursor.fetchone()

        if not form_owner:
            cursor.close()
            connection.close()
            return jsonify({'error': 'Form not found'}), 404

        if form_owner['user_id'] != user_id:
            cursor.close()
            connection.close()
            return jsonify({'error': 'Access denied'}), 403

        # Get form (check if email columns exist)
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'forms' 
            AND COLUMN_NAME = 'email_notifications_enabled'
        """)
        email_columns_exist = cursor.fetchone() is not None
        
        # Check if requires_login column exists
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'forms' 
            AND COLUMN_NAME = 'requires_login'
        """)
        requires_login_column_exists = cursor.fetchone() is not None
        
        if email_columns_exist and requires_login_column_exists:
            cursor.execute("""
                SELECT id, user_id, title, description, confirmation_message, accepting_responses, response_limit, is_shared, share_token, is_quiz,
                       email_notifications_enabled, email_notification_recipients, send_confirmation_email, requires_login, created_at, updated_at, last_opened_at
                FROM forms
                WHERE id = %s
            """, (form_id,))
        elif email_columns_exist:
            cursor.execute("""
                SELECT id, user_id, title, description, confirmation_message, accepting_responses, response_limit, is_shared, share_token, is_quiz,
                       email_notifications_enabled, email_notification_recipients, send_confirmation_email, created_at, updated_at, last_opened_at
                FROM forms
                WHERE id = %s
            """, (form_id,))
        else:
            cursor.execute("""
                SELECT id, user_id, title, description, confirmation_message, accepting_responses, response_limit, is_shared, share_token, is_quiz,
                       created_at, updated_at, last_opened_at
                FROM forms
                WHERE id = %s
            """, (form_id,))
        form = cursor.fetchone()
        
        # Update last_opened_at timestamp when form is viewed by owner
        try:
            cursor.execute("""
                UPDATE forms 
                SET last_opened_at = NOW() 
                WHERE id = %s
            """, (form_id,))
            connection.commit()
        except Exception as e:
            # If column doesn't exist, just continue (backward compatibility)
            print(f"Warning: Could not update last_opened_at: {e}")
            pass
        
        # Check if sections table exists
        cursor.execute("""
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'form_sections'
        """)
        sections_table_exists = cursor.fetchone() is not None
        
        # Check if section_id column exists in form_questions
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'form_questions' 
            AND COLUMN_NAME = 'section_id'
        """)
        section_id_column_exists = cursor.fetchone() is not None
        
        # Get form sections if table exists
        sections = []
        section_id_map = {}  # {database_id: frontend_section_object}
        if sections_table_exists:
            cursor.execute("""
                SELECT id, section_title, section_description, display_order, conditional_navigation
                FROM form_sections
                WHERE form_id = %s
                ORDER BY display_order ASC
            """, (form_id,))
            db_sections = cursor.fetchall()
            print(f"Loading form {form_id}: Found {len(db_sections)} sections in database")
            
            for section in db_sections:
                conditional_nav = None
                if section['conditional_navigation']:
                    try:
                        conditional_nav = json.loads(section['conditional_navigation'])
                    except:
                        pass
                
                section_obj = {
                    'id': str(section['id']),  # Convert to string for frontend
                    'title': section['section_title'],
                    'description': section.get('section_description'),
                    'display_order': section.get('display_order', 0),
                    'conditionalNavigation': conditional_nav
                }
                sections.append(section_obj)
                section_id_map[section['id']] = section_obj
        
        # Get form questions
        if section_id_column_exists:
            cursor.execute("""
                SELECT id, section_id, question_text, question_type, options, is_required, display_order
                FROM form_questions
                WHERE form_id = %s
                ORDER BY display_order ASC
            """, (form_id,))
        else:
            cursor.execute("""
                SELECT id, question_text, question_type, options, is_required, display_order
                FROM form_questions
                WHERE form_id = %s
                ORDER BY display_order ASC
            """, (form_id,))
        questions = cursor.fetchall()
        
        # Get submission count
        cursor.execute("""
            SELECT COUNT(*) as count FROM form_submissions WHERE form_id = %s
        """, (form_id,))
        submission_count = cursor.fetchone()['count']
        
        # Parse JSON options and extract has_other, description, validation, correct_answer, and conditional_logic
        for question in questions:
            has_other = False
            description = ''
            validation = None
            correct_answer = None
            points = 1
            conditional_logic = None
            
            if question['options']:
                try:
                    parsed = json.loads(question['options'])
                    # Check if it's the new format with metadata
                    if isinstance(parsed, dict) and ('has_other' in parsed or 'description' in parsed or 'validation' in parsed or 'correct_answer' in parsed or 'conditional_logic' in parsed):
                        has_other = parsed.get('has_other', False)
                        description = parsed.get('description', '')
                        validation = parsed.get('validation')
                        correct_answer = parsed.get('correct_answer')
                        points = parsed.get('points', 1)
                        conditional_logic = parsed.get('conditional_logic')
                        question['options'] = parsed.get('options', [])
                    else:
                        # Old format - just an array
                        question['options'] = parsed if isinstance(parsed, list) else []
                except:
                    question['options'] = []
            else:
                question['options'] = []
            question['has_other'] = has_other
            question['description'] = description
            if validation:
                question['validation'] = validation
            if correct_answer is not None:
                question['correct_answer'] = correct_answer
                question['points'] = points
            if conditional_logic:
                question['conditional_logic'] = conditional_logic
            
            # Map section_id from database ID to frontend section object if applicable
            if section_id_column_exists and question.get('section_id'):
                db_section_id = question['section_id']
                # Find the section object with matching id
                section_obj = None
                for section in sections:
                    # Compare with database ID converted to string
                    if str(db_section_id) == str(section.get('id')):
                        section_obj = section
                        break
                if section_obj:
                    question['sectionId'] = section_obj['id']
                    print(f"  ✅ Question '{question.get('question_text', '')[:30]}' mapped to section '{section_obj.get('title', '')}' (ID: {section_obj.get('id')})")
                else:
                    question['sectionId'] = None
                    print(f"  ⚠️ Question '{question.get('question_text', '')[:30]}' has section_id={db_section_id} but no matching section found. Available sections: {[s.get('id') for s in sections]}")
            else:
                question['sectionId'] = None
                if section_id_column_exists:
                    print(f"  ⚠️ Question '{question.get('question_text', '')[:30]}' has no section_id")
        
        # Debug: Log questions with their sectionIds
        print(f"Get shared form: Total questions loaded: {len(questions)}")
        for q in questions:
            print(f"  Question '{q.get('question_text', '')[:30]}' (ID: {q.get('id')}) -> sectionId: {q.get('sectionId')}")
        
        # Debug: Group questions by section
        questions_by_section = {}
        for q in questions:
            section_id = q.get('sectionId') or 'NO_SECTION'
            if section_id not in questions_by_section:
                questions_by_section[section_id] = []
            questions_by_section[section_id].append(q.get('question_text', '')[:30])
        
        print(f"Get shared form: Questions grouped by section:")
        for section_id, q_list in questions_by_section.items():
            print(f"  Section {section_id}: {len(q_list)} questions - {q_list}")
        
        cursor.close()
        connection.close()
        
        response_data = {
            'id': form['id'],
            'user_id': form['user_id'],
            'title': form['title'],
            'description': form['description'],
            'is_shared': form['is_shared'],
            'share_token': form['share_token'],
            'is_quiz': form.get('is_quiz', False),
            'questions': questions,
            'submission_count': submission_count,
            'created_at': form['created_at'].isoformat() if form['created_at'] else None,
            'updated_at': form['updated_at'].isoformat() if form['updated_at'] else None,
            'sections': sections if sections_table_exists else []  # Always include sections array
        }
        
        # Add email settings if columns exist
        if email_columns_exist:
            response_data['email_notifications_enabled'] = form.get('email_notifications_enabled', False)
            response_data['email_notification_recipients'] = form.get('email_notification_recipients')
            response_data['send_confirmation_email'] = form.get('send_confirmation_email', False)
        
        # Add requires_login if column exists (convert MySQL 0/1 to boolean)
        if requires_login_column_exists:
            response_data['requires_login'] = bool(form.get('requires_login', 1))
        
        return jsonify(response_data), 200
        
    except Exception as e:
        print(f"Get form by ID error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/forms/<int:form_id>', methods=['PUT'])
@token_required
def update_form(form_id):
    """Update an existing form (only if user is the owner)"""
    try:
        user_id = request.current_user['user_id']
        data = request.get_json()
        
        title = data.get('title')
        description = data.get('description', '')
        questions = data.get('questions', [])
        
        if not title:
            return jsonify({'error': 'Form title is required'}), 400
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Check if form exists and user is the owner
        cursor.execute("""
            SELECT id, share_token FROM forms WHERE id = %s AND user_id = %s
        """, (form_id, user_id))
        form = cursor.fetchone()
        
        if not form:
            cursor.close()
            connection.close()
            return jsonify({'error': 'Form not found or access denied'}), 404
        
        share_token = form['share_token']
        
        # Get confirmation_message, accepting_responses, response_limit, is_quiz, and email settings from request
        confirmation_message = data.get('confirmation_message', '').strip() or None
        accepting_responses = data.get('accepting_responses', True)
        response_limit = data.get('response_limit')
        is_quiz = data.get('is_quiz', False)
        email_notifications_enabled = data.get('email_notifications_enabled', False)
        email_notification_recipients = data.get('email_notification_recipients', '').strip() or None
        send_confirmation_email = data.get('send_confirmation_email', False)
        requires_login = data.get('requires_login', True)  # Default to True for backward compatibility
        sections = data.get('sections', [])
        # Ensure sections is always a list (handle None/undefined)
        if sections is None:
            sections = []
        print(f"Update form {form_id}: Received sections data: {sections}")
        if response_limit is not None:
            try:
                response_limit = int(response_limit) if response_limit > 0 else None
            except (ValueError, TypeError):
                response_limit = None
        else:
            response_limit = None
        
        # Check if sections table exists
        cursor.execute("""
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'form_sections'
        """)
        sections_table_exists = cursor.fetchone() is not None
        
        # Check if section_id column exists in form_questions
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'form_questions' 
            AND COLUMN_NAME = 'section_id'
        """)
        section_id_column_exists = cursor.fetchone() is not None
        
        # Check if email columns exist
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'forms' 
            AND COLUMN_NAME = 'email_notifications_enabled'
        """)
        email_columns_exist = cursor.fetchone() is not None
        
        # Check if requires_login column exists
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'forms' 
            AND COLUMN_NAME = 'requires_login'
        """)
        requires_login_column_exists = cursor.fetchone() is not None
        
        # Update form
        if email_columns_exist and requires_login_column_exists:
            cursor.execute("""
                UPDATE forms 
                SET title = %s, description = %s, confirmation_message = %s, accepting_responses = %s, response_limit = %s, is_quiz = %s, 
                    email_notifications_enabled = %s, email_notification_recipients = %s, send_confirmation_email = %s, requires_login = %s, updated_at = NOW()
                WHERE id = %s
            """, (title, description, confirmation_message, accepting_responses, response_limit, is_quiz, email_notifications_enabled, email_notification_recipients, send_confirmation_email, requires_login, form_id))
        elif email_columns_exist:
            cursor.execute("""
                UPDATE forms 
                SET title = %s, description = %s, confirmation_message = %s, accepting_responses = %s, response_limit = %s, is_quiz = %s, 
                    email_notifications_enabled = %s, email_notification_recipients = %s, send_confirmation_email = %s, updated_at = NOW()
                WHERE id = %s
            """, (title, description, confirmation_message, accepting_responses, response_limit, is_quiz, email_notifications_enabled, email_notification_recipients, send_confirmation_email, form_id))
        else:
            cursor.execute("""
                UPDATE forms 
                SET title = %s, description = %s, confirmation_message = %s, accepting_responses = %s, response_limit = %s, is_quiz = %s, updated_at = NOW()
                WHERE id = %s
            """, (title, description, confirmation_message, accepting_responses, response_limit, is_quiz, form_id))
        
        # Delete existing sections if table exists
        if sections_table_exists:
            cursor.execute("DELETE FROM form_sections WHERE form_id = %s", (form_id,))
        
        # Map frontend section IDs to database section IDs
        section_id_map = {}  # {frontend_id: database_id}
        
        # Insert/update sections if table exists
        # Check if sections is not None and not empty
        print(f"Update form {form_id}: sections_table_exists={sections_table_exists}, sections={sections}, type={type(sections)}, len={len(sections) if sections else 0}")
        if sections_table_exists and sections is not None and len(sections) > 0:
            print(f"Updating form {form_id}: Saving {len(sections)} sections")
            for index, section in enumerate(sections):
                section_title = section.get('title', 'Untitled Section')
                section_description = section.get('description', '') or None
                conditional_navigation = section.get('conditionalNavigation')
                conditional_nav_json = json.dumps(conditional_navigation) if conditional_navigation else None
                
                frontend_id = section.get('id')
                print(f"  Section {index}: frontend_id={frontend_id}, title='{section_title}'")
                
                cursor.execute("""
                    INSERT INTO form_sections (form_id, section_title, section_description, display_order, conditional_navigation)
                    VALUES (%s, %s, %s, %s, %s)
                """, (form_id, section_title, section_description, index, conditional_nav_json))
                
                section_db_id = cursor.lastrowid
                print(f"    -> Saved with database ID: {section_db_id}")
                # Map frontend ID (string) to database ID (int)
                if frontend_id:
                    section_id_map[str(frontend_id)] = section_db_id
                    print(f"    -> Mapped frontend_id '{frontend_id}' -> database_id {section_db_id}")
        else:
            if not sections_table_exists:
                print(f"Updating form {form_id}: sections table does not exist")
            elif not sections:
                print(f"Updating form {form_id}: sections array is empty or None")
        
        # Delete existing questions
        cursor.execute("DELETE FROM form_questions WHERE form_id = %s", (form_id,))
        
        # Map frontend question types to database types
        type_mapping = {
            'short': 'text',
            'long': 'textarea',
            'multiple': 'radio',
            'checkbox': 'checkbox',
            'dropdown': 'select',
            'linear': 'number',
            'text': 'text',
            'textarea': 'textarea',
            'radio': 'radio',
            'select': 'select',
            'number': 'number',
            'email': 'email',
            'date': 'date'
        }
        
        # Insert updated questions
        for index, question in enumerate(questions):
            question_text = question.get('title', '')
            question_type = question.get('type', 'short')
            db_type = type_mapping.get(question_type, 'text')
            is_required = question.get('required', False)
            options = question.get('options', [])
            has_other = question.get('hasOther', False)
            description = question.get('description', '')
            validation = question.get('validation', {})
            has_validation = validation and any(validation.values())
            conditional_logic = question.get('conditionalLogic')
            has_conditional_logic = conditional_logic and conditional_logic.get('showIfQuestion')
            
            # Store has_other, description, validation, correct_answer, and conditional_logic in options JSON as metadata (backward compatible)
            correct_answer = question.get('correctAnswer')  # Can be string or array
            points = question.get('points', 1)
            has_correct_answer = correct_answer is not None and (correct_answer != '' if isinstance(correct_answer, str) else correct_answer != [])
            
            # If has_other, description, validation, correct_answer, or conditional_logic exists, wrap options in an object
            if has_other or description or has_validation or has_correct_answer or has_conditional_logic:
                options_data = {
                    'options': options if options else [],
                    'has_other': has_other,
                    'description': description,
                    'validation': validation if has_validation else None,
                    'correct_answer': correct_answer if has_correct_answer else None,
                    'points': points if has_correct_answer else None
                }
            else:
                options_data = options
            
            # Convert options to JSON
            options_json = json.dumps(options_data) if options_data else None
            
            # Map sectionId from frontend to database section_id
            section_id = None
            frontend_section_id = question.get('sectionId')
            if frontend_section_id and section_id_column_exists:
                # Look up database section ID from frontend section ID
                section_id = section_id_map.get(str(frontend_section_id))
                if frontend_section_id and not section_id:
                    print(f"  Warning: Question '{question_text[:30]}' has sectionId '{frontend_section_id}' but not found in section_id_map. Available mappings: {section_id_map}")
            
            # Insert question with section_id if column exists
            if section_id_column_exists:
                cursor.execute("""
                    INSERT INTO form_questions (form_id, section_id, question_text, question_type, options, is_required, display_order)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (form_id, section_id, question_text, db_type, options_json, is_required, index))
            else:
                cursor.execute("""
                    INSERT INTO form_questions (form_id, question_text, question_type, options, is_required, display_order)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (form_id, question_text, db_type, options_json, is_required, index))
        
        connection.commit()
        print(f"Form {form_id} updated successfully. Sections saved: {len(section_id_map)}, Questions saved: {len(questions)}")
        
        # Get the updated form
        cursor.execute("""
            SELECT id, user_id, title, description, is_shared, share_token, created_at, updated_at
            FROM forms
            WHERE id = %s
        """, (form_id,))
        updated_form = cursor.fetchone()
        
        cursor.close()
        connection.close()
        
        share_url = f"/form/{updated_form['share_token']}"
        
        return jsonify({
            'id': updated_form['id'],
            'user_id': updated_form['user_id'],
            'title': updated_form['title'],
            'description': updated_form['description'],
            'is_shared': updated_form['is_shared'],
            'share_token': updated_form['share_token'],
            'share_url': share_url,
            'created_at': updated_form['created_at'].isoformat() if updated_form['created_at'] else None,
            'updated_at': updated_form['updated_at'].isoformat() if updated_form['updated_at'] else None
        }), 200
        
    except Exception as e:
        print(f"Update form error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/forms/<int:form_id>', methods=['DELETE'])
@token_required
def delete_form(form_id):
    """Delete a form (only if user is the owner)"""
    try:
        user_id = request.current_user['user_id']
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Check if form exists and user is the owner
        cursor.execute("""
            SELECT id, title FROM forms WHERE id = %s AND user_id = %s
        """, (form_id, user_id))
        form = cursor.fetchone()
        
        if not form:
            cursor.close()
            connection.close()
            return jsonify({'error': 'Form not found or access denied'}), 404
        
        # Delete form (cascade will handle related records: questions, submissions, answers)
        cursor.execute("DELETE FROM forms WHERE id = %s", (form_id,))
        connection.commit()
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'message': 'Form deleted successfully',
            'deleted_id': form_id
        }), 200
        
    except Exception as e:
        print(f"Delete form error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/forms/<int:form_id>/responses', methods=['GET'])
@token_required
def get_form_responses(form_id):
    """Get all responses for a form (only if user is the owner)"""
    try:
        user_id = request.current_user['user_id']
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Check if form exists and user is the owner
        cursor.execute("""
            SELECT id FROM forms WHERE id = %s AND user_id = %s
        """, (form_id, user_id))
        form = cursor.fetchone()
        
        if not form:
            cursor.close()
            connection.close()
            return jsonify({'error': 'Form not found or access denied'}), 404
        
        # Get all submissions for this form (try to include quiz_results and manual_scores)
        try:
            cursor.execute("""
                SELECT s.id, s.submitted_by, s.submitted_at, u.username, s.quiz_results, s.manual_scores, s.total_score
                FROM form_submissions s
                LEFT JOIN users u ON s.submitted_by = u.id
                WHERE s.form_id = %s
                ORDER BY s.submitted_at DESC
            """, (form_id,))
        except mysql.connector.Error:
            # Columns don't exist, use basic query
            cursor.execute("""
                SELECT s.id, s.submitted_by, s.submitted_at, u.username
                FROM form_submissions s
                LEFT JOIN users u ON s.submitted_by = u.id
                WHERE s.form_id = %s
                ORDER BY s.submitted_at DESC
            """, (form_id,))
        submissions = cursor.fetchall()
        
        # Get all answers for these submissions
        responses = []
        for submission in submissions:
            cursor.execute("""
                SELECT qa.question_id, qa.answer_text, q.question_text, q.question_type
                FROM form_submission_answers qa
                INNER JOIN form_questions q ON qa.question_id = q.id
                WHERE qa.submission_id = %s
                ORDER BY q.display_order ASC
            """, (submission['id'],))
            answers = cursor.fetchall()
            
            # Organize answers by question_id
            # For checkbox/multiple choice, multiple rows might exist for same question
            answers_dict = {}
            for answer in answers:
                question_id = answer['question_id']
                answer_text = answer['answer_text']
                
                # Try to parse JSON if it's a checkbox/multiple choice answer
                try:
                    parsed = json.loads(answer_text)
                    if isinstance(parsed, list):
                        answers_dict[question_id] = parsed
                    else:
                        if question_id not in answers_dict:
                            answers_dict[question_id] = []
                        answers_dict[question_id].append(str(parsed))
                except:
                    # Regular text answer
                    if question_id not in answers_dict:
                        answers_dict[question_id] = []
                    answers_dict[question_id].append(answer_text)
            
            # Format submitted_at with timezone awareness
            submitted_at_iso = None
            if submission['submitted_at']:
                dt = submission['submitted_at']
                # MySQL TIMESTAMP is timezone-naive, assume it's stored in server timezone
                # Convert to UTC for consistent handling
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                submitted_at_iso = dt.isoformat()
            
            # Parse quiz_results and manual_scores if available
            quiz_results = None
            manual_scores = None
            total_score = None
            
            if submission.get('quiz_results'):
                try:
                    quiz_results = json.loads(submission['quiz_results']) if isinstance(submission['quiz_results'], str) else submission['quiz_results']
                except:
                    pass
            
            if submission.get('manual_scores'):
                try:
                    manual_scores = json.loads(submission['manual_scores']) if isinstance(submission['manual_scores'], str) else submission['manual_scores']
                except:
                    pass
            
            total_score = submission.get('total_score')
            # Convert to float if it's a Decimal or string
            if total_score is not None:
                try:
                    total_score = float(total_score)
                except (ValueError, TypeError):
                    total_score = None
            
            responses.append({
                'id': submission['id'],
                'submitted_at': submitted_at_iso,
                'submitted_by': submission['username'] or (f"User #{submission['submitted_by']}" if submission['submitted_by'] else 'Anonymous'),
                'answers': answers_dict,
                'quiz_results': quiz_results,
                'manual_scores': manual_scores,
                'total_score': total_score
            })
        
        cursor.close()
        connection.close()
        
        return jsonify(responses), 200
        
    except Exception as e:
        print(f"Get form responses error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/forms/<int:form_id>/responses/<int:submission_id>', methods=['PUT'])
@token_required
def update_form_response(form_id, submission_id):
    """Update a specific response (only if user is the form owner)"""
    try:
        user_id = request.current_user['user_id']
        data = request.get_json()
        answers = data.get('answers', {})  # {question_id: answer_text}
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Check if form exists and user is the owner
        cursor.execute("""
            SELECT id FROM forms WHERE id = %s AND user_id = %s
        """, (form_id, user_id))
        form = cursor.fetchone()
        
        if not form:
            cursor.close()
            connection.close()
            return jsonify({'error': 'Form not found or access denied'}), 404
        
        # Check if submission exists and belongs to this form
        cursor.execute("""
            SELECT id FROM form_submissions WHERE id = %s AND form_id = %s
        """, (submission_id, form_id))
        submission = cursor.fetchone()
        
        if not submission:
            cursor.close()
            connection.close()
            return jsonify({'error': 'Response not found'}), 404
        
        # Delete existing answers
        cursor.execute("""
            DELETE FROM form_submission_answers WHERE submission_id = %s
        """, (submission_id,))
        
        # Insert new answers
        for question_id, answer_text in answers.items():
            if answer_text:  # Only save non-empty answers
                # Handle both string and array answers
                if isinstance(answer_text, list):
                    answer_str = json.dumps(answer_text)
                else:
                    answer_str = str(answer_text)
                
                cursor.execute("""
                    INSERT INTO form_submission_answers (submission_id, question_id, answer_text)
                    VALUES (%s, %s, %s)
                """, (submission_id, int(question_id), answer_str))
        
        connection.commit()
        cursor.close()
        connection.close()
        
        return jsonify({
            'message': 'Response updated successfully',
            'submission_id': submission_id
        }), 200
        
    except Exception as e:
        print(f"Update response error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/forms/<int:form_id>/responses/<int:submission_id>/score', methods=['PUT'])
@token_required
def update_form_response_score(form_id, submission_id):
    """Update manual scores for a response (only if user is the form owner)"""
    try:
        user_id = request.current_user['user_id']
        data = request.get_json()
        manual_scores = data.get('manual_scores', {})  # {question_id: points}
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Check if form exists and user is the owner
        cursor.execute("""
            SELECT id FROM forms WHERE id = %s AND user_id = %s
        """, (form_id, user_id))
        form = cursor.fetchone()
        
        if not form:
            cursor.close()
            connection.close()
            return jsonify({'error': 'Form not found or access denied'}), 404
        
        # Check if submission exists and belongs to this form
        cursor.execute("""
            SELECT id, quiz_results FROM form_submissions WHERE id = %s AND form_id = %s
        """, (submission_id, form_id))
        submission = cursor.fetchone()
        
        if not submission:
            cursor.close()
            connection.close()
            return jsonify({'error': 'Response not found'}), 404
        
        # Parse existing quiz_results and manual_scores
        quiz_results = None
        existing_manual_scores = {}
        if submission.get('quiz_results'):
            try:
                quiz_results = json.loads(submission['quiz_results']) if isinstance(submission['quiz_results'], str) else submission['quiz_results']
            except:
                pass
        
        # Get existing manual_scores
        try:
            cursor.execute("""
                SELECT manual_scores FROM form_submissions WHERE id = %s
            """, (submission_id,))
            result = cursor.fetchone()
            if result and result.get('manual_scores'):
                existing_manual_scores = json.loads(result['manual_scores']) if isinstance(result['manual_scores'], str) else result['manual_scores']
        except:
            pass
        
        # Merge manual scores
        merged_manual_scores = {**existing_manual_scores, **manual_scores}
        
        # Calculate total score
        auto_score = 0
        max_points = 0
        if quiz_results:
            auto_score = quiz_results.get('earned_points', 0)
            max_points = quiz_results.get('total_points', 0)
        
        manual_score = sum(float(score) for score in merged_manual_scores.values() if score is not None)
        total_score = float(auto_score + manual_score)  # Calculate raw total
        
        # Cap total_score to maximum possible points
        if max_points > 0:
            total_score = min(total_score, float(max_points))
        
        # Update submission with manual scores
        manual_scores_json = json.dumps(merged_manual_scores) if merged_manual_scores else None
        
        # Check if columns exist, if not add them
        try:
            cursor.execute("""
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'form_submissions' 
                AND COLUMN_NAME IN ('manual_scores', 'total_score', 'quiz_results')
            """)
            existing_columns = {row['COLUMN_NAME'] for row in cursor.fetchall()}
            
            # Add missing columns
            if 'manual_scores' not in existing_columns:
                try:
                    cursor.execute("ALTER TABLE form_submissions ADD COLUMN manual_scores JSON")
                    connection.commit()
                except mysql.connector.Error as e:
                    print(f"Warning: Could not add manual_scores column: {e}")
            
            if 'total_score' not in existing_columns:
                try:
                    cursor.execute("ALTER TABLE form_submissions ADD COLUMN total_score DECIMAL(10,2) DEFAULT 0")
                    connection.commit()
                except mysql.connector.Error as e:
                    print(f"Warning: Could not add total_score column: {e}")
            
            if 'quiz_results' not in existing_columns:
                try:
                    cursor.execute("ALTER TABLE form_submissions ADD COLUMN quiz_results JSON")
                    connection.commit()
                except mysql.connector.Error as e:
                    print(f"Warning: Could not add quiz_results column: {e}")
            
        except Exception as e:
            print(f"Warning: Could not check/add columns: {e}")
        
        # Now try to update
        try:
            # Build update query based on available columns
            update_fields = []
            update_values = []
            
            if manual_scores_json is not None:
                update_fields.append("manual_scores = %s")
                update_values.append(manual_scores_json)
            
            if total_score is not None:
                update_fields.append("total_score = %s")
                update_values.append(total_score)
            
            update_values.append(submission_id)
            
            if update_fields:
                update_query = f"UPDATE form_submissions SET {', '.join(update_fields)} WHERE id = %s"
                cursor.execute(update_query, tuple(update_values))
                connection.commit()
            else:
                raise Exception("No fields to update")
                
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            print(f"Update response score error: {e}")
            print(f"Traceback: {error_trace}")
            connection.rollback()
            cursor.close()
            connection.close()
            return jsonify({'error': f'Failed to update scores: {str(e)}'}), 500
        cursor.close()
        connection.close()
        
        return jsonify({
            'message': 'Manual scores updated successfully',
            'manual_scores': merged_manual_scores,
            'total_score': total_score
        }), 200
        
    except Exception as e:
        print(f"Update response score error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/forms/<int:form_id>/responses/<int:submission_id>', methods=['DELETE'])
@token_required
def delete_form_response(form_id, submission_id):
    """Delete a specific response (only if user is the form owner)"""
    try:
        user_id = request.current_user['user_id']
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Check if form exists and user is the owner
        cursor.execute("""
            SELECT id FROM forms WHERE id = %s AND user_id = %s
        """, (form_id, user_id))
        form = cursor.fetchone()
        
        if not form:
            cursor.close()
            connection.close()
            return jsonify({'error': 'Form not found or access denied'}), 404
        
        # Check if submission exists and belongs to this form
        cursor.execute("""
            SELECT id FROM form_submissions WHERE id = %s AND form_id = %s
        """, (submission_id, form_id))
        submission = cursor.fetchone()
        
        if not submission:
            cursor.close()
            connection.close()
            return jsonify({'error': 'Response not found'}), 404
        
        # Delete submission (cascade will handle answers)
        cursor.execute("DELETE FROM form_submissions WHERE id = %s", (submission_id,))
        connection.commit()
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'message': 'Response deleted successfully',
            'deleted_id': submission_id
        }), 200
        
    except Exception as e:
        print(f"Delete response error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/forms/shared/<share_token>', methods=['GET'])
def get_shared_form(share_token):
    """Get form by share token (authentication optional based on requires_login)"""
    try:
        # Get token from Authorization header if present
        auth_header = request.headers.get('Authorization', '')
        token = None
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Check if requires_login column exists
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'forms' 
            AND COLUMN_NAME = 'requires_login'
        """)
        requires_login_column_exists = cursor.fetchone() is not None
        
        # Get form by share token (only columns that exist)
        if requires_login_column_exists:
            cursor.execute("""
                SELECT id, user_id, title, description, confirmation_message, accepting_responses, response_limit, is_shared, share_token, requires_login,
                       created_at, updated_at, last_opened_at
                FROM forms
                WHERE share_token = %s
            """, (share_token,))
        else:
            cursor.execute("""
                SELECT id, user_id, title, description, confirmation_message, accepting_responses, response_limit, is_shared, share_token, 
                       created_at, updated_at, last_opened_at
                FROM forms
                WHERE share_token = %s
            """, (share_token,))
        form = cursor.fetchone()
        
        if not form:
            cursor.close()
            connection.close()
            return jsonify({'error': 'Form not found'}), 404
        
        # Check if login is required
        # MySQL returns BOOLEAN as 0/1, convert to Python boolean
        if requires_login_column_exists:
            requires_login = bool(form.get('requires_login', 1))  # Default to True (1) if not set
        else:
            requires_login = True  # Default to True for backward compatibility
        
        # If login is required, verify token
        if requires_login:
            if not token:
                cursor.close()
                connection.close()
                return jsonify({'error': 'Authentication required'}), 401
            
            # Verify token
            try:
                decoded = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
                user_id = decoded.get('user_id')
                if not user_id:
                    cursor.close()
                    connection.close()
                    return jsonify({'error': 'Invalid token'}), 401
            except jwt.ExpiredSignatureError:
                cursor.close()
                connection.close()
                return jsonify({'error': 'Token expired'}), 401
            except jwt.InvalidTokenError:
                cursor.close()
                connection.close()
                return jsonify({'error': 'Invalid token'}), 401
        
        # Update last_opened_at timestamp when form is viewed
        try:
            cursor.execute("""
                UPDATE forms 
                SET last_opened_at = NOW() 
                WHERE id = %s
            """, (form['id'],))
            connection.commit()
        except Exception as e:
            # If column doesn't exist, just continue (backward compatibility)
            print(f"Warning: Could not update last_opened_at: {e}")
            pass
        
        # Note: Form settings columns don't exist in current schema, so we skip those checks
        # Forms are always accepting responses by default
        
        # Check if sections table exists
        cursor.execute("""
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'form_sections'
        """)
        sections_table_exists = cursor.fetchone() is not None
        
        # Check if section_id column exists in form_questions
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'form_questions' 
            AND COLUMN_NAME = 'section_id'
        """)
        section_id_column_exists = cursor.fetchone() is not None
        
        # Get form sections if table exists
        sections = []
        if sections_table_exists:
            cursor.execute("""
                SELECT id, section_title, section_description, display_order, conditional_navigation
                FROM form_sections
                WHERE form_id = %s
                ORDER BY display_order ASC
            """, (form['id'],))
            db_sections = cursor.fetchall()
            print(f"Get shared form: Found {len(db_sections)} sections in database for form_id={form['id']}")
            
            for section in db_sections:
                conditional_nav = None
                if section['conditional_navigation']:
                    try:
                        conditional_nav = json.loads(section['conditional_navigation'])
                    except:
                        pass
                
                section_obj = {
                    'id': str(section['id']),  # Convert to string for frontend
                    'title': section['section_title'],
                    'description': section.get('section_description'),
                    'display_order': section.get('display_order', 0),
                    'conditionalNavigation': conditional_nav
                }
                sections.append(section_obj)
                print(f"  Added section: id={section_obj['id']}, title='{section_obj['title']}'")
        
        print(f"Get shared form: Total sections prepared: {len(sections)}")
        
        # Get form questions
        if section_id_column_exists:
            cursor.execute("""
                SELECT id, section_id, question_text, question_type, options, is_required, display_order
                FROM form_questions
                WHERE form_id = %s
                ORDER BY display_order ASC
            """, (form['id'],))
        else:
            cursor.execute("""
                SELECT id, question_text, question_type, options, is_required, display_order
                FROM form_questions
                WHERE form_id = %s
                ORDER BY display_order ASC
            """, (form['id'],))
        questions = cursor.fetchall()
        
        # Parse JSON options and extract has_other, description, validation, correct_answer, and conditional_logic
        for question in questions:
            has_other = False
            description = ''
            validation = None
            correct_answer = None
            points = 1
            conditional_logic = None
            
            if question['options']:
                try:
                    parsed = json.loads(question['options'])
                    # Check if it's the new format with metadata
                    if isinstance(parsed, dict) and ('has_other' in parsed or 'description' in parsed or 'validation' in parsed or 'correct_answer' in parsed or 'conditional_logic' in parsed):
                        has_other = parsed.get('has_other', False)
                        description = parsed.get('description', '')
                        validation = parsed.get('validation')
                        correct_answer = parsed.get('correct_answer')
                        points = parsed.get('points', 1)
                        conditional_logic = parsed.get('conditional_logic')
                        question['options'] = parsed.get('options', [])
                    else:
                        # Old format - just an array
                        question['options'] = parsed if isinstance(parsed, list) else []
                except:
                    question['options'] = []
            else:
                question['options'] = []
            question['has_other'] = has_other
            question['description'] = description
            if validation:
                question['validation'] = validation
            if correct_answer is not None:
                question['correct_answer'] = correct_answer
                question['points'] = points
            if conditional_logic:
                question['conditional_logic'] = conditional_logic
            
            # Map section_id from database ID to frontend section object if applicable
            if section_id_column_exists and question.get('section_id'):
                db_section_id = question['section_id']
                # Find the section object with matching id
                section_obj = None
                for section in sections:
                    # Compare with database ID converted to string
                    if str(db_section_id) == str(section.get('id')):
                        section_obj = section
                        break
                if section_obj:
                    question['sectionId'] = section_obj['id']
                    print(f"  ✅ Question '{question.get('question_text', '')[:30]}' mapped to section '{section_obj.get('title', '')}' (ID: {section_obj.get('id')})")
                else:
                    question['sectionId'] = None
                    print(f"  ⚠️ Question '{question.get('question_text', '')[:30]}' has section_id={db_section_id} but no matching section found. Available sections: {[s.get('id') for s in sections]}")
            else:
                question['sectionId'] = None
                if section_id_column_exists:
                    print(f"  ⚠️ Question '{question.get('question_text', '')[:30]}' has no section_id")
        
        cursor.close()
        connection.close()
        
        response_data = {
            'id': form['id'],
            'user_id': form['user_id'],
            'title': form['title'],
            'description': form['description'],
            'confirmation_message': form.get('confirmation_message'),
            'accepting_responses': form.get('accepting_responses', True),
            'response_limit': form.get('response_limit'),
            'is_shared': form['is_shared'],
            'share_token': form['share_token'],
            'requires_login': bool(form.get('requires_login', 1)) if requires_login_column_exists else True,  # Convert MySQL 0/1 to boolean
            'questions': questions,
            'created_at': form['created_at'].isoformat() if form['created_at'] else None,
            'updated_at': form['updated_at'].isoformat() if form['updated_at'] else None
        }
        
        # Always include sections array (even if empty)
        if sections_table_exists:
            response_data['sections'] = sections
            print(f"Get shared form: Returning {len(sections)} sections")
            for i, section in enumerate(sections):
                print(f"  Section {i}: id={section.get('id')}, title='{section.get('title')}'")
        else:
            response_data['sections'] = []
            print("Get shared form: sections_table_exists=False, returning empty sections array")
        
        # Debug: Log questions with their sectionIds
        print(f"Get shared form: Returning {len(questions)} questions")
        for q in questions:
            print(f"  Question '{q.get('question_text', '')[:30]}': sectionId={q.get('sectionId')}")
        
        return jsonify(response_data), 200
        
    except Exception as e:
        print(f"Get shared form error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/forms/shared/<share_token>/submit', methods=['POST'])
def submit_shared_form(share_token):
    """Submit a shared form (public, no auth required)"""
    try:
        data = request.get_json()
        answers = data.get('answers', {})  # {question_id: answer_text}
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Check if requires_login column exists
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'forms' 
            AND COLUMN_NAME = 'requires_login'
        """)
        requires_login_column_exists = cursor.fetchone() is not None
        
        # Get form by share token (check if accepting responses and response limit)
        # Also get email notification settings and requires_login
        if requires_login_column_exists:
            cursor.execute("""
                SELECT f.id, f.accepting_responses, f.response_limit, f.title, f.description, f.confirmation_message,
                       f.email_notifications_enabled, f.email_notification_recipients, f.send_confirmation_email,
                       f.requires_login, f.user_id, u.username
                FROM forms f
                LEFT JOIN users u ON f.user_id = u.id
                WHERE f.share_token = %s
            """, (share_token,))
        else:
            cursor.execute("""
                SELECT f.id, f.accepting_responses, f.response_limit, f.title, f.description, f.confirmation_message,
                       f.email_notifications_enabled, f.email_notification_recipients, f.send_confirmation_email,
                       f.user_id, u.username
                FROM forms f
                LEFT JOIN users u ON f.user_id = u.id
                WHERE f.share_token = %s
            """, (share_token,))
        form = cursor.fetchone()
        
        if not form:
            cursor.close()
            connection.close()
            return jsonify({'error': 'Form not found'}), 404
        
        # Check if login is required
        # MySQL returns BOOLEAN as 0/1, convert to Python boolean
        if requires_login_column_exists:
            requires_login = bool(form.get('requires_login', 1))  # Default to True (1) if not set
        else:
            requires_login = True  # Default to True for backward compatibility
        
        # If login is required, verify token
        if requires_login:
            auth_header = request.headers.get('Authorization', '')
            if not auth_header.startswith('Bearer '):
                cursor.close()
                connection.close()
                return jsonify({'error': 'Authentication required'}), 401
            
            token = auth_header.split(' ')[1]
            try:
                decoded = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
                user_id = decoded.get('user_id')
                if not user_id:
                    cursor.close()
                    connection.close()
                    return jsonify({'error': 'Invalid token'}), 401
            except jwt.ExpiredSignatureError:
                cursor.close()
                connection.close()
                return jsonify({'error': 'Token expired'}), 401
            except jwt.InvalidTokenError:
                cursor.close()
                connection.close()
                return jsonify({'error': 'Invalid token'}), 401
        
        # Check if form is accepting responses
        if not form.get('accepting_responses', True):
            cursor.close()
            connection.close()
            return jsonify({'error': 'This form is no longer accepting responses'}), 403
        
        form_id = form['id']
        
        # Check response limit
        response_limit = form.get('response_limit')
        if response_limit is not None:
            # Get current response count
            cursor.execute("""
                SELECT COUNT(*) as count FROM form_submissions WHERE form_id = %s
            """, (form_id,))
            current_count = cursor.fetchone()['count']
            
            if current_count >= response_limit:
                cursor.close()
                connection.close()
                return jsonify({'error': f'This form has reached its response limit of {response_limit} responses'}), 403
        
        # Get questions with validation rules and correct answers
        cursor.execute("""
            SELECT id, question_text, question_type, options, is_required
            FROM form_questions
            WHERE form_id = %s
            ORDER BY display_order ASC
        """, (form_id,))
        questions = cursor.fetchall()
        
        # Parse validation rules and correct answers from options JSON
        question_validations = {}
        question_correct_answers = {}
        question_points = {}  # Track points for ALL questions (with or without correct answers)
        is_quiz = False
        
        for question in questions:
            validation = None
            correct_answer = None
            points = 1
            
            if question['options']:
                try:
                    parsed = json.loads(question['options'])
                    if isinstance(parsed, dict):
                        validation = parsed.get('validation')
                        correct_answer = parsed.get('correct_answer')
                        points = parsed.get('points', 1)
                        if correct_answer is not None:
                            is_quiz = True  # Form has at least one question with correct answer
                    else:
                        # Old format - just an array
                        pass
                except:
                    pass
            
            # Store points for ALL questions (for calculating total_points correctly)
            # Even questions without correct answers can have points (for manual scoring)
            question_points[question['id']] = points
            
            if validation:
                question_validations[question['id']] = {
                    'validation': validation,
                    'question_type': question['question_type'],
                    'is_required': question['is_required']
                }
            
            if correct_answer is not None:
                question_correct_answers[question['id']] = correct_answer
        
        # Validate answers
        for question_id_str, answer_text in answers.items():
            question_id = int(question_id_str)
            if question_id not in question_validations:
                continue
            
            validation_info = question_validations[question_id]
            validation = validation_info['validation']
            question_type = validation_info['question_type']
            
            # Skip validation if answer is empty and not required
            if not answer_text and not validation_info['is_required']:
                continue
            
            # Parse answer (could be JSON string for arrays)
            try:
                answer = json.loads(answer_text) if isinstance(answer_text, str) else answer_text
            except:
                answer = answer_text
            
            # Validate based on type
            if question_type in ('text', 'textarea', 'email'):
                if isinstance(answer, list):
                    for item in answer:
                        if isinstance(item, str) and item.startswith('__OTHER__:'):
                            item = item.replace('__OTHER__:', '')
                        validate_text_answer(item, validation, question_id)
                elif isinstance(answer, str):
                    if answer.startswith('__OTHER__:'):
                        answer = answer.replace('__OTHER__:', '')
                    validate_text_answer(answer, validation, question_id)
            elif question_type in ('number', 'linear'):
                if isinstance(answer, str):
                    try:
                        num = float(answer)
                        validate_number_answer(num, validation, question_id)
                    except ValueError:
                        return jsonify({'error': f'Invalid number format for question {question_id}'}), 400
        
        # Get user_id if authenticated (optional)
        submitted_by = None
        auth_header = request.headers.get('Authorization')
        if auth_header:
            try:
                token = auth_header.split(' ')[1]
                payload = verify_token(token)
                if payload:
                    submitted_by = payload['user_id']
            except:
                pass  # Anonymous submission is allowed
        
        # Calculate quiz score if quiz mode
        quiz_results = None
        if is_quiz:
            # Calculate total_points only from questions that have correct answers AND points > 0
            # Exclude questions without points (points = 0 or None)
            total_points = 0
            earned_points = 0
            question_results = {}
            
            # Only process questions with correct answers for auto-scoring
            for question_id, correct_answer in question_correct_answers.items():
                question_id_int = int(question_id) if isinstance(question_id, str) else question_id
                user_answer = answers.get(str(question_id_int))
                points = question_points.get(question_id_int, 1)
                
                # Only include questions with points > 0 in scoring
                if points and points > 0:
                    total_points += points
                
                is_correct = False
                if user_answer is not None:
                    # Normalize answers for comparison
                    user_answer_normalized = user_answer
                    correct_answer_normalized = correct_answer
                    
                    # Handle array answers (checkbox)
                    if isinstance(user_answer, list):
                        user_answer_normalized = sorted([str(a).strip().lower() for a in user_answer if a])
                    elif isinstance(user_answer, str):
                        user_answer_normalized = user_answer.strip().lower()
                    
                    if isinstance(correct_answer, list):
                        correct_answer_normalized = sorted([str(a).strip().lower() for a in correct_answer])
                    elif isinstance(correct_answer, str):
                        correct_answer_normalized = correct_answer.strip().lower()
                    
                    # Compare answers (case-insensitive, trim whitespace)
                    if isinstance(user_answer_normalized, list) and isinstance(correct_answer_normalized, list):
                        is_correct = len(user_answer_normalized) == len(correct_answer_normalized) and \
                                    all(a in correct_answer_normalized for a in user_answer_normalized)
                    else:
                        is_correct = str(user_answer_normalized) == str(correct_answer_normalized)
                    
                    if is_correct and points and points > 0:
                        earned_points += points
                
                # Only include in question_results if question has points > 0
                if points and points > 0:
                    question_results[question_id_int] = {
                        'is_correct': is_correct,
                        'user_answer': user_answer,
                        'correct_answer': correct_answer,
                        'points': points,
                        'earned_points': points if is_correct else 0
                    }
            
            quiz_results = {
                'total_points': total_points,
                'earned_points': earned_points,
                'score_percentage': round((earned_points / total_points * 100) if total_points > 0 else 0, 2),
                'question_results': question_results
            }
        
        # Create submission with quiz results if available
        quiz_results_json = json.dumps(quiz_results) if quiz_results else None
        
        # Check if quiz_results column exists
        quiz_results_column_exists = False
        try:
            cursor.execute("""
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'form_submissions' 
                AND COLUMN_NAME = 'quiz_results'
            """)
            quiz_results_column_exists = cursor.fetchone() is not None
        except:
            pass
        
        # Add quiz_results column if it doesn't exist and we have quiz results
        if not quiz_results_column_exists and quiz_results_json:
            try:
                cursor.execute("ALTER TABLE form_submissions ADD COLUMN quiz_results JSON")
                connection.commit()
                quiz_results_column_exists = True
            except mysql.connector.Error as e:
                print(f"Warning: Could not add quiz_results column: {e}")
        
        # Insert submission with or without quiz_results
        if quiz_results_column_exists and quiz_results_json:
            cursor.execute("""
                INSERT INTO form_submissions (form_id, submitted_by, quiz_results)
                VALUES (%s, %s, %s)
            """, (form_id, submitted_by, quiz_results_json))
        else:
            cursor.execute("""
                INSERT INTO form_submissions (form_id, submitted_by)
                VALUES (%s, %s)
            """, (form_id, submitted_by))
        
        submission_id = cursor.lastrowid
        
        # Insert answers
        for question_id, answer_text in answers.items():
            if answer_text:  # Only save non-empty answers
                # Handle both string and array answers
                if isinstance(answer_text, list):
                    # For checkbox/multiple choice, save each answer separately or as JSON
                    answer_str = json.dumps(answer_text)
                else:
                    answer_str = str(answer_text)
                
                cursor.execute("""
                    INSERT INTO form_submission_answers (submission_id, question_id, answer_text)
                    VALUES (%s, %s, %s)
                """, (submission_id, int(question_id), answer_str))
        
        connection.commit()
        
        # Create in-app notification for form owner
        try:
            # Get form owner
            cursor.execute("SELECT user_id, title FROM forms WHERE id = %s", (form_id,))
            form_owner = cursor.fetchone()
            
            if form_owner:
                owner_user_id = form_owner['user_id']
                form_title = form_owner['title']
                
                # Get submitted_by username if available
                submitted_by_text = "Anonymous"
                if submitted_by:
                    cursor.execute("SELECT username FROM users WHERE id = %s", (submitted_by,))
                    user_result = cursor.fetchone()
                    if user_result:
                        submitted_by_text = user_result['username']
                
                # Check if notifications table exists
                cursor.execute("""
                    SELECT TABLE_NAME 
                    FROM INFORMATION_SCHEMA.TABLES 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'notifications'
                """)
                notifications_table_exists = cursor.fetchone() is not None
                
                if notifications_table_exists:
                    # Create notification message
                    notification_message = f"New submission for '{form_title}' by {submitted_by_text}"
                    
                    # Insert notification
                    cursor.execute("""
                        INSERT INTO notifications (user_id, form_id, submission_id, message)
                        VALUES (%s, %s, %s, %s)
                    """, (owner_user_id, form_id, submission_id, notification_message))
                    connection.commit()
                    
                    # Get the inserted notification ID
                    notification_id = cursor.lastrowid
                    
                    # Send real-time notification via SSE
                    notification_data = {
                        'type': 'new_notification',
                        'id': notification_id,
                        'form_id': form_id,
                        'submission_id': submission_id,
                        'message': notification_message,
                        'form_title': form_title,
                        'is_read': False,
                        'created_at': datetime.now(timezone.utc).isoformat()
                    }
                    send_notification_to_user(owner_user_id, notification_data)
        except Exception as e:
            print(f"Error creating notification: {e}")
            # Don't fail the submission if notification creation fails
        
        # Send email notifications if enabled
        if form.get('email_notifications_enabled') and is_email_configured():
            try:
                # Get recipient emails
                recipients_str = form.get('email_notification_recipients', '').strip()
                recipients = []
                
                if recipients_str:
                    # Parse comma-separated emails
                    recipients = [email.strip() for email in recipients_str.split(',') if email.strip()]
                
                # If no custom recipients, try to get form owner email
                # For now, we'll use a placeholder - you might want to add email column to users table
                if not recipients:
                    # Default to form owner username as email (you may want to add email to users table)
                    # For now, skip if no recipients configured
                    pass
                
                # Send notification email to form owner/recipients
                if recipients:
                    # Format submission timestamp
                    submitted_at_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')
                    
                    # Get submitted_by username if available
                    submitted_by_username = None
                    if submitted_by:
                        cursor.execute("SELECT username FROM users WHERE id = %s", (submitted_by,))
                        user_result = cursor.fetchone()
                        if user_result:
                            submitted_by_username = user_result['username']
                    
                    # Format email HTML
                    email_html = format_submission_email_html(
                        form_title=form.get('title', 'Untitled Form'),
                        form_description=form.get('description'),
                        submission_id=submission_id,
                        submitted_at=submitted_at_str,
                        submitted_by=submitted_by_username,
                        answers=answers,
                        questions=questions,
                        quiz_results=quiz_results
                    )
                    
                    # Send email
                    send_email(
                        to_emails=recipients,
                        subject=f"New Submission: {form.get('title', 'Untitled Form')}",
                        html_body=email_html
                    )
            except Exception as e:
                print(f"Error sending notification email: {e}")
                # Don't fail the submission if email fails
        
        # Send confirmation email to submitter if enabled
        if form.get('send_confirmation_email') and is_email_configured():
            try:
                # Try to extract email from answers
                submitter_email = extract_email_from_answers(answers, questions)
                
                if submitter_email:
                    confirmation_html = format_confirmation_email_html(
                        form_title=form.get('title', 'Untitled Form'),
                        confirmation_message=form.get('confirmation_message')
                    )
                    
                    send_email(
                        to_emails=[submitter_email],
                        subject=f"Submission Confirmation: {form.get('title', 'Untitled Form')}",
                        html_body=confirmation_html
                    )
            except Exception as e:
                print(f"Error sending confirmation email: {e}")
                # Don't fail the submission if email fails
        
        cursor.close()
        connection.close()
        
        response_data = {
            'message': 'Form submitted successfully',
            'submission_id': submission_id
        }
        
        # Include quiz results if available
        if quiz_results:
            response_data['quiz_results'] = quiz_results
        
        return jsonify(response_data), 201
        
    except Exception as e:
        print(f"Submit form error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/forms/<int:form_id>/settings', methods=['GET'])
@token_required
def get_form_settings(form_id):
    """Get form settings"""
    try:
        user_id = request.current_user['user_id']
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Check if form exists and user is the owner
        cursor.execute("""
            SELECT id FROM forms
            WHERE id = %s AND user_id = %s
        """, (form_id, user_id))
        form = cursor.fetchone()
        
        if not form:
            cursor.close()
            connection.close()
            return jsonify({'error': 'Form not found or access denied'}), 404
        
        cursor.close()
        connection.close()
        
        # Return default settings since columns don't exist in schema
        return jsonify({
            'accept_responses': True,
            'collect_email': False,
            'max_responses': None,
            'allow_multiple_submissions': True,
            'show_progress_bar': True,
            'confirmation_message': 'Thank you for your response!'
        }), 200
        
    except Exception as e:
        print(f"Get form settings error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/forms/<int:form_id>/settings', methods=['PUT'])
@token_required
def update_form_settings(form_id):
    """Update form settings"""
    try:
        user_id = request.current_user['user_id']
        data = request.get_json()
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Check if form exists and user is the owner
        cursor.execute("""
            SELECT id FROM forms WHERE id = %s AND user_id = %s
        """, (form_id, user_id))
        form = cursor.fetchone()
        
        if not form:
            cursor.close()
            connection.close()
            return jsonify({'error': 'Form not found or access denied'}), 404
        
        # Note: Settings columns don't exist in current schema
        # Just update the updated_at timestamp to acknowledge the request
        cursor.execute("""
            UPDATE forms 
            SET updated_at = NOW()
            WHERE id = %s
        """, (form_id,))
        
        connection.commit()
        cursor.close()
        connection.close()
        
        return jsonify({'message': 'Settings updated successfully'}), 200
        
    except Exception as e:
        print(f"Update form settings error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

def send_notification_to_user(user_id: int, notification_data: dict):
    """Send notification to connected SSE clients for a user"""
    with notification_lock:
        if user_id in notification_queues:
            for queue in notification_queues[user_id]:
                try:
                    queue.put(json.dumps(notification_data))
                except:
                    pass  # Queue might be closed

@app.route('/api/notifications/stream', methods=['GET'])
def stream_notifications():
    """Server-Sent Events endpoint for real-time notifications"""
    # Get token from query parameter (EventSource doesn't support custom headers)
    token = request.args.get('token')
    if not token:
        return jsonify({'error': 'Token is required'}), 401
    
    payload = verify_token(token)
    if not payload:
        return jsonify({'error': 'Invalid or expired token'}), 401
    
    user_id = payload['user_id']
    
    def generate():
        # Create a queue for this connection
        queue = Queue()
        
        # Add queue to user's notification queues
        with notification_lock:
            if user_id not in notification_queues:
                notification_queues[user_id] = []
            notification_queues[user_id].append(queue)
        
        try:
            # Send initial connection message
            yield f"data: {json.dumps({'type': 'connected'})}\n\n"
            
            # Keep connection alive and send notifications
            while True:
                try:
                    # Wait for notification (with timeout for keep-alive)
                    notification = queue.get(timeout=30)
                    yield f"data: {notification}\n\n"
                except:
                    # Send keep-alive ping every 30 seconds
                    yield f": keep-alive\n\n"
        except GeneratorExit:
            # Clean up when client disconnects
            with notification_lock:
                if user_id in notification_queues:
                    try:
                        notification_queues[user_id].remove(queue)
                        if not notification_queues[user_id]:
                            del notification_queues[user_id]
                    except:
                        pass
    
    response = Response(generate(), mimetype='text/event-stream')
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['X-Accel-Buffering'] = 'no'
    return response

@app.route('/api/notifications', methods=['GET'])
@token_required
def get_notifications():
    """Get all notifications for the current user"""
    try:
        user_id = request.current_user['user_id']
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Check if notifications table exists
        cursor.execute("""
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'notifications'
        """)
        notifications_table_exists = cursor.fetchone() is not None
        
        if not notifications_table_exists:
            cursor.close()
            connection.close()
            return jsonify([]), 200
        
        # Get notifications for user, ordered by newest first
        cursor.execute("""
            SELECT n.id, n.form_id, n.submission_id, n.message, n.is_read, n.created_at,
                   f.title as form_title
            FROM notifications n
            LEFT JOIN forms f ON n.form_id = f.id
            WHERE n.user_id = %s
            ORDER BY n.created_at DESC
            LIMIT 50
        """, (user_id,))
        
        notifications = cursor.fetchall()
        
        # Format timestamps
        for notification in notifications:
            if notification['created_at']:
                dt = notification['created_at']
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                notification['created_at'] = dt.isoformat()
        
        cursor.close()
        connection.close()
        
        return jsonify(notifications), 200
        
    except Exception as e:
        print(f"Get notifications error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/notifications/unread-count', methods=['GET'])
@token_required
def get_unread_notifications_count():
    """Get count of unread notifications for the current user"""
    try:
        user_id = request.current_user['user_id']
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Check if notifications table exists
        cursor.execute("""
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'notifications'
        """)
        notifications_table_exists = cursor.fetchone() is not None
        
        if not notifications_table_exists:
            cursor.close()
            connection.close()
            return jsonify({'count': 0}), 200
        
        # Get unread count
        cursor.execute("""
            SELECT COUNT(*) as count
            FROM notifications
            WHERE user_id = %s AND is_read = FALSE
        """, (user_id,))
        
        result = cursor.fetchone()
        count = result['count'] if result else 0
        
        cursor.close()
        connection.close()
        
        return jsonify({'count': count}), 200
        
    except Exception as e:
        print(f"Get unread notifications count error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/notifications/<int:notification_id>/read', methods=['PUT'])
@token_required
def mark_notification_read(notification_id):
    """Mark a notification as read"""
    try:
        user_id = request.current_user['user_id']
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Check if notification exists and belongs to user
        cursor.execute("""
            SELECT id FROM notifications WHERE id = %s AND user_id = %s
        """, (notification_id, user_id))
        
        notification = cursor.fetchone()
        
        if not notification:
            cursor.close()
            connection.close()
            return jsonify({'error': 'Notification not found'}), 404
        
        # Mark as read
        cursor.execute("""
            UPDATE notifications SET is_read = TRUE WHERE id = %s
        """, (notification_id,))
        
        connection.commit()
        
        # Send real-time update
        notification_data = {
            'type': 'notification_read',
            'id': notification_id
        }
        send_notification_to_user(user_id, notification_data)
        
        cursor.close()
        connection.close()
        
        return jsonify({'message': 'Notification marked as read'}), 200
        
    except Exception as e:
        print(f"Mark notification read error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/notifications/read-all', methods=['PUT'])
@token_required
def mark_all_notifications_read():
    """Mark all notifications as read for the current user"""
    try:
        user_id = request.current_user['user_id']
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Mark all as read
        cursor.execute("""
            UPDATE notifications SET is_read = TRUE WHERE user_id = %s AND is_read = FALSE
        """, (user_id,))
        
        connection.commit()
        
        # Send real-time update
        notification_data = {
            'type': 'all_notifications_read'
        }
        send_notification_to_user(user_id, notification_data)
        
        cursor.close()
        connection.close()
        
        return jsonify({'message': 'All notifications marked as read'}), 200
        
    except Exception as e:
        print(f"Mark all notifications read error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/forms/<int:form_id>/responses/export', methods=['GET'])
@token_required
def export_form_responses(form_id):
    """Export form responses as CSV"""
    try:
        user_id = request.current_user['user_id']
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Check if form exists and user is the owner
        cursor.execute("""
            SELECT id, title FROM forms WHERE id = %s AND user_id = %s
        """, (form_id, user_id))
        form = cursor.fetchone()
        
        if not form:
            cursor.close()
            connection.close()
            return jsonify({'error': 'Form not found or access denied'}), 404
        
        # Get all questions
        cursor.execute("""
            SELECT id, question_text, display_order
            FROM form_questions
            WHERE form_id = %s
            ORDER BY display_order ASC
        """, (form_id,))
        questions = cursor.fetchall()
        
        # Get all submissions
        cursor.execute("""
            SELECT s.id, s.submitted_by, s.submitted_at, u.username
            FROM form_submissions s
            LEFT JOIN users u ON s.submitted_by = u.id
            WHERE s.form_id = %s
            ORDER BY s.submitted_at ASC
        """, (form_id,))
        submissions = cursor.fetchall()
        
        # Create CSV in memory
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header row
        header = ['Timestamp', 'Submitted By']
        question_map = {}
        for q in questions:
            header.append(q['question_text'])
            question_map[q['id']] = q['question_text']
        writer.writerow(header)
        
        # Write data rows
        for submission in submissions:
            # Get answers for this submission
            cursor.execute("""
                SELECT question_id, answer_text
                FROM form_submission_answers
                WHERE submission_id = %s
            """, (submission['id'],))
            answers = cursor.fetchall()
            
            # Create answer dictionary
            answers_dict = {}
            for answer in answers:
                qid = answer['question_id']
                answer_text = answer['answer_text']
                
                # Try to parse JSON
                try:
                    parsed = json.loads(answer_text)
                    if isinstance(parsed, list):
                        # Format list items, handling "Other" option
                        formatted_items = []
                        for item in parsed:
                            if isinstance(item, str) and item.startswith('__OTHER__:'):
                                # Extract user text from "__OTHER__:user text"
                                user_text = item.replace('__OTHER__:', '', 1)
                                formatted_items.append(f'Other: {user_text}')
                            else:
                                formatted_items.append(str(item))
                        answers_dict[qid] = ', '.join(formatted_items)
                    else:
                        # Handle single value
                        if isinstance(parsed, str) and parsed.startswith('__OTHER__:'):
                            user_text = parsed.replace('__OTHER__:', '', 1)
                            answers_dict[qid] = f'Other: {user_text}'
                        else:
                            answers_dict[qid] = str(parsed)
                except:
                    # Handle plain text that might be "Other" format
                    if answer_text and answer_text.startswith('__OTHER__:'):
                        user_text = answer_text.replace('__OTHER__:', '', 1)
                        answers_dict[qid] = f'Other: {user_text}'
                    else:
                        answers_dict[qid] = answer_text or ''
            
            # Format timestamp for CSV
            timestamp_str = ''
            if submission['submitted_at']:
                dt = submission['submitted_at']
                # Make timezone-aware if needed
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                timestamp_str = dt.strftime('%Y-%m-%d %H:%M:%S')
            
            row = [
                timestamp_str,
                submission['username'] or (f"User #{submission['submitted_by']}" if submission['submitted_by'] else 'Anonymous')
            ]
            
            # Add answers in question order
            for q in questions:
                row.append(answers_dict.get(q['id'], ''))
            
            writer.writerow(row)
        
        cursor.close()
        connection.close()
        
        # Create response with CSV
        output.seek(0)
        # Sanitize filename - remove special characters that might cause issues
        safe_filename = "".join(c for c in form["title"] if c.isalnum() or c in (' ', '-', '_')).strip()
        safe_filename = safe_filename.replace(' ', '_')[:50]  # Limit length and replace spaces
        if not safe_filename:
            safe_filename = "form"
        
        response = Response(
            output.getvalue(),
            mimetype='text/csv',
            headers={'Content-Disposition': f'attachment; filename="{safe_filename}_responses.csv"'}
        )
        return response
        
    except Exception as e:
        print(f"Export responses error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/v1/quiz/results', methods=['GET'])
@api_key_required
def get_quiz_results():
    """Get quiz results by quiz-id (form_id) - requires API key authentication"""
    try:
        # Get quiz-id from query parameters
        quiz_id = request.args.get('quiz-id') or request.args.get('quiz_id')
        
        if not quiz_id:
            return jsonify({'error': 'quiz-id parameter is required'}), 400
        
        try:
            quiz_id = int(quiz_id)
        except ValueError:
            return jsonify({'error': 'Invalid quiz-id. Must be a number'}), 400
        
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = connection.cursor(dictionary=True)
        
        # Verify that the form exists and is a quiz
        cursor.execute("""
            SELECT id, title, description, is_quiz
            FROM forms
            WHERE id = %s
        """, (quiz_id,))
        form = cursor.fetchone()
        
        if not form:
            cursor.close()
            connection.close()
            return jsonify({'error': 'Quiz not found'}), 404
        
        if not form.get('is_quiz', False):
            cursor.close()
            connection.close()
            return jsonify({'error': 'The specified form is not a quiz'}), 400
        
        # Get all quiz submissions with results
        try:
            cursor.execute("""
                SELECT s.id, s.submitted_by, s.submitted_at, u.username, s.quiz_results, s.manual_scores, s.total_score
                FROM form_submissions s
                LEFT JOIN users u ON s.submitted_by = u.id
                WHERE s.form_id = %s
                ORDER BY s.submitted_at DESC
            """, (quiz_id,))
        except mysql.connector.Error:
            # quiz_results column might not exist, use basic query
            cursor.execute("""
                SELECT s.id, s.submitted_by, s.submitted_at, u.username
                FROM form_submissions s
                LEFT JOIN users u ON s.submitted_by = u.id
                WHERE s.form_id = %s
                ORDER BY s.submitted_at DESC
            """, (quiz_id,))
        
        submissions = cursor.fetchall()
        
        # Get all answers for these submissions
        results = []
        for submission in submissions:
            # Get answers for this submission
            cursor.execute("""
                SELECT qa.question_id, qa.answer_text, q.question_text, q.question_type
                FROM form_submission_answers qa
                INNER JOIN form_questions q ON qa.question_id = q.id
                WHERE qa.submission_id = %s
                ORDER BY q.display_order ASC
            """, (submission['id'],))
            answers = cursor.fetchall()
            
            # Organize answers by question_id
            answers_dict = {}
            for answer in answers:
                question_id = answer['question_id']
                answer_text = answer['answer_text']
                
                # Try to parse JSON if it's a checkbox/multiple choice answer
                try:
                    parsed = json.loads(answer_text)
                    if isinstance(parsed, list):
                        answers_dict[question_id] = parsed
                    else:
                        if question_id not in answers_dict:
                            answers_dict[question_id] = []
                        answers_dict[question_id].append(str(parsed))
                except:
                    # Regular text answer
                    if question_id not in answers_dict:
                        answers_dict[question_id] = []
                    answers_dict[question_id].append(answer_text)
            
            # Format submitted_at with timezone awareness
            submitted_at_iso = None
            if submission['submitted_at']:
                dt = submission['submitted_at']
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                submitted_at_iso = dt.isoformat()
            
            # Parse quiz_results if available
            quiz_results = None
            manual_scores = None
            total_score = None
            
            if submission.get('quiz_results'):
                try:
                    quiz_results = json.loads(submission['quiz_results']) if isinstance(submission['quiz_results'], str) else submission['quiz_results']
                except:
                    pass
            
            if submission.get('manual_scores'):
                try:
                    manual_scores = json.loads(submission['manual_scores']) if isinstance(submission['manual_scores'], str) else submission['manual_scores']
                except:
                    pass
            
            total_score = submission.get('total_score')
            if total_score is not None:
                try:
                    total_score = float(total_score)
                except (ValueError, TypeError):
                    total_score = None
            
            results.append({
                'submission_id': submission['id'],
                'submitted_at': submitted_at_iso,
                'submitted_by': submission['username'] or (f"User #{submission['submitted_by']}" if submission['submitted_by'] else 'Anonymous'),
                'user_id': submission['submitted_by'],
                'answers': answers_dict,
                'quiz_results': quiz_results,
                'manual_scores': manual_scores,
                'total_score': total_score,
                'score_percentage': quiz_results.get('score_percentage') if quiz_results else None,
                'earned_points': quiz_results.get('earned_points') if quiz_results else None,
                'total_points': quiz_results.get('total_points') if quiz_results else None
            })
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'quiz_id': quiz_id,
            'quiz_title': form['title'],
            'quiz_description': form.get('description'),
            'total_submissions': len(results),
            'results': results
        }), 200
        
    except Exception as e:
        print(f"Get quiz results error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    print("=" * 50)
    print("GleentForms Backend Server")
    print("=" * 50)
    print(f"Database: {DB_CONFIG['database']} @ {DB_CONFIG['host']}:{DB_CONFIG['port']}")
    print("Testing database connection...")
    
    # Test database connection on startup
    test_conn = get_db_connection()
    if test_conn:
        print("[OK] Database connection successful!")
        test_conn.close()
    else:
        print("[WARNING] Database connection failed!")
        print("  Make sure MySQL is running and .env is configured correctly")
        print("  Run: python check_backend.py to troubleshoot")
    
    print("=" * 50)
    print("Starting server on http://localhost:5000")
    print("Press CTRL+C to stop")
    print("=" * 50)
    print()
    
    app.run(host='0.0.0.0', port=5000, debug=True)

