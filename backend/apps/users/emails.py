# apps/users/emails.py

from djoser import email
from django.template.loader import render_to_string
from django.core.mail import EmailMultiAlternatives
from django.conf import settings
from django.utils.html import strip_tags
import datetime


# apps/users/emails.py

class CustomPasswordResetEmail(email.PasswordResetEmail):
    template_name = 'email/password_reset.html'

    def get_context_data(self):
        context = super().get_context_data()

        # ✅ Use the Djoser domain setting instead of hardcoded value
        context['domain'] = settings.DJOSER.get('DOMAIN', 'localhost:3000')
        context['site_name'] = settings.DJOSER.get('SITE_NAME', 'PrintCloud.io')
        context['year'] = datetime.datetime.now().year
        return context

    def get_body(self):
        context = self.get_context_data()
        return render_to_string(self.template_name, context)

    def send(self, to, *args, **kwargs):
        context = self.get_context_data()
        subject = self.subject or f"Reset your password on {context['site_name']}"
        from_email = settings.DEFAULT_FROM_EMAIL
        body_html = self.get_body()

        recipient_list = [to] if isinstance(to, str) else to

        msg = EmailMultiAlternatives(
            subject=subject,
            body=strip_tags(body_html),
            from_email=from_email,
            to=recipient_list
        )
        msg.attach_alternative(body_html, "text/html")
        msg.send()
