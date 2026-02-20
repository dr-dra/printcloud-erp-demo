class MailserverRouter:
    """
    A router to control all database operations on models for the
    mailadmin application to use the mailserver database.
    """
    
    def db_for_read(self, model, **hints):
        """Suggest the database to read from for mailadmin models."""
        if model._meta.app_label == 'mailadmin':
            return 'mailserver'
        return None

    def db_for_write(self, model, **hints):
        """Suggest the database to write to for mailadmin models."""
        if model._meta.app_label == 'mailadmin':
            return 'mailserver'
        return None
    
    def allow_relation(self, obj1, obj2, **hints):
        """Allow relations if models are in the same app."""
        db_set = {'default', 'mailserver'}
        if obj1._meta.app_label == 'mailadmin' or obj2._meta.app_label == 'mailadmin':
            return obj1._state.db in db_set and obj2._state.db in db_set
        return None
    
    def allow_migrate(self, db, app_label, model_name=None, **hints):
        """Ensure that mailadmin models get created on the mailserver database."""
        if app_label == 'mailadmin':
            return db == 'mailserver'
        elif db == 'mailserver':
            return False
        return None 