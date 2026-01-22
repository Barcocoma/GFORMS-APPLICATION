-- Create database
CREATE DATABASE IF NOT EXISTS gleentforms;
USE gleentforms;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Forms table
CREATE TABLE IF NOT EXISTS forms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    confirmation_message TEXT,
    accepting_responses BOOLEAN DEFAULT TRUE,
    response_limit INT DEFAULT NULL,
    is_quiz BOOLEAN DEFAULT FALSE,
    is_shared BOOLEAN DEFAULT FALSE,
    share_token VARCHAR(255) UNIQUE,
    theme_color VARCHAR(50) DEFAULT 'purple',
    theme_background VARCHAR(50) DEFAULT 'white',
    header_image_url VARCHAR(500),
    email_notifications_enabled BOOLEAN DEFAULT FALSE,
    email_notification_recipients TEXT,
    send_confirmation_email BOOLEAN DEFAULT FALSE,
    requires_login BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_opened_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_share_token (share_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Form sections table
CREATE TABLE IF NOT EXISTS form_sections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    form_id INT NOT NULL,
    section_title VARCHAR(255) NOT NULL,
    section_description TEXT,
    display_order INT DEFAULT 0,
    conditional_navigation JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE,
    INDEX idx_form_id (form_id),
    INDEX idx_display_order (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Form questions table
CREATE TABLE IF NOT EXISTS form_questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    form_id INT NOT NULL,
    section_id INT NULL,
    question_text TEXT NOT NULL,
    question_type ENUM('text', 'textarea', 'radio', 'checkbox', 'select', 'number', 'email', 'date') NOT NULL,
    options JSON,
    is_required BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES form_sections(id) ON DELETE SET NULL,
    INDEX idx_form_id (form_id),
    INDEX idx_section_id (section_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Form submissions table
CREATE TABLE IF NOT EXISTS form_submissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    form_id INT NOT NULL,
    submitted_by INT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE,
    FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_form_id (form_id),
    INDEX idx_submitted_by (submitted_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Form submission answers table
CREATE TABLE IF NOT EXISTS form_submission_answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id INT NOT NULL,
    question_id INT NOT NULL,
    answer_text TEXT,
    FOREIGN KEY (submission_id) REFERENCES form_submissions(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES form_questions(id) ON DELETE CASCADE,
    INDEX idx_submission_id (submission_id),
    INDEX idx_question_id (question_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notifications table
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    user_id INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_api_key (api_key),
    INDEX idx_user_id (user_id),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Note: Default accounts will be created by running init_db.py
-- This ensures proper bcrypt password hashing
-- Run: python database/init_db.py after creating the database

