from passlib.hash import sha512_crypt
import re
from django.core.exceptions import ValidationError


def hash_password(password: str) -> str:
    """Hash a password using SHA512-CRYPT."""
    return sha512_crypt.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its hash."""
    return sha512_crypt.verify(password, hashed)


def is_password_hashed(password: str) -> bool:
    """Check if a password is already hashed (SHA512-CRYPT format)."""
    return password.startswith('$6$') and len(password) > 20


def validate_email_format(email: str) -> None:
    """Validate email format for mail server compatibility."""
    if not email or '@' not in email:
        raise ValidationError("Invalid email format")
    
    local_part, domain = email.split('@', 1)
    
    # Validate local part
    if not local_part or len(local_part) > 64:
        raise ValidationError("Email local part must be 1-64 characters")
    
    if not re.match(r'^[a-zA-Z0-9._-]+$', local_part):
        raise ValidationError("Email local part contains invalid characters")
    
    # Validate domain part
    if not domain or len(domain) > 253:
        raise ValidationError("Email domain must be 1-253 characters")
    
    if not re.match(r'^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', domain):
        raise ValidationError("Invalid domain format")


def validate_domain_name(domain: str) -> None:
    """Validate domain name format."""
    if not domain:
        raise ValidationError("Domain name is required")
    
    if len(domain) > 253:
        raise ValidationError("Domain name too long (max 253 characters)")
    
    if not re.match(r'^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', domain):
        raise ValidationError("Invalid domain name format")
    
    if domain.startswith('.') or domain.endswith('.'):
        raise ValidationError("Domain cannot start or end with a dot")


def format_quota(quota_bytes: int) -> str:
    """Format quota in bytes to human-readable format."""
    if quota_bytes == 0:
        return "Unlimited"
    elif quota_bytes < 1024:
        return f"{quota_bytes} B"
    elif quota_bytes < 1024 * 1024:
        return f"{quota_bytes / 1024:.1f} KB"
    elif quota_bytes < 1024 * 1024 * 1024:
        return f"{quota_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{quota_bytes / (1024 * 1024 * 1024):.1f} GB" 