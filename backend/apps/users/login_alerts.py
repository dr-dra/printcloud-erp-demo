import logging

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


def _client_ip(request) -> str:
    if request is None:
        return 'Unknown'
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', 'Unknown')


def send_login_alert(user, request, login_method: str = 'password') -> None:
    """
    Appends successful login details to backend/logindetails.txt.
    """
    try:
        ip = _client_ip(request)
        user_agent = request.META.get('HTTP_USER_AGENT', 'Unknown') if request else 'Unknown'
        user_agent = (user_agent or 'Unknown').replace('\n', ' ').replace('\r', ' ')
        timestamp = timezone.localtime(timezone.now()).strftime('%Y-%m-%d %H:%M:%S %Z')
        host = request.get_host() if request else 'Unknown'
        role = str(getattr(user, 'role', 'unknown'))
        email = str(getattr(user, 'email', 'unknown'))

        log_line = (
            f"{timestamp} | email={email} | role={role} | method={login_method} | "
            f"ip={ip} | host={host} | ua={user_agent}\n"
        )
        log_path = settings.BASE_DIR / 'logindetails.txt'

        with open(log_path, 'a', encoding='utf-8') as f:
            f.write(log_line)
    except Exception:
        logger.exception('Failed to append login details')
