from django.urls import path
from .views import (
    CostingListView, 
    CostingExportAllView, 
    CostingActivityView,
    CostingSheetCreateView,
    CostingSheetDetailView
)

urlpatterns = [
    path('', CostingListView.as_view(), name='costing-list'),
    path('export-all/', CostingExportAllView.as_view(), name='costing-export-all'),
    path('costing-activity/', CostingActivityView.as_view(), name='costing-activity'),
    path('costing-sheets/', CostingSheetCreateView.as_view(), name='costing-sheet-create'),
    path('costing-sheets/<int:pk>/', CostingSheetDetailView.as_view(), name='costing-sheet-detail'),
]
