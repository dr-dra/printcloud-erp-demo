from django.core.exceptions import ValidationError


def get_account_code(key):
    from apps.accounting.models import AccountingAccountMapping

    mapping = AccountingAccountMapping.objects.select_related('account').filter(
        key=key,
        is_active=True,
    ).first()

    if not mapping:
        raise ValidationError(f"Missing account mapping for '{key}'")

    return mapping.account.account_code
