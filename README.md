# PrintCloud ERP (Portfolio Demo)

Full-stack ERP platform for commercial printing workflows, including sales, purchasing, inventory, POS, and accounting.

## Live Demo
- https://demo.printcloud.io
- Demo credentials available on request

## What This Project Demonstrates
- End-to-end business workflow design (quotation -> order -> invoice -> payment)
- Full-stack product engineering with modern frontend and backend architecture
- Real-time and async processing patterns (WebSockets + Celery workers)
- Cloud-integrated features (S3 storage, Bedrock-based document extraction, SES/communications)
- Production-style deployment and operations mindset

## Core Features
- Sales: quotations, orders, invoices, receipts
- Purchasing: suppliers, purchase orders, supplier bills
- Accounting: chart of accounts, journals, fiscal periods, reports
- POS: live order/cashier flows
- Document workflows: AI-assisted bill data extraction
- Communications: email and WhatsApp integration points

## Tech Stack
- Frontend: Next.js 16, React, TypeScript, Tailwind CSS
- Backend: Django, Django REST Framework
- Data: PostgreSQL
- Async/Queue: Redis, Celery, Celery Beat
- Realtime: WebSockets (ASGI/Daphne)
- Infra: Nginx, Docker Compose
- Cloud integrations: AWS S3, Bedrock, SES

## Local Development (Quick Start)

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
daphne -b 0.0.0.0 -p 8000 config.asgi:application

### Workers

cd backend
source .venv/bin/activate
celery -A config worker --loglevel=info
celery -A config beat --loglevel=info --scheduler django_celery_beat.schedulers:DatabaseScheduler

### Frontend

cd frontend
npm install
npm run dev

## Configuration

- Backend env: backend/.env
- Frontend env: frontend/.env.local
- Secrets are never committed; use placeholder values in .env.example.

## Portfolio Scope

This repository is a portfolio/demo version of PrintCloud. Production secrets, credentials, and sensitive customer data
are excluded.

## Contact

- Email: dharshanae@yahoo.com
