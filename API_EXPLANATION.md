# Quiz Results API Documentation

## Overview

This API endpoint retrieves quiz results (answers and scores) for all users who have taken a specific quiz. It provides comprehensive data about each submission including answers, scores, and detailed question-by-question results.

## How It Works

**Simple Explanation:**
- You have a quiz with ID `86`
- Multiple users have taken this quiz
- You want to retrieve all their results (answers, scores, etc.)
- Using this API, you can get all that data in a single request!

## Prerequisites

### 1. API Key Required
- This acts as a password for the API
- Default API key in database: `test-api-key-12345`
- You can create new API keys in the database

### 2. Quiz ID Required
- The ID of the quiz form you want to retrieve results for
- Example: `86` (Knowledge Quiz)
- **Note:** The form must be marked as a quiz (`is_quiz = 1`) in the database

## API Endpoint

**URL:**
```
GET http://localhost:5000/api/v1/quiz/results?quiz-id={QUIZ_ID}
```

**Headers:**
```
api-key: test-api-key-12345
```

## Testing the API

### Option 1: Using PowerShell (Recommended for Windows)

**Step-by-step commands:**

```powershell
# Step 1: Navigate to project directory
cd C:\xampp\htdocs\gleentforms-main

# Step 2: Set API key header
$headers = @{ 'api-key' = 'test-api-key-12345' }

# Step 3: Call the API (replace 86 with your quiz ID)
$result = Invoke-RestMethod -Uri "http://localhost:5000/api/v1/quiz/results?quiz-id=86" -Headers $headers -Method GET

# Step 4: Display the result
$result | ConvertTo-Json -Depth 10
```

**One-liner command:**

```powershell
cd C:\xampp\htdocs\gleentforms-main; $headers = @{ 'api-key' = 'test-api-key-12345' }; $result = Invoke-RestMethod -Uri "http://localhost:5000/api/v1/quiz/results?quiz-id=86" -Headers $headers -Method GET; $result | ConvertTo-Json -Depth 10
```

**Important Notes:**
- Make sure the backend server is running (`python backend/app.py`) in a separate terminal
- Replace `86` with your actual quiz ID
- Replace `test-api-key-12345` if you're using a different API key

### Option 2: Using Postman

1. Open Postman
2. Create a new GET request
3. URL: `http://localhost:5000/api/v1/quiz/results?quiz-id=86`
4. Go to Headers tab
5. Add header: `api-key` with value `test-api-key-12345`
6. Click Send

### Option 3: Using cURL (Linux/Mac)

```bash
curl -H "api-key: test-api-key-12345" "http://localhost:5000/api/v1/quiz/results?quiz-id=86"
```

### Option 4: Using Browser (Limited)

You can test the endpoint in a browser, but note that:
- Browser requests cannot include custom headers easily
- You'll need a browser extension that supports custom headers
- Recommended: Use Postman or PowerShell instead

## Example Response

When successful, you'll receive:

```json
{
  "quiz_id": 86,
  "quiz_title": "Knowledge Quiz",
  "quiz_description": "Test your knowledge with this quiz. Good luck!",
  "total_submissions": 2,
  "results": [
    {
      "submission_id": 130,
      "submitted_at": "2026-01-22T17:04:38+00:00",
      "submitted_by": "user",
      "user_id": 2,
      "answers": {
        "365": ["juswa"],
        "366": ["Paris"],
        "367": ["Mercury"],
        "368": ["4"]
      },
      "earned_points": 3,
      "total_points": 3,
      "score_percentage": 100.0,
      "total_score": 0.0,
      "quiz_results": {
        "earned_points": 3,
        "total_points": 3,
        "score_percentage": 100.0,
        "question_results": {
          "366": {
            "is_correct": true,
            "user_answer": "Paris",
            "correct_answer": "Paris",
            "points": 1,
            "earned_points": 1
          },
          "367": {
            "is_correct": true,
            "user_answer": "Mercury",
            "correct_answer": "Mercury",
            "points": 1,
            "earned_points": 1
          },
          "368": {
            "is_correct": true,
            "user_answer": "4",
            "correct_answer": "4",
            "points": 1,
            "earned_points": 1
          }
        }
      },
      "manual_scores": null
    }
  ]
}
```

## Response Fields Explained

### Top Level
- **quiz_id**: The ID of the quiz
- **quiz_title**: Title of the quiz
- **quiz_description**: Description of the quiz
- **total_submissions**: Number of submissions received
- **results**: Array of submission results

