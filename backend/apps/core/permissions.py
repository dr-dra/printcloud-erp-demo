"""
Custom permission classes for role-based access control.
"""

from rest_framework.permissions import BasePermission


class IsDesigner(BasePermission):
    """
    Allow only users with 'designer' or 'admin' role.
    Used for POS order creation and editing.
    """

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ['designer', 'admin']


class IsAccounting(BasePermission):
    """
    Allow only users with 'accounting', 'cashier', or 'admin' role.
    Used for payment acceptance and transaction completion.
    """

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ['accounting', 'cashier', 'admin']


class IsAccountingOrAdmin(BasePermission):
    """
    Allow only users with 'accounting' or 'admin' role.
    Used for cash deposits and accounting-only actions.
    """

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ['accounting', 'admin']


class IsPOSStaff(BasePermission):
    """
    Allow users with 'designer', 'accounting', 'cashier', or 'admin' role.
    Used for POS order creation from both designer and accounting interfaces.
    """

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ['designer', 'accounting', 'cashier', 'admin']


class IsOrderOwner(BasePermission):
    """
    Allow only if user created the order or is an admin.
    Used for editing and voiding orders.
    """

    def has_object_permission(self, request, view, obj):
        # Admins can access all objects
        if request.user.role == 'admin':
            return True

        # Check if user is the owner (created_by)
        return obj.created_by == request.user
