# Paano Gumagana ang Quiz Results API

## Ano ang API na ito?

Ito ay isang **API endpoint** na nagbibigay ng quiz results (mga sagot at scores) ng mga users na nag-take ng quiz.

## Simple Explanation (Tagalog)

**Parang ganito:**
- May quiz ka na may ID na `38`
- May 5 users na nag-take ng quiz na yun
- Gusto mong makuha lahat ng results nila (sagot, scores, etc.)
- Gamit ang API na ito, makukuha mo lahat ng data na yun sa isang request lang!

## Paano Gamitin?

### 1. Kailangan mo ng API Key
- Parang password ito para sa API
- Nasa database na: `test-api-key-12345`
- Pwede kang gumawa ng bagong API key sa database

### 2. Kailangan mo ng Quiz ID
- Yung ID ng quiz form na gusto mong kunin ang results
- Halimbawa: `38` (Knowledge Quiz)

### 3. Send Request

**URL:**
```
http://localhost:5000/api/v1/quiz/results?quiz-id=38
```

**Header:**
```
api-key: test-api-key-12345
```

## Example Response

Kapag successful, makukuha mo:

```json
{
  "quiz_id": 38,
  "quiz_title": "Knowledge Quiz",
  "quiz_description": "Test your knowledge...",
  "total_submissions": 5,
  "results": [
    {
      "submission_id": 64,
      "submitted_by": "Anonymous",
      "submitted_at": "2026-01-16T13:59:08+00:00",
      "answers": {
        "130": ["g"],
        "131": ["Paris"],
        "132": ["Venus"]
      },
      "earned_points": 2,
      "total_points": 3,
      "score_percentage": 66.67,
      "quiz_results": {
        "question_results": {
          "131": {
            "is_correct": true,
            "user_answer": "Paris",
            "correct_answer": "Paris",
            "points": 1,
            "earned_points": 1
          }
        }
      }
    }
  ]
}
```

## Ano ang Makukuha Mo?

1. **Quiz Info**: Title, description, ID
2. **Total Submissions**: Ilan ang nag-take
3. **Results per User**:
   - Submission ID
   - Username (o "Anonymous")
   - Date/Time ng submission
   - Lahat ng sagot (answers)
   - Score (earned_points / total_points)
   - Percentage
   - Detailed results per question

## Paano i-Test?

### Option 1: Gamit ang test script
```bash
python test_api.py
```

### Option 2: Gamit ang Postman
1. Open Postman
2. GET request sa: `http://localhost:5000/api/v1/quiz/results?quiz-id=38`
3. Add header: `api-key: test-api-key-12345`
4. Send!

### Option 3: Gamit ang Browser Extension (REST Client)
- Same URL at headers

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

### 400 - Missing quiz-id
```json
{
  "error": "quiz-id is required as a query parameter"
}
```

### 404 - Quiz Not Found
```json
{
  "error": "Quiz not found or is not a quiz form"
}
```

## Use Cases

1. **External System Integration**
   - Pwede mong i-integrate sa ibang system
   - Automatic na makukuha ang quiz results

2. **Analytics Dashboard**
   - Pwede mong gamitin para sa analytics
   - I-display ang results sa dashboard

3. **Reporting**
   - Generate reports ng quiz results
   - Export to Excel/CSV

4. **Grading System**
   - Automatic grading
   - Score calculation

## Security

- ✅ API Key authentication (required)
- ✅ Only active API keys work
- ✅ Only quiz forms can be accessed
- ✅ Returns 401 if unauthorized

## Next Steps

1. Create more API keys sa database
2. Integrate sa external system
3. Build analytics dashboard
4. Generate reports