### Each Result Contains
- **submission_id**: Unique ID of the submission
- **submitted_at**: ISO timestamp of when the quiz was submitted
- **submitted_by**: Username of the person who submitted (or "Anonymous")
- **user_id**: ID of the user who submitted
- **answers**: Object containing all answers, keyed by question ID
- **earned_points**: Points earned by the user
- **total_points**: Maximum possible points
- **score_percentage**: Percentage score (0-100)
- **total_score**: Manual total score (if applicable)
- **quiz_results**: Detailed quiz results object
  - **earned_points**: Points earned
  - **total_points**: Total possible points
  - **score_percentage**: Percentage score
  - **question_results**: Object with detailed results per question
    - **is_correct**: Boolean indicating if answer is correct
    - **user_answer**: Answer provided by user
    - **correct_answer**: Correct answer
    - **points**: Points for this question
    - **earned_points**: Points earned for this question
- **manual_scores**: Manual scoring data (if applicable)

## Error Responses

### 401 - Missing API Key
```json
{
  "error": "API key is required"
}
```

### 401 - Invalid API Key
```json
{
  "error": "Invalid or inactive API key"
}
```

### 400 - Missing quiz-id Parameter
```json
{
  "error": "quiz-id parameter is required"
}
```

### 400 - Invalid quiz-id Format
```json
{
  "error": "Invalid quiz-id. Must be a number"
}
```

### 400 - Form is Not a Quiz
```json
{
  "error": "The specified form is not a quiz"
}
```

### 404 - Quiz Not Found
```json
{
  "error": "Quiz not found"
}
```

### 500 - Database Connection Error
```json
{
  "error": "Database connection failed"
}
```

## Use Cases

1. **External System Integration**
   - Integrate with other systems
   - Automatically retrieve quiz results
   - Build custom dashboards

2. **Analytics Dashboard**
   - Use for analytics and reporting
   - Display results in custom dashboards
   - Track performance over time

3. **Reporting**
   - Generate reports of quiz results
   - Export to Excel/CSV
   - Create summary reports

4. **Grading System**
   - Automatic grading
   - Score calculation
   - Grade distribution analysis

5. **Data Export**
   - Export quiz data for analysis
   - Integrate with learning management systems
   - Backup quiz results

## Security Features

- ✅ API Key authentication (required)
- ✅ Only active API keys work
- ✅ Only quiz forms can be accessed (regular forms return 400 error)
- ✅ Returns 401 if unauthorized
- ✅ Validates quiz ID format
- ✅ Checks if form exists and is a quiz

## Finding Your Quiz ID

### Method 1: From Web Application
1. Open the web app: `http://localhost:8080`
2. Log in to your account
3. Go to "My Forms"
4. Find your quiz form
5. Click on the quiz form
6. Check the URL - it will show: `http://localhost:8080/forms/86` (86 is the quiz ID)

### Method 2: Using Database Query
```sql
SELECT id, title, is_quiz 
FROM forms 
WHERE is_quiz = 1 
ORDER BY id DESC;
```

### Method 3: Using Python Script
```bash
python list_quizzes.py
```

## Troubleshooting

### Backend Server Not Running
**Error:** Connection refused or timeout

**Solution:**
1. Make sure the backend server is running
2. Start it with: `cd backend && python app.py`
3. Verify it's running on `http://localhost:5000`

### Quiz Not Found
**Error:** "Quiz not found" or "The specified form is not a quiz"

**Solution:**
1. Verify the quiz ID exists in the database
2. Make sure the form is marked as a quiz (`is_quiz = 1`)
3. Check the form ID in the web application

### API Key Invalid
**Error:** "Invalid or inactive API key"

**Solution:**
1. Verify the API key exists in the `api_keys` table
2. Check if the API key is active (`is_active = 1`)
3. Use the correct API key format

### Database Connection Error
**Error:** "Database connection failed"

**Solution:**
1. Make sure MySQL is running (XAMPP Control Panel)
2. Check your `.env` file in `backend/` directory
3. Verify database credentials are correct
4. Ensure the database `gleentforms` exists

## Next Steps

1. Create more API keys in the database for different clients
2. Integrate with external systems
3. Build analytics dashboard
4. Generate automated reports
5. Set up webhooks for real-time updates

## Additional Resources

- Backend server runs on: `http://localhost:5000`
- Frontend application: `http://localhost:8080`
- API endpoint: `/api/v1/quiz/results`
- Default API key: `test-api-key-12345`
