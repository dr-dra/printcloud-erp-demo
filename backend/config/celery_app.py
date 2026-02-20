import os
from celery import Celery
from django.conf import settings

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Create the Celery application
app = Celery('printcloud')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
# - namespace='CELERY' means all celery-related configuration keys
#   should have a `CELERY_` prefix.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()

# Manually import tasks to ensure they're registered
@app.on_after_configure.connect
def setup_periodic_tasks(sender, **kwargs):
    """Setup any tasks that need to be imported"""
    try:
        # Import specific task modules
        import apps.reminders.tasks
        import apps.sales.quotations.tasks
        import apps.sales.invoices.tasks
        import apps.sales.orders.tasks
    except ImportError as e:
        print(f"Warning: Could not import task modules: {e}")


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')


# Configure periodic tasks
app.conf.beat_schedule = {
    'process-due-reminders': {
        'task': 'apps.reminders.tasks.process_due_reminders',
        'schedule': 1800.0,  # Every 30 minutes (1800 seconds)
        'options': {'expires': 3600}  # Task expires after 1 hour
    },
}
