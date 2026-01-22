# Email Notifications Setup Guide

## Overview
The email notifications feature allows form owners to receive email notifications when someone submits their form, and optionally send confirmation emails to form submitters.

## Features
- **Email Notifications to Form Owner**: Receive email notifications when forms are submitted
- **Confirmation Emails**: Automatically send confirmation emails to form submitters
- **Multiple Recipients**: Support for multiple email recipients (comma-separated)
- **HTML Email Templates**: Beautiful HTML email templates for notifications

## Setup Instructions

### 1. Database Migration
First, add the email notification columns to your database:

```bash
# Run the migration script
python database/add_email_notifications.py
```

Or manually add the columns:
```sql
ALTER TABLE forms 
ADD COLUMN email_notifications_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN email_notification_recipients TEXT,
ADD COLUMN send_confirmation_email BOOLEAN DEFAULT FALSE;
```

### 2. Configure SMTP Settings
Add your SMTP configuration to your `.env` file (or create one from `env.example`):

```env
# Email Configuration (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=GleentForms
SMTP_USE_TLS=True
```

### 3. Gmail Setup (Example)
If using Gmail, you'll need to:
1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password:
   - Go to Google Account → Security → 2-Step Verification → App passwords
   - Generate a password for "Mail"
   - Use this password as `SMTP_PASSWORD`

### 4. Other Email Providers
For other email providers, adjust the settings accordingly:

**Outlook/Hotmail:**
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USE_TLS=True
```

**SendGrid:**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
```

**Custom SMTP:**
```env
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_USER=your-username
SMTP_PASSWORD=your-password
SMTP_USE_TLS=True
```

## Usage

### Enabling Email Notifications for a Form

1. **Open Form Editor**: Edit any form you own
2. **Go to Settings Tab**: Click on the "Settings" tab
3. **Enable Email Notifications**: Toggle "Email Notifications" switch ON
4. **Add Recipients**: Enter email addresses (comma-separated) in the "Notification Recipients" field
   - Example: `admin@example.com, manager@example.com`
5. **Optional - Enable Confirmation Emails**: Toggle "Send Confirmation Email to Submitter" if you want to send confirmation emails
6. **Save Form**: Click "Save Form" to apply changes

### How It Works

#### Notification Emails (to Form Owner)
- Sent automatically when someone submits the form
- Includes:
  - Form title and description
  - Submission ID and timestamp
  - All submitted answers
  - Quiz results (if applicable)
- Sent to all email addresses listed in "Notification Recipients"

#### Confirmation Emails (to Submitter)
- Sent automatically if "Send Confirmation Email to Submitter" is enabled
- Requires the form to have an email field question
- The system automatically extracts the email from the form submission
- Includes:
  - Form title
  - Custom confirmation message (if set)

## Troubleshooting

### Emails Not Sending

1. **Check SMTP Configuration**: Verify all SMTP settings in `.env` are correct
2. **Check Email Logs**: Check backend logs for email-related errors
3. **Test SMTP Connection**: Verify your SMTP credentials work
4. **Check Recipients**: Ensure email addresses are valid and properly formatted
5. **Check Form Settings**: Verify email notifications are enabled for the form

### Common Issues

**"Email not configured"**
- Make sure all SMTP environment variables are set in `.env`
- Restart the backend server after changing `.env`

**"No recipient emails provided"**
- Add email addresses in the "Notification Recipients" field
- Ensure emails are comma-separated and valid

**Confirmation emails not sending**
- Ensure the form has an email field question
- The system looks for email-type questions first, then any field that looks like an email
- Verify the submitter provided a valid email address

## Email Templates

The system uses HTML email templates for both notification and confirmation emails. Templates are customizable in `backend/email_utils.py`:

- `format_submission_email_html()`: Notification email template
- `format_confirmation_email_html()`: Confirmation email template

## Security Notes

- Never commit `.env` file with real credentials
- Use App Passwords for Gmail instead of your main password
- Consider using environment-specific SMTP settings for production
- Email addresses are stored in plain text in the database (consider encryption for sensitive use cases)

## Future Enhancements

Potential improvements:
- Email template customization in UI
- Email scheduling/digests
- Email analytics (open rates, click rates)
- Support for email attachments
- Custom email sender name per form

