# GleentForms

A comprehensive form and quiz builder application built with React, Python Flask, and MySQL. Create, share, and manage forms and quizzes with advanced features like email notifications, scoring, and real-time responses.

## 🚀 Features

- **Form Builder**: Intuitive drag-and-drop interface for creating forms and quizzes
- **Quiz Support**: Automatic scoring, correct answers, and detailed result analytics
- **User Authentication**: Secure login system with JWT tokens and role-based access (user/admin)
- **Form Sharing**: Generate shareable links for public form access
- **Response Management**: View, export, and analyze form submissions
- **Email Notifications**: Automated email alerts for new submissions and confirmations
- **Admin Dashboard**: Comprehensive admin panel for user and form management
- **Real-time Updates**: Live notifications for form responses
- **Themes & Customization**: Customizable colors, backgrounds, and header images
- **API Access**: RESTful API for integrating with external systems
- **Docker Support**: Easy deployment with Docker and Docker Compose

## 🏗️ Architecture

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **TailwindCSS** for styling
- **Radix UI** for accessible components
- **React Router** for SPA routing
- **React Query** for data fetching and caching

### Backend
- **Python Flask** REST API
- **MySQL** database with proper indexing
- **JWT** authentication
- **bcrypt** password hashing
- **CORS** enabled for cross-origin requests

### Infrastructure
- **Docker** containers for development and production
- **Docker Compose** for multi-service orchestration
- **Netlify** functions for serverless deployment options

## 📊 System Flow

### User Journey

1. **Authentication**
   - Users log in with username/password
   - JWT tokens stored in localStorage
   - Role-based access control (user/admin)

2. **Form Creation**
   - Create new forms or quizzes
   - Add sections and questions
   - Configure validation and requirements
   - Set themes and customization

3. **Form Management**
   - Edit existing forms
   - Preview forms before publishing
   - Generate shareable links
   - Enable/disable response collection

4. **Response Collection**
   - Public users access forms via share links
   - Submit responses with validation
   - Optional login requirements
   - Email confirmations sent automatically

5. **Data Analysis**
   - View submission statistics
   - Export responses to CSV
   - Quiz scoring and analytics
   - Real-time notification updates

### Admin Features

- User management (create, edit, delete users)
- Form oversight and moderation
- System-wide submission analytics
- API key management for integrations

## 🛠️ Tech Stack

### Frontend
- React 18 + TypeScript
- Vite
- TailwindCSS 3
- Radix UI
- React Router 6
- React Query
- Lucide React icons

### Backend
- Python 3.8+
- Flask
- MySQL Connector
- JWT
- bcrypt
- Flask-CORS

### Database
- MySQL 8.0+
- InnoDB engine
- UTF8MB4 charset

### DevOps
- Docker & Docker Compose
- Netlify (optional deployment)
- XAMPP (local development)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and pnpm
- Python 3.8+
- MySQL (via XAMPP or standalone)
- Docker (optional, for containerized setup)

### Local Development Setup

1. **Clone and navigate to the project**
   ```bash
   cd c:/xampp/htdocs/gleentforms-main
   ```

2. **Database Setup**
   ```bash
   # Start MySQL via XAMPP
   mysql -u root -p < database/schema.sql
   cd backend
   pip install -r requirements.txt
   python ../database/init_db.py
   ```

3. **Backend Setup**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your MySQL credentials
   python app.py
   ```

4. **Frontend Setup**
   ```bash
   pnpm install
   pnpm dev
   ```

5. **Access the application**
   - Frontend: http://localhost:8080
   - Backend API: http://localhost:5000
   - Login with admin/admin123 or user/user123

### Docker Setup

```bash
# Copy environment file
cp env.example .env

# Build and start services
make build
make up

# Or using docker-compose directly
docker-compose up -d
```

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/login` - User login
- `GET /api/auth/verify` - Token verification
- `POST /api/auth/logout` - User logout

### Form Management
- `GET /api/forms` - List user's forms
- `POST /api/forms` - Create new form
- `GET /api/forms/:id` - Get form details
- `PUT /api/forms/:id` - Update form
- `DELETE /api/forms/:id` - Delete form

### Submissions
- `GET /api/forms/:id/submissions` - Get form submissions
- `POST /api/forms/:id/submit` - Submit form response
- `GET /api/submissions/:id` - Get submission details

### Quiz Results API
- `GET /api/v1/quiz/results?quiz-id={ID}` - Get quiz results (requires API key)

### Admin Endpoints
- `GET /api/admin/users` - List all users
- `GET /api/admin/forms` - List all forms
- `GET /api/admin/submissions` - List all submissions

## 🔧 Configuration

### Environment Variables (.env)

```env
# Database
DB_HOST=localhost
DB_NAME=gleentforms
DB_USER=root
DB_PASSWORD=your_password
DB_PORT=3306

# Security
SECRET_KEY=your-secret-key-change-in-production

# Email (optional)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password
```

## 📁 Project Structure

```
gleentforms-main/
├── client/                 # React frontend
│   ├── components/         # Reusable UI components
│   ├── pages/             # Route components
│   ├── contexts/          # React contexts
│   └── lib/               # Utilities
├── backend/               # Python Flask backend
│   ├── app.py             # Main application
│   ├── email_utils.py     # Email functionality
│   └── requirements.txt   # Python dependencies
├── server/                # Node.js server (Vite integration)
├── database/              # Database schemas and scripts
├── shared/                # Shared types/interfaces
├── netlify/               # Serverless functions
└── public/                # Static assets
```

## 🚢 Deployment

### Docker Production
```bash
docker-compose -f docker-compose.yml up -d
```

### Netlify Deployment
- Connect repository to Netlify
- Set build command: `pnpm build`
- Set publish directory: `dist`
- Configure environment variables

### Manual Deployment
```bash
# Build frontend
pnpm build

# Start production server
pnpm start
```

## 🔐 Security Features

- JWT token-based authentication
- Password hashing with bcrypt
- CORS protection
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- Rate limiting (configurable)

## 📊 Database Schema

### Core Tables
- **users**: User accounts and authentication
- **forms**: Form metadata and settings
- **form_questions**: Question definitions
- **form_submissions**: Submission records
- **form_submission_answers**: Individual answers
- **notifications**: Real-time notifications

### Key Relationships
- Forms belong to users
- Questions belong to forms
- Submissions belong to forms and users
- Answers belong to submissions and questions

## 🧪 Testing

```bash
# Run frontend tests
pnpm test

# Type checking
pnpm typecheck

# Backend testing (manual via API endpoints)
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Troubleshooting

- Check SETUP.md for detailed setup instructions
- See TROUBLESHOOTING.md for common issues
- Review README_DOCKER.md for Docker-specific problems
- Check API_EXPLANATION.md for API usage examples

## 📞 Support

For support and questions:
- Check existing documentation files
- Review GitHub issues
- Create a new issue for bugs or feature requests</content>
<parameter name="filePath">c:\xampp\htdocs\gleentforms-main\README.md