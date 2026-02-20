from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounting', '0007_ar_payment_accounting'),
    ]

    operations = [
        migrations.CreateModel(
            name='JournalFailure',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('source_type', models.CharField(db_index=True, max_length=50)),
                ('source_id', models.IntegerField(blank=True, db_index=True, null=True)),
                ('event_type', models.CharField(db_index=True, max_length=100)),
                ('last_error', models.TextField(blank=True, null=True)),
                ('attempts', models.PositiveIntegerField(default=0)),
                ('last_attempt_at', models.DateTimeField(blank=True, null=True)),
                ('resolved_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'Journal Failure',
                'verbose_name_plural': 'Journal Failures',
                'indexes': [
                    models.Index(fields=['source_type', 'source_id', 'event_type'], name='accounting__source__c9f5ef_idx'),
                    models.Index(fields=['last_attempt_at'], name='accounting__last_at_6e4d50_idx'),
                ],
            },
        ),
        migrations.AddConstraint(
            model_name='journalfailure',
            constraint=models.UniqueConstraint(fields=('source_type', 'source_id', 'event_type'), name='unique_journal_failure'),
        ),
    ]
