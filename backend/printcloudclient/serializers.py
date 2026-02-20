from rest_framework import serializers
from .models import PrintCloudClient, Printer, PrintJob

class PrinterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Printer
        fields = ['name', 'driver', 'printer_type', 'status', 'capabilities', 'last_status_update']

class PrintCloudClientSerializer(serializers.ModelSerializer):
    printers = PrinterSerializer(many=True, read_only=True)
    
    class Meta:
        model = PrintCloudClient
        fields = ['id', 'name', 'ip_address', 'status', 'version', 'last_heartbeat', 'printers']
        read_only_fields = ['id']

class PrintCloudClientRegistrationSerializer(serializers.ModelSerializer):
    printers = PrinterSerializer(many=True, write_only=True)
    
    class Meta:
        model = PrintCloudClient
        fields = ['name', 'ip_address', 'version', 'printers']
    
    def create(self, validated_data):
        printers_data = validated_data.pop('printers', [])
        client = PrintCloudClient.objects.create(**validated_data)
        
        # Import here to avoid circular imports
        from .views import map_printer_fields
        
        for printer_data in printers_data:
            # Map C# client fields to Django model fields
            mapped_data = map_printer_fields(printer_data)
            Printer.objects.create(client=client, **mapped_data)
            
        return client

class PrintJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrintJob
        fields = [
            'id', 'target_printer_name', 'fallback_printer_names', 
            'document_type', 'print_data', 'copies', 'status',
            'user', 'created_at'
        ]
        read_only_fields = ['id', 'user', 'created_at']

class PrintJobCompletionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrintJob
        fields = ['status', 'error_message', 'used_printer_name']
    
    def validate_status(self, value):
        if value not in ['completed', 'failed']:
            raise serializers.ValidationError("Status must be 'completed' or 'failed'")
        return value

class PrinterStatusUpdateSerializer(serializers.Serializer):
    printers = PrinterSerializer(many=True)
    
    def validate_printers(self, value):
        if not value:
            raise serializers.ValidationError("At least one printer must be provided")
        return value