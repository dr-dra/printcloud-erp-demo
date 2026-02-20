import io
import os
import re
import urllib.error
import urllib.parse
import urllib.request
import uuid

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from django.conf import settings
from django.contrib.staticfiles import finders
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.http import FileResponse, Http404, HttpResponse
from django.shortcuts import redirect
from PIL import Image, ImageDraw
from rest_framework import generics, parsers, status
from rest_framework.decorators import (
    api_view,
    parser_classes,
    permission_classes,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import User
from .serializers import (
    UserProfileSerializer,
    UserProfileUpdateSerializer,
    UserSerializer,
    UserUpdateSerializer,
)


class UserProfileView(generics.RetrieveUpdateAPIView):
    """
    View for getting and updating user profile information including employee data
    """
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return UserProfileUpdateSerializer
        return UserProfileSerializer

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(
            instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        # Return full user profile data including employee information
        response_serializer = UserProfileSerializer(instance)
        return Response(response_serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([parsers.MultiPartParser])
def upload_profile_picture(request):
    """
    Upload profile picture to frontend public directory
    Saves both original and display versions for re-editing capability
    """
    try:
        # Check if user has an employee record
        if not hasattr(request.user, 'employee'):
            return Response(
                {'error': 'Employee profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get the uploaded file
        if 'profile_picture' not in request.FILES:
            return Response(
                {'error': 'No profile picture file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        uploaded_file = request.FILES['profile_picture']

        # Validate file type
        allowed_extensions = ['.jpg', '.jpeg', '.png', '.gif']
        file_extension = os.path.splitext(uploaded_file.name)[1].lower()

        if file_extension not in allowed_extensions:
            return Response(
                {'error': 'Invalid file type. Allowed: JPG, JPEG, PNG, GIF'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate file size (max 5MB)
        if uploaded_file.size > 5 * 1024 * 1024:
            return Response(
                {'error': 'File size too large. Maximum 5MB allowed'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create path to frontend public directory
        frontend_public_dir = os.path.join(
            settings.BASE_DIR.parent,  # Go up from backend to project root
            'frontend', 'public', 'images', 'profile-pictures'
        )
        
        # Ensure directory exists
        os.makedirs(frontend_public_dir, exist_ok=True)
        
        # Create filenames based on user ID
        user_id = request.user.id
        original_filename = f'user_{user_id}_original.jpg'
        display_filename = f'user_{user_id}.jpg'
        
        original_path = os.path.join(frontend_public_dir, original_filename)
        display_path = os.path.join(frontend_public_dir, display_filename)
        
        # Delete existing files if they exist
        for path in [original_path, display_path]:
            if os.path.exists(path):
                try:
                    os.remove(path)
                except Exception as e:
                    print(f"Warning: Could not delete old file {path}: {e}")
        
        # Process and save the uploaded image
        try:
            # Open the uploaded image
            img = Image.open(uploaded_file)
            
            # Convert to RGB if necessary (for JPEG)
            if img.mode in ('RGBA', 'P', 'L'):
                # Create a white background for transparent images
                rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'RGBA':
                    rgb_img.paste(img, mask=img.split()[-1])  # Use alpha channel as mask
                else:
                    rgb_img.paste(img)
                img = rgb_img
            
            # Save original file (for re-editing)
            img.save(original_path, 'JPEG', quality=95, optimize=True)
            
            # Create a display version (initial version same as original)
            # User can crop this later if needed
            img.save(display_path, 'JPEG', quality=90, optimize=True)
            
        except Exception as e:
            return Response(
                {'error': f'Image processing failed: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update employee record to track that they have a profile picture
        employee = request.user.employee
        employee.profile_picture = display_filename  # Store just display filename for reference
        employee.save()

        # Return versioned URLs to avoid browser cache showing stale images
        display_version = int(os.path.getmtime(display_path))
        original_version = int(os.path.getmtime(original_path))
        profile_picture_url = f'/images/profile-pictures/{display_filename}?v={display_version}'
        original_image_url = f'/images/profile-pictures/{original_filename}?v={original_version}'

        return Response({
            'message': 'Profile picture uploaded successfully',
            'profile_picture_url': profile_picture_url,
            'original_image_url': original_image_url
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response(
            {'error': f'Upload failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    """
    Change user password with current password verification
    """
    try:
        user = request.user
        data = request.data

        # Required fields
        current_password = data.get('current_password')
        new_password = data.get('new_password')
        confirm_password = data.get('confirm_password')

        if not all([current_password, new_password, confirm_password]):
            return Response(
                {'error': 'All password fields are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verify current password
        if not user.check_password(current_password):
            return Response(
                {'error': 'Current password is incorrect'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verify new passwords match
        if new_password != confirm_password:
            return Response(
                {'error': 'New passwords do not match'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate new password strength (basic validation)
        if len(new_password) < 8:
            return Response(
                {'error': 'New password must be at least 8 characters long'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if new password is different from current
        if user.check_password(new_password):
            return Response(
                {'error': 'New password must be different from current password'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update password
        user.set_password(new_password)
        user.save()

        return Response({
            'message': 'Password changed successfully'
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response(
            {'error': f'Password change failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_profile_summary(request):
    """
    Lightweight endpoint to get user profile summary for navbar/layout
    Returns profile picture URLs only when files exist
    """
    try:
        user = request.user
        user_id = user.id

        frontend_public_dir = os.path.join(
            settings.BASE_DIR.parent, 'frontend', 'public', 'images', 'profile-pictures'
        )
        profile_filename = f'user_{user_id}.jpg'
        original_filename = f'user_{user_id}_original.jpg'
        profile_path = os.path.join(frontend_public_dir, profile_filename)
        original_path = os.path.join(frontend_public_dir, original_filename)
        if os.path.exists(profile_path):
            profile_version = int(os.path.getmtime(profile_path))
            profile_url = f'/images/profile-pictures/{profile_filename}?v={profile_version}'
        else:
            profile_url = None

        if os.path.exists(original_path):
            original_version = int(os.path.getmtime(original_path))
            original_url = f'/images/profile-pictures/{original_filename}?v={original_version}'
        else:
            original_url = None
        
        # Base profile data
        profile_data = {
            'id': user.id,
            'email': user.email,
            'username': user.username,
            'role': user.role,
            'profile_picture': profile_url,
            'original_image_url': original_url,
            'display_name': None,
        }

        # Get employee data if exists for display name
        try:
            employee = user.employee
            profile_data['display_name'] = employee.full_name
        except Exception:
            # No employee record - display name stays None
            pass

        return Response(profile_data, status=status.HTTP_200_OK)

    except Exception as e:
        return Response(
            {'error': f'Failed to fetch profile summary: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# proxy_profile_image function removed - no longer needed with local storage


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def crop_profile_picture_server(request):
    """
    Server-side crop of the user's profile picture. Accepts JSON with:
    - source_url: Static URL of the original image (ignored, we use original file)
    - position: { x, y } top-left draw position relative to 300x300 canvas
    - scale: number applied to original image dimensions
    Produces a 300x300 circular JPEG and saves to frontend public directory.
    """
    try:
        if not hasattr(request.user, 'employee'):
            return Response({'error': 'Employee profile not found'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        position = data.get('position') or {}
        scale = float(data.get('scale') or 1)

        user_id = request.user.id
        
        # Create path to frontend public directory
        frontend_public_dir = os.path.join(
            settings.BASE_DIR.parent,
            'frontend', 'public', 'images', 'profile-pictures'
        )
        
        # File paths
        original_filename = f'user_{user_id}_original.jpg'
        display_filename = f'user_{user_id}.jpg'
        original_path = os.path.join(frontend_public_dir, original_filename)
        display_path = os.path.join(frontend_public_dir, display_filename)

        # Check if original file exists
        if not os.path.exists(original_path):
            return Response({'error': 'Original profile picture not found'}, status=status.HTTP_404_NOT_FOUND)

        # Read the original profile picture file
        try:
            with open(original_path, 'rb') as fp:
                image_bytes = fp.read()
        except Exception as e:
            return Response({'error': f'Failed to read original image: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Open and process the image
        try:
            img_obj = Image.open(io.BytesIO(image_bytes))
            src = img_obj.convert('RGBA')
        except Exception as e:
            return Response({'error': f'Failed to process image: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        with src:
            src = src.convert('RGBA')
            # Compute scaled dimensions
            scaled_w = int(src.width * scale)
            scaled_h = int(src.height * scale)
            scaled = src.resize((scaled_w, scaled_h), Image.LANCZOS)

            # Create 300x300 canvas and paste scaled image at given position
            canvas_size = 300
            canvas = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
            try:
                px = int(float(position.get('x', 0)))
                py = int(float(position.get('y', 0)))
            except Exception:
                px, py = 0, 0
            
            # Paste using the scaled image's alpha as mask; supports offsets
            canvas.paste(scaled, (px, py), scaled)

            # Create circular mask
            mask = Image.new('L', (canvas_size, canvas_size), 0)
            draw = ImageDraw.Draw(mask)
            draw.ellipse((0, 0, canvas_size, canvas_size), fill=255)
            canvas.putalpha(mask)

            # Composite over white background to get JPEG-friendly result
            output_bg = Image.new('RGB', (canvas_size, canvas_size), (255, 255, 255))
            output_bg.paste(canvas, mask=canvas.split()[-1])

            # Save cropped image to display file
            try:
                output_bg.save(display_path, 'JPEG', quality=90, optimize=True)
            except Exception as e:
                return Response({'error': f'Failed to save cropped image: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Update employee record
        employee = request.user.employee
        employee.profile_picture = display_filename
        employee.save()

        # Return versioned URL for the cropped image to bust cache
        display_version = int(os.path.getmtime(display_path))
        profile_picture_url = f'/images/profile-pictures/{display_filename}?v={display_version}'

        return Response({
            'message': 'Profile picture cropped successfully',
            'profile_picture_url': profile_picture_url
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({'error': f'Crop failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
