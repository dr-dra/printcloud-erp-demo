# Tech Stack - PrintCloud

## Frontend
*   **Next.js (App Router):** Core React framework for the user interface.
*   **TypeScript:** Ensuring type safety and better developer experience.
*   **Tailwind CSS & Flowbite:** For utility-first styling and a professional component library.
*   **Axios:** For handling API communication with the backend.
*   **React Hook Form:** For robust and performant form management.

## Backend
*   **Django:** High-level Python web framework.
*   **Django REST Framework (DRF):** For building the RESTful API.
*   **Python:** Core programming language.
*   **Djoser & Simple JWT:** For secure, token-based authentication.

## Data & Persistence
*   **PostgreSQL:** Primary relational database for all application data.
*   **MySQL:** Legacy database for accessing existing data.
*   **Redis:** Used as a message broker for Celery and for caching.
*   **Amazon S3:** For secure storage of customer documents and files.

## Infrastructure & Background Tasks
*   **Celery:** Distributed task queue for handling background processes like email sending and print job creation.
*   **Docker & Docker Compose:** For containerization and consistent development/deployment environments.
*   **Nginx:** Acting as a reverse proxy and web server.
