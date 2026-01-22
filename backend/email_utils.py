"""
Email utility functions for sending form notifications
"""
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import List, Optional, Dict, Any

# Email configuration from environment variables
SMTP_HOST = os.getenv('SMTP_HOST', 'smtp.gmail.com')
SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))
SMTP_USER = os.getenv('SMTP_USER', '')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', '')
SMTP_FROM_EMAIL = os.getenv('SMTP_FROM_EMAIL', SMTP_USER)
SMTP_FROM_NAME = os.getenv('SMTP_FROM_NAME', 'GleentForms')
SMTP_USE_TLS = os.getenv('SMTP_USE_TLS', 'True').lower() == 'true'

def is_email_configured() -> bool:
    """Check if email is properly configured"""
    return bool(SMTP_USER and SMTP_PASSWORD and SMTP_FROM_EMAIL)

def send_email(
    to_emails: List[str],
    subject: str,
    html_body: str,
    text_body: Optional[str] = None
) -> bool:
    """
    Send an email to one or more recipients
    
    Args:
        to_emails: List of recipient email addresses
        subject: Email subject
        html_body: HTML email body
        text_body: Plain text email body (optional)
    
    Returns:
        True if email sent successfully, False otherwise
    """
    if not is_email_configured():
        print("Email not configured. Skipping email send.")
        return False
    
    if not to_emails:
        print("No recipient emails provided.")
        return False
    
    try:
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
        msg['To'] = ', '.join(to_emails)
        
        # Add text and HTML parts
        if text_body:
            text_part = MIMEText(text_body, 'plain')
            msg.attach(text_part)
        
        html_part = MIMEText(html_body, 'html')
        msg.attach(html_part)
        
        # Send email
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            if SMTP_USE_TLS:
                server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        
        print(f"Email sent successfully to {', '.join(to_emails)}")
        return True
        
    except Exception as e:
        print(f"Error sending email: {e}")
        return False

def format_submission_email_html(
    form_title: str,
    form_description: Optional[str],
    submission_id: int,
    submitted_at: str,
    submitted_by: Optional[str],
    answers: Dict[int, Any],
    questions: List[Dict[str, Any]],
    quiz_results: Optional[Dict[str, Any]] = None
) -> str:
    """
    Format form submission data into HTML email body
    
    Args:
        form_title: Form title
        form_description: Form description
        submission_id: Submission ID
        submitted_at: Submission timestamp
        submitted_by: Username of submitter (or None)
        answers: Dictionary mapping question_id to answer
        questions: List of question dictionaries
        quiz_results: Optional quiz results dictionary
    
    Returns:
        HTML formatted email body
    """
    # Create question lookup
    question_lookup = {q['id']: q for q in questions}
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background-color: #6366f1; color: white; padding: 20px; border-radius: 8px 8px 0 0; }}
            .content {{ background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }}
            .footer {{ background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }}
            .question {{ margin-bottom: 20px; padding: 15px; background-color: white; border-left: 3px solid #6366f1; }}
            .question-text {{ font-weight: bold; color: #1f2937; margin-bottom: 8px; }}
            .answer {{ color: #4b5563; padding-left: 10px; }}
            .quiz-results {{ background-color: #dbeafe; padding: 15px; border-radius: 5px; margin-top: 20px; }}
            .quiz-score {{ font-size: 24px; font-weight: bold; color: #1e40af; }}
            .meta {{ color: #6b7280; font-size: 14px; margin-bottom: 20px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin: 0;">New Form Submission</h1>
            </div>
            <div class="content">
                <h2 style="margin-top: 0;">{form_title}</h2>
                {f'<p class="meta">{form_description}</p>' if form_description else ''}
                
                <div class="meta">
                    <strong>Submission ID:</strong> #{submission_id}<br>
                    <strong>Submitted at:</strong> {submitted_at}<br>
                    {f'<strong>Submitted by:</strong> {submitted_by}<br>' if submitted_by else '<strong>Submitted by:</strong> Anonymous<br>'}
                </div>
                
                <h3>Responses:</h3>
    """
    
    # Add answers
    for question_id, answer in answers.items():
        question = question_lookup.get(question_id, {})
        question_text = question.get('question_text', f'Question {question_id}')
        
        # Format answer
        if isinstance(answer, list):
            answer_text = ', '.join(str(a) for a in answer)
        else:
            answer_text = str(answer)
        
        # Clean up "Other" option prefix
        answer_text = answer_text.replace('__OTHER__:', '')
        
        html += f"""
                <div class="question">
                    <div class="question-text">{question_text}</div>
                    <div class="answer">{answer_text}</div>
                </div>
        """
    
    # Add quiz results if available
    if quiz_results:
        total_points = quiz_results.get('total_points', 0)
        earned_points = quiz_results.get('earned_points', 0)
        score_percentage = quiz_results.get('score_percentage', 0)
        
        html += f"""
                <div class="quiz-results">
                    <h3 style="margin-top: 0;">Quiz Results</h3>
                    <div class="quiz-score">{earned_points} / {total_points} ({score_percentage}%)</div>
                </div>
        """
    
    html += """
            </div>
            <div class="footer">
                <p>This is an automated notification from GleentForms</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return html

def format_confirmation_email_html(
    form_title: str,
    confirmation_message: Optional[str]
) -> str:
    """
    Format confirmation email for form submitter
    
    Args:
        form_title: Form title
        confirmation_message: Custom confirmation message
    
    Returns:
        HTML formatted email body
    """
    default_message = "Thank you for your submission! We have received your response."
    message = confirmation_message if confirmation_message else default_message
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background-color: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }}
            .content {{ background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }}
            .footer {{ background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }}
            .message {{ background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin: 0;">✓ Submission Received</h1>
            </div>
            <div class="content">
                <h2 style="margin-top: 0;">{form_title}</h2>
                <div class="message">
                    <p>{message}</p>
                </div>
            </div>
            <div class="footer">
                <p>This is an automated confirmation from GleentForms</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return html

def extract_email_from_answers(answers: Dict[int, Any], questions: List[Dict[str, Any]]) -> Optional[str]:
    """
    Extract email address from form answers (look for email type questions)
    
    Args:
        answers: Dictionary mapping question_id to answer
        questions: List of question dictionaries
    
    Returns:
        Email address if found, None otherwise
    """
    import re
    
    # Look for email type questions first
    for question in questions:
        if question.get('question_type') == 'email':
            question_id = question.get('id')
            if question_id in answers:
                email = answers[question_id]
                if isinstance(email, str) and re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
                    return email
    
    # Fallback: look for any answer that looks like an email
    for answer in answers.values():
        if isinstance(answer, str):
            if re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', answer):
                return answer
    
    return None

