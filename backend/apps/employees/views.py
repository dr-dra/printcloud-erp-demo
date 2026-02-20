from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Employee
from .serializers import EmployeeSerializer

class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['full_name', 'user__username', 'user__email', 'department', 'designation']
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def me(self, request):
        """Get current user's employee information"""
        try:
            employee = Employee.objects.get(user=request.user)
            serializer = self.get_serializer(employee)
            return Response(serializer.data)
        except Employee.DoesNotExist:
            return Response(
                {'error': 'Employee record not found for current user'}, 
                status=status.HTTP_404_NOT_FOUND
            )