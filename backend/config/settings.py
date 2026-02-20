import os
from pathlib import Path
from datetime import timedelta
from decimal import Decimal
from decouple import config
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config('SECRET_KEY')

DEBUG = config('DEBUG', default=True, cast=bool)

ALLOWED_HOSTS_RAW = config('ALLOWED_HOSTS', default='*')
ALLOWED_HOSTS = ALLOWED_HOSTS_RAW.split(
    ',') if isinstance(ALLOWED_HOSTS_RAW, str) else ['*']

# Database
DATABASES = {
    'default': dj_database_url.parse(str(config('DATABASE_URL'))),
    'mailserver': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('MAILSERVER_DB_NAME'),
        'USER': config('MAILSERVER_DB_USER'),
        'PASSWORD': config('MAILSERVER_DB_PASSWORD'),
        'HOST': config('MAILSERVER_DB_HOST', default='localhost'),
        'PORT': config('MAILSERVER_DB_PORT', default='5432'),
    },
}

# Optional MySQL database for legacy data (only add if MySQL is available)
ENABLE_MYSQL_LEGACY = config('ENABLE_MYSQL_LEGACY', default=False, cast=bool)
if ENABLE_MYSQL_LEGACY:
    try:
        import pymysql
        pymysql.install_as_MySQLdb()
        DATABASES['mysql'] = {
            'ENGINE': 'django.db.backends.mysql',
            'NAME': config('MYSQL_DB_NAME'),
            'USER': config('MYSQL_DB_USER'),
            'PASSWORD': config('MYSQL_DB_PASSWORD'),
            'HOST': config('MYSQL_DB_HOST', default='localhost'),
            'PORT': config('MYSQL_DB_PORT', default='3306'),
            'OPTIONS': {
                'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
            },
        }
        print("📊 MySQL legacy database enabled")
    except ImportError:
        print("⚠️  MySQL legacy database disabled - PyMySQL not available")
else:
    print("📊 MySQL legacy database disabled - set ENABLE_MYSQL_LEGACY=True to enable")

# Custom User Model
AUTH_USER_MODEL = 'users.User'

# Email Settings - Updated with defaults for development
EMAIL_BACKEND = config(
    'EMAIL_BACKEND', default='django.core.mail.backends.console.EmailBackend')
EMAIL_HOST = config('EMAIL_HOST', default='localhost')
EMAIL_PORT = config('EMAIL_PORT', default=25, cast=int)
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=False, cast=bool)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = config(
    'DEFAULT_FROM_EMAIL', default='noreply@printcloud.io')
BUG_REPORT_EMAIL = config('BUG_REPORT_EMAIL', default='dharshana@printsrilanka.com')
JOURNAL_FAILURE_ALERT_EMAILS_RAW = config('JOURNAL_FAILURE_ALERT_EMAILS', default='')
JOURNAL_FAILURE_ALERT_EMAILS = [
    email.strip() for email in JOURNAL_FAILURE_ALERT_EMAILS_RAW.split(',')
    if email.strip()
]

# WhatsApp Integration Settings
WHATSAPP_CONFIG = {
    'ACCESS_TOKEN': config('WHATSAPP_ACCESS_TOKEN', default=''),
    'PHONE_NUMBER_ID': config('WHATSAPP_PHONE_NUMBER_ID', default=''),
    'API_VERSION': config('WHATSAPP_API_VERSION', default='v23.0')
}

# Accounting Module Configuration
ACCOUNTING_GO_LIVE_DATE = config('ACCOUNTING_GO_LIVE_DATE', default='2026-02-08')
# Payments dated before this will NOT create journal entries
# This prevents accidental backdating and ensures clean cutover
VAT_RATE = Decimal(config('VAT_RATE', default='0.18'))
VAT_GO_LIVE_DATE = config('VAT_GO_LIVE_DATE', default='2026-02-08')

# Installed Apps
INSTALLED_APPS = [
    # Django default apps
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django_filters',
    # Third-party apps
    'rest_framework',
    'rest_framework_simplejwt.token_blacklist',
    'djoser',
    'corsheaders',
    'storages',
    'channels',

    # Your apps
    'apps.core',  # Core shared models
    'apps.users',
    'apps.employees',
    'apps.costing',  # Reverted back to original location
    'apps.customers',  # Reverted back to original location
    'apps.sales',  # Sales module with shared models
    'apps.sales.quotations',  # Quotations module
    'apps.sales.orders',  # Sales orders module
    'apps.sales.invoices',  # Invoices module
    'apps.reminders',  # Reminders system
    'apps.mailadmin',
    'printcloudclient',  # PrintCloudClient management
    'apps.inventory',  # Inventory management
    'apps.pos',  # Point of Sale

    # Accounting & Finance
    'apps.accounting',  # Accounting module
    'apps.suppliers',  # Supplier management
    'apps.purchases.apps.PurchasesConfig',  # Purchase orders & bills

    # Celery apps
    'django_celery_beat',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # CORS should be at the top!
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# ✅ CORS Config (Dev/Prod ready)
# ✅ CORS Config (Dev/Prod ready)
CORS_ALLOW_ALL_ORIGINS = config(
    "CORS_ALLOW_ALL_ORIGINS", default=True, cast=bool)

# ✅ Safely parse comma-separated origins into a list
CORS_ALLOWED_ORIGINS_RAW = config("CORS_ALLOWED_ORIGINS", default="")
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in CORS_ALLOWED_ORIGINS_RAW.split(
    ",") if origin.strip()] if isinstance(CORS_ALLOWED_ORIGINS_RAW, str) else []

CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
]

CORS_ALLOW_METHODS = [
    "DELETE",
    "GET",
    "OPTIONS",
    "PATCH",
    "POST",
    "PUT",
]

# Allow credentials for authenticated requests
CORS_ALLOW_CREDENTIALS = True

# Allow specific headers for authentication
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^http://localhost:\d+$",
    r"^http://127\.0\.0\.1:\d+$",
]


ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Channels Configuration
ASGI_APPLICATION = 'config.asgi.application'

# Redis Configuration (used by Channels, Celery, and Cache)
REDIS_HOST = config('REDIS_HOST', default='127.0.0.1')
REDIS_PORT = config('REDIS_PORT', default=6379, cast=int)
REDIS_DB = config('REDIS_DB', default=0, cast=int)

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [(REDIS_HOST, REDIS_PORT)],
        },
    },
}


# Static files
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
CSRF_TRUSTED_ORIGINS = [
    'https://demo.printcloud.io',  # in production change to printcloud.io
    'http://localhost:3000',
    'http://127.0.0.1:3000',
]

# Frontend URL for generating share links
FRONTEND_URL = config('FRONTEND_URL', default='http://localhost:3000')

# REST Framework settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': [
        #  'rest_framework.permissions.IsAuthenticated',
        'rest_framework.permissions.AllowAny',  # Dev only
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
}

# Simple JWT Settings - Enhanced Security
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=4),  # 4 hours for office use
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),  # 30 days for office use
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,

    # Security enhancements
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'VERIFYING_KEY': None,
    'AUDIENCE': None,
    'ISSUER': None,
    'JWK_URL': None,
    'LEEWAY': 0,

    # Header configuration
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',

    # User identification
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'USER_AUTHENTICATION_RULE': 'rest_framework_simplejwt.authentication.default_user_authentication_rule',

    # Token classes
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'TOKEN_TYPE_CLAIM': 'token_type',
    'JTI_CLAIM': 'jti',

    # Sliding token settings
    'SLIDING_TOKEN_REFRESH_EXP_CLAIM': 'refresh_exp',
    'SLIDING_TOKEN_LIFETIME': timedelta(minutes=60),
    'SLIDING_TOKEN_REFRESH_LIFETIME': timedelta(days=1),
}

# Security middleware enhancements
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Session security (for admin interface)
SESSION_COOKIE_SECURE = False  # Set to True in production with HTTPS
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SECURE = False  # Set to True in production with HTTPS
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = 'Lax'

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {
            'min_length': 6,
        }
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Rate limiting (if using django-ratelimit)
# RATELIMIT_ENABLE = True
# RATELIMIT_USE_CACHE = 'default'

# Logging configuration for security events
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'logs' / 'django.log',
            'formatter': 'verbose',
        },
        'console': {
            'level': 'DEBUG',
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['file', 'console'],
            'level': 'INFO',
            'propagate': True,
        },
        'django.security': {
            'handlers': ['file', 'console'],
            'level': 'WARNING',
            'propagate': True,
        },
        'rest_framework_simplejwt': {
            'handlers': ['file', 'console'],
            'level': 'INFO',
            'propagate': True,
        },
    },
}

# Create logs directory if it doesn't exist
os.makedirs(BASE_DIR / 'logs', exist_ok=True)

DJOSER = {
    'LOGIN_FIELD': 'email',
    'USER_CREATE_PASSWORD_RETYPE': True,
    'SEND_ACTIVATION_EMAIL': True,
    'ACTIVATION_URL': 'activate/{uid}/{token}',
    'PASSWORD_RESET_CONFIRM_URL': 'reset-password/{uid}/{token}',

    # ✅ Updated for Next.js frontend
    'DOMAIN': 'localhost:3000',       # <--- Next.js dev server port
    'SITE_NAME': 'PrintCloud.io',     # <--- App name (for email text)

    'EMAIL': {
        'password_reset': 'apps.users.emails.CustomPasswordResetEmail',
    },
    'SERIALIZERS': {
        'user': 'apps.users.serializers.UserSerializer',
        'current_user': 'apps.users.serializers.UserSerializer',
    },
}


DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# File Upload Settings for Large Files
# 10MB - files larger than this go to disk
FILE_UPLOAD_MAX_MEMORY_SIZE = 10485760
DATA_UPLOAD_MAX_MEMORY_SIZE = 104857600  # 100MB - maximum request size
FILE_UPLOAD_PERMISSIONS = 0o644  # File permissions when saved to disk

DATABASE_ROUTERS = ['config.database_router.MailserverRouter']

