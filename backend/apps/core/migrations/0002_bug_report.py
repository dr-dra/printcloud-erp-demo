from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='BugReport',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('page_url', models.TextField(help_text='URL of the page where the issue occurred')),
                ('description', models.TextField(help_text='User description of the issue')),
                ('screenshot', models.FileField(blank=True, help_text='Optional screenshot attachment', null=True, upload_to='bug_reports/')),
                ('user_agent', models.TextField(blank=True, help_text='Browser user agent', null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='bug_reports', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Bug Report',
                'verbose_name_plural': 'Bug Reports',
                'db_table': 'core_bug_report',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='bugreport',
            index=models.Index(fields=['created_at'], name='bug_report_created_at_idx'),
        ),
    ]
