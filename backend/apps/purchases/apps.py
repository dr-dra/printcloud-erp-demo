from django.apps import AppConfig


class PurchasesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.purchases'
    verbose_name = 'Purchases'

    def ready(self):
        from . import signals  # noqa: F401