# AWS S3 Configuration
AWS_ACCESS_KEY_ID = config("AWS_ACCESS_KEY_ID", default="")
AWS_SECRET_ACCESS_KEY = config("AWS_SECRET_ACCESS_KEY", default="")
AWS_STORAGE_BUCKET_NAME = config("AWS_STORAGE_BUCKET_NAME", default="")
AWS_S3_REGION_NAME = config("AWS_S3_REGION_NAME", default="us-east-1")
AWS_S3_FILE_OVERWRITE = config(
    "AWS_S3_FILE_OVERWRITE", default=False, cast=bool)
AWS_DEFAULT_ACL = None
AWS_S3_ADDRESSING_STYLE = config("AWS_S3_ADDRESSING_STYLE", default="virtual")

if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY and AWS_STORAGE_BUCKET_NAME:
    # Use S3 storage (for larger deployments)
    STORAGES = {
        'default': {
            'BACKEND': 'storages.backends.s3boto3.S3Boto3Storage',
        },
        'staticfiles': {
            'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage',
        },
    }

    # Additional S3 settings for django-storages
    AWS_S3_CUSTOM_DOMAIN = None
    AWS_S3_OBJECT_PARAMETERS = {
        'CacheControl': 'max-age=86400',
        'StorageClass': 'STANDARD_IA',  # Use Infrequent Access storage
    }
    AWS_LOCATION = ''
    AWS_QUERYSTRING_AUTH = True
    AWS_S3_FILE_OVERWRITE = False
    AWS_S3_SIGNATURE_VERSION = 's3v4'

    print("✅ Using S3 storage for file uploads")
else:
    # Fallback to local file storage
    STORAGES = {
        'default': {
            'BACKEND': 'django.core.files.storage.FileSystemStorage',
        },
        'staticfiles': {
            'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage',
        },
    }
    MEDIA_URL = '/media/'
    MEDIA_ROOT = BASE_DIR / 'media'
    print("⚠️  Using local file storage - S3 credentials not configured")

# Local media settings for profile pictures (always local regardless of S3)
PROFILE_PICTURES_ROOT = BASE_DIR / 'media' / 'profile_pictures'
os.makedirs(PROFILE_PICTURES_ROOT, exist_ok=True)

# =============================================================================
# AWS TEXTRACT & BEDROCK CONFIGURATION (for AI Bill Scanning)
# =============================================================================

# Separate AWS credentials for AI (Bedrock/Textract)
AWS_AI_ACCESS_KEY_ID = config("AWS_AI_ACCESS_KEY_ID", default="")
AWS_AI_SECRET_ACCESS_KEY = config("AWS_AI_SECRET_ACCESS_KEY", default="")
AWS_AI_REGION = config("AWS_AI_REGION", default="us-east-1")

# AWS Textract - DISABLED (migrated to Nova 2 Lite)
AWS_TEXTRACT_ENABLED = config("AWS_TEXTRACT_ENABLED", default=False, cast=bool)
AWS_TEXTRACT_REGION = config("AWS_TEXTRACT_REGION", default=AWS_AI_REGION)

# AWS Bedrock for Nova 2 Lite (multimodal: vision + extraction)
AWS_BEDROCK_ENABLED = config("AWS_BEDROCK_ENABLED", default=True, cast=bool)
AWS_BEDROCK_REGION = config("AWS_BEDROCK_REGION", default=AWS_AI_REGION)
AWS_BEDROCK_MODEL_ID = config(
    "AWS_BEDROCK_MODEL_ID",
    default="us.amazon.nova-2-lite-v1:0"  # US cross-region inference profile for stability
)
BILL_SCAN_DEMO_MODE = config("BILL_SCAN_DEMO_MODE", default=False, cast=bool)

# Bill Scan Configuration
BILL_SCAN_MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
BILL_SCAN_ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
BILL_SCAN_CONFIDENCE_THRESHOLD = 0.70  # 70% threshold for warnings

# =============================================================================
# PrintCloudClient heartbeat window (seconds)
PRINTCLOUDCLIENT_HEARTBEAT_TIMEOUT_SECONDS = config(
    'PRINTCLOUDCLIENT_HEARTBEAT_TIMEOUT_SECONDS', default=120, cast=int
)

# CELERY CONFIGURATION
# =============================================================================

# Internationalization
# https://docs.djangoproject.com/en/5.2/topics/i18n/
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Colombo'  # Sri Lanka timezone
USE_I18N = True
USE_TZ = True

# Celery Configuration Options
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 minutes
CELERY_TASK_SOFT_TIME_LIMIT = 25 * 60  # 25 minutes

# Celery uses the Redis configuration defined above
CELERY_BROKER_URL = f'redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}'
CELERY_RESULT_BACKEND = f'redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}'

# Celery Beat Configuration
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'

# Task serialization
CELERY_ACCEPT_CONTENT = ['application/json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'

# Worker settings
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_TASK_ACKS_LATE = True
CELERY_WORKER_DISABLE_RATE_LIMITS = False

# Redis as Django Cache Backend
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': f'redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}',
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        },
        'TIMEOUT': 300  # 5 minutes default timeout
    }
}
