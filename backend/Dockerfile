# ============================================================================
# PRINTCLOUD BACKEND DOCKERFILE
# ============================================================================
# This file defines how to build a Docker container for the Django backend.
# It uses a multi-stage build to create both development and production images.
#
# What is a Docker image?
# - Think of it as a blueprint/template for creating containers
# - Contains all the code, dependencies, and configuration needed to run the app
#
# What is a multi-stage build?
# - Different "stages" for different purposes (dev vs production)
# - Keeps images smaller and more secure
# ============================================================================

# ============================================================================
# STAGE 1: BASE IMAGE
# ============================================================================
# This stage contains common setup used by both dev and production
# We use Python 3.11 slim variant (smaller size than full Python image)
FROM python:3.11-slim as base

# Set environment variables
# PYTHONUNBUFFERED=1: Makes Python print output immediately (important for logs)
# PYTHONDONTWRITEBYTECODE=1: Prevents Python from writing .pyc files (not needed in containers)
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies required by Python packages
# WeasyPrint needs: libcairo2, libpango-1.0-0, libpangocairo-1.0-0, libgdk-pixbuf2.0-0
# PostgreSQL needs: libpq-dev
# MySQL needs: default-libmysqlclient-dev
# gcc and build-essential: Required to compile some Python packages
# ghostscript: For PDF to PCL/PostScript conversion
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    build-essential \
    libpq-dev \
    default-libmysqlclient-dev \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 \
    libffi-dev \
    shared-mime-info \
    ghostscript \
    && rm -rf /var/lib/apt/lists/*

# Create a directory for the application
# /app is a common convention for application code in containers
WORKDIR /app

# ============================================================================
# STAGE 2: DEVELOPMENT IMAGE
# ============================================================================
# This stage is optimized for development with hot-reload capabilities
FROM base as development

# Copy requirements file first (Docker caching optimization)
# If requirements.txt doesn't change, Docker can reuse this layer
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Create directories for media, static files, and logs
# These will be mounted as volumes in docker-compose for persistence
RUN mkdir -p /app/media /app/staticfiles /app/logs

# The source code will be mounted as a volume in docker-compose.yml
# This allows hot-reload: changes to code on your laptop appear instantly in the container

# Expose port 8000 (Django development server default port)
# This doesn't actually publish the port, just documents it
EXPOSE 8000

# Default command for development
# 0.0.0.0 allows connections from outside the container (needed for Docker)
# The actual command may be overridden in docker-compose.yml
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

# ============================================================================
# STAGE 3: PRODUCTION IMAGE
# ============================================================================
# This stage is optimized for production deployment
FROM base as production

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire application code
# Unlike development, we copy code into the image (no volume mount)
COPY . .

# Create necessary directories
RUN mkdir -p /app/media /app/staticfiles /app/logs

# Collect static files (CSS, JavaScript, images)
# Django needs this for serving static content in production
# We set DEBUG=False temporarily to simulate production environment
RUN python manage.py collectstatic --noinput || true

# Create a non-root user for security
# Running as root in containers is a security risk
RUN useradd -m -u 1000 django && \
    chown -R django:django /app

# Switch to non-root user
USER django

# Expose port 8000
EXPOSE 8000

# Use Gunicorn for production (production-grade WSGI server)
# --workers 4: Run 4 worker processes (adjust based on CPU cores)
# --bind 0.0.0.0:8000: Listen on all interfaces
# --timeout 120: Request timeout (important for long-running requests)
# config.wsgi:application: Path to Django WSGI application
CMD ["gunicorn", "--workers", "4", "--bind", "0.0.0.0:8000", "--timeout", "120", "config.wsgi:application"]
